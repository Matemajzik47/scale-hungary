import { after, NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  fetchRecentHungarianReleases,
  fetchHungarianReleasesPageInRange,
  type MbRelease,
} from '@/lib/musicbrainz'
import { searchSpotifyAlbum } from '@/lib/spotify-server'
import { getIsoWeekString } from '@/lib/week'

/**
 * Katalógus-szinkronizáció: lekéri a friss magyar kiadásokat a MusicBrainz-ből,
 * összeköti őket a Spotify adataival (borító, track-lista), és beírja
 * az artists / albums / tracks táblákba.
 *
 * Naponta automatikusan fut a Vercel Cron-on keresztül (lásd vercel.json),
 * ami az Authorization headerben küldi a CRON_SECRET-et. Kézzel is hívható
 * fejlesztés közben, ha a .env.local-ban be van állítva a CRON_SECRET és
 * azt Bearer tokenként megadod.
 *
 * Két részből áll minden futás:
 * 1. Friss sync — az elmúlt 180 nap kiadásai (ez tartja naprakészen a
 *    Discover "heti megjelenés" élményét).
 * 2. Backfill — a sync_state táblában tárolt pozíciótól kezdve egy adagnyi
 *    RÉGI magyar kiadást is behoz. A backfill DÁTUMSÁVOKBAN halad, a
 *    legújabbtól a legrégebbi felé (lásd BACKFILL_RANGES lent), hogy a
 *    frissebb évek zenéje mindig előbb kerüljön be, mint a nagyon régi.
 */

// A háttérben futó szinkronnak is legyen elég ideje (másodperc)
export const maxDuration = 300

const BACKFILL_PAGE_SIZE = 40

// A backfill ezeken a dátumsávokon halad végig SORBAN — előbb a legújabb
// évtized, csak utána a régebbiek. Így az "utóbbi 10 év" mindig előbb
// épül fel, mint az azt megelőző korszakok.
const BACKFILL_RANGES: { from: string; to: string }[] = [
  { from: '2016-01-01', to: '2030-12-31' }, // elmúlt ~10 év (puha felső határ)
  { from: '2000-01-01', to: '2015-12-31' },
  { from: '1980-01-01', to: '1999-12-31' },
  { from: '1900-01-01', to: '1979-12-31' },
]

type SyncSummary = {
  processed: number
  newArtists: number
  newAlbums: number
  newTracks: number
  skipped: number
  errors: string[]
}

function createSummary(): SyncSummary {
  return { processed: 0, newArtists: 0, newAlbums: 0, newTracks: 0, skipped: 0, errors: [] }
}

function errorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message
    : typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: unknown }).message)
    : JSON.stringify(err)
}

/**
 * Egyetlen MusicBrainz release feldolgozása: artist/album/track beszúrása,
 * ha még nem létezik. Ugyanaz a logika a friss és a backfill ágban is.
 */
async function processRelease(release: MbRelease, summary: SyncSummary) {
  try {
    let { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('name', release.artistName)
      .maybeSingle()

    if (!artist) {
      const { data: newArtist, error: artistError } = await supabaseAdmin
        .from('artists')
        .insert({ name: release.artistName, country: 'HU' })
        .select('id')
        .single()

      if (artistError) throw artistError
      artist = newArtist
      summary.newArtists++
    }

    const { data: existingAlbum } = await supabaseAdmin
      .from('albums')
      .select('id')
      .eq('artist_id', artist.id)
      .eq('title', release.title)
      .maybeSingle()

    if (existingAlbum) {
      summary.skipped++
      return
    }

    const spotifyMatch = await searchSpotifyAlbum(release.artistName, release.title)

    const releaseDate = release.date ? new Date(release.date) : new Date()
    const releaseWeek = getIsoWeekString(releaseDate)

    const { data: newAlbum, error: albumError } = await supabaseAdmin
      .from('albums')
      .insert({
        artist_id: artist.id,
        title: release.title,
        release_date: release.date ?? null,
        cover_url: spotifyMatch?.coverUrl ?? null,
        spotify_album_id: spotifyMatch?.spotifyAlbumId ?? null,
        release_week: releaseWeek,
      })
      .select('id')
      .single()

    if (albumError) throw albumError
    summary.newAlbums++

    if (spotifyMatch && spotifyMatch.trackIds.length > 0) {
      const tracksToInsert = spotifyMatch.trackIds.map((t) => ({
        album_id: newAlbum.id,
        title: t.title,
        spotify_track_id: t.id,
      }))

      const { error: tracksError } = await supabaseAdmin.from('tracks').insert(tracksToInsert)

      if (tracksError) throw tracksError
      summary.newTracks += tracksToInsert.length
    }

    summary.processed++
  } catch (err) {
    summary.errors.push(`${release.artistName} - ${release.title}: ${errorMessage(err)}`)
  }
}

/**
 * Egy adagnyi régi kiadás behozása a sync_state-ben tárolt pozíciótól
 * (melyik dátumsávnál tartunk, azon belül melyik offsetnél). Ha egy sávot
 * végigértünk, a következő (régebbi) sávra lépünk; ha az utolsó sávot is
 * végigértük, a backfill_done flag-et igazra állítjuk.
 */
async function runBackfillBatch(summary: SyncSummary) {
  const { data: state } = await supabaseAdmin
    .from('sync_state')
    .select('backfill_offset, backfill_range_index, backfill_done')
    .eq('id', 'catalog_backfill')
    .maybeSingle()

  if (state?.backfill_done) {
    return
  }

  let rangeIndex = state?.backfill_range_index ?? 0
  let offset = state?.backfill_offset ?? 0

  if (rangeIndex >= BACKFILL_RANGES.length) {
    await supabaseAdmin.from('sync_state').upsert({
      id: 'catalog_backfill',
      backfill_offset: offset,
      backfill_range_index: rangeIndex,
      backfill_done: true,
      updated_at: new Date().toISOString(),
    })
    return
  }

  const range = BACKFILL_RANGES[rangeIndex]
  const { releases, total } = await fetchHungarianReleasesPageInRange(
    range.from,
    range.to,
    offset,
    BACKFILL_PAGE_SIZE
  )

  for (const release of releases) {
    await processRelease(release, summary)
  }

  const nextOffset = offset + releases.length
  const rangeFinished = releases.length === 0 || nextOffset >= total

  if (rangeFinished) {
    rangeIndex += 1
    offset = 0
  } else {
    offset = nextOffset
  }

  const done = rangeIndex >= BACKFILL_RANGES.length

  await supabaseAdmin.from('sync_state').upsert({
    id: 'catalog_backfill',
    backfill_offset: offset,
    backfill_range_index: rangeIndex,
    backfill_done: done,
    updated_at: new Date().toISOString(),
  })
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  // A teljes szinkron ~45 mp-ig tart, a külső cron-szolgáltatások (pl. a
  // cron-job.org ingyenes csomagja) viszont ~30 mp után időtúllépést jeleznek.
  // Ezért alapból azonnal válaszolunk, a tényleges munka a válasz után, a
  // háttérben fut tovább (after). Fejlesztéskor a ?wait=1 paraméterrel
  // megvárható a teljes futás és az eredmény-összegzés.
  const waitForResult = request.nextUrl.searchParams.get('wait') === '1'

  if (waitForResult) {
    const summary = createSummary()
    try {
      await runSync(summary)
      return NextResponse.json({ success: true, summary })
    } catch (err) {
      return NextResponse.json(
        { success: false, error: errorMessage(err), summary },
        { status: 500 }
      )
    }
  }

  after(async () => {
    const summary = createSummary()
    try {
      await runSync(summary)
      console.log('[sync-catalog] kész', JSON.stringify(summary))
    } catch (err) {
      console.error('[sync-catalog] hiba', errorMessage(err), JSON.stringify(summary))
    }
  })

  return NextResponse.json({ success: true, started: true })
}

async function runSync(summary: SyncSummary) {
  // 1. Friss (elmúlt 180 nap) kiadások
  const recentReleases = await fetchRecentHungarianReleases(180, 25)
  for (const release of recentReleases) {
    await processRelease(release, summary)
  }

  // 2. Archív backfill — egy adagnyi régi kiadás a legújabb dátumsávtól
  // kezdve (ld. BACKFILL_RANGES), ha még nem végeztünk
  await runBackfillBatch(summary)
}
