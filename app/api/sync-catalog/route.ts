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

// Ennyi Spotify nélküli albumot próbálunk újra összepárosítani egy futás alatt
const REPAIR_BATCH_SIZE = 10
// Egy sikertelen párosítást ennyi nap múlva próbálunk újra
const REPAIR_RETRY_DAYS = 30

// A backfill ezeken a dátumsávokon halad végig SORBAN — előbb a legújabb
// évtized, csak utána a régebbiek. Így az "utóbbi 10 év" mindig előbb
// épül fel, mint az azt megelőző korszakok.
// A MusicBrainz keresője egy lekérdezésben legfeljebb az első 500 találatot adja,
// ezért a sávok kicsik: a friss évek fél évesek, a régebbiek egész évesek, a
// legrégebbiek évtizedesek. Így egy sávban nem lesz 500-nál több találat.
const MB_MAX_RESULTS = 500

function buildBackfillRanges(): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  const thisYear = new Date().getFullYear()
  for (let y = thisYear; y >= 2010; y--) {
    out.push({ from: `${y}-07-01`, to: `${y}-12-31` })
    out.push({ from: `${y}-01-01`, to: `${y}-06-30` })
  }
  for (let y = 2009; y >= 1980; y--) {
    out.push({ from: `${y}-01-01`, to: `${y}-12-31` })
  }
  for (let d = 1970; d >= 1900; d -= 10) {
    out.push({ from: `${d}-01-01`, to: `${d + 9}-12-31` })
  }
  return out
}

const BACKFILL_RANGES = buildBackfillRanges()

type SyncSummary = {
  processed: number
  newArtists: number
  newAlbums: number
  newTracks: number
  repairedAlbums: number
  skipped: number
  errors: string[]
}

function createSummary(): SyncSummary {
  return {
    processed: 0,
    newArtists: 0,
    newAlbums: 0,
    newTracks: 0,
    repairedAlbums: 0,
    skipped: 0,
    errors: [],
  }
}

/**
 * A MusicBrainz néha csak évet ("2026") vagy évet és hónapot ("2026-05") ad meg,
 * az adatbázis date oszlopa viszont teljes dátumot vár. Ezt egészítjük ki.
 */
function normalizeDate(value: string | undefined): string | null {
  if (!value) return null
  if (/^\d{4}$/.test(value)) return `${value}-01-01`
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return null
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

    const normalizedDate = normalizeDate(release.date)
    const releaseDate = normalizedDate ? new Date(normalizedDate) : new Date()
    const releaseWeek = getIsoWeekString(releaseDate)

    const { data: newAlbum, error: albumError } = await supabaseAdmin
      .from('albums')
      .insert({
        artist_id: artist.id,
        title: release.title,
        release_date: normalizedDate,
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
  // A MusicBrainz az első 500 találatnál többet nem ad egy sávból
  const pageSize = Math.min(BACKFILL_PAGE_SIZE, MB_MAX_RESULTS - offset)

  let releases: MbRelease[] = []
  let total = 0
  if (pageSize > 0) {
    const page = await fetchHungarianReleasesPageInRange(range.from, range.to, offset, pageSize)
    releases = page.releases
    total = Math.min(page.total, MB_MAX_RESULTS)
  }

  for (const release of releases) {
    await processRelease(release, summary)
  }

  const nextOffset = offset + releases.length
  const rangeFinished = pageSize <= 0 || releases.length === 0 || nextOffset >= total

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

/**
 * Az utolsó futás összegzését eltesszük a sync_state táblába, hogy a Supabase
 * Table Editorban (sync_state -> last_run) a Vercel logok nélkül is látszódjon,
 * mi történt (és ha hiba volt, mi volt az). Hiba esetén csendben továbblépünk.
 */
async function saveLastRun(summary: SyncSummary) {
  try {
    await supabaseAdmin
      .from('sync_state')
      .update({ last_run: summary, last_run_at: new Date().toISOString() })
      .eq('id', 'catalog_backfill')
  } catch {
    // az összegzés mentése nem lehet fontosabb, mint maga a szinkron
  }
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
    await runSync(summary)
    await saveLastRun(summary)
    // Ha semmi sem sikerült, és csak hibák vannak, jelezzük 502-vel
    const failed = summary.errors.length > 0 && summary.processed === 0 && summary.skipped === 0
    return NextResponse.json(
      { success: !failed, summary },
      { status: failed ? 502 : 200 }
    )
  }

  after(async () => {
    const summary = createSummary()
    await runSync(summary)
    await saveLastRun(summary)
    const log = summary.errors.length > 0 ? console.error : console.log
    log('[sync-catalog] kész', JSON.stringify(summary))
  })

  return NextResponse.json({ success: true, started: true })
}


type RepairAlbumRow = {
  id: string
  title: string
  artists: { name: string } | null
}

/**
 * Pótlás: azok az albumok, amelyekhez korábban nem találtunk Spotify-egyezést
 * (ezért nincs borítójuk és dalaik), újra próbálkoznak — a javított, tisztított
 * keresővel. Egy sikertelen próbát a spotify_checked_at jelzi, így ugyanaz az
 * album nem kerül sorra minden futásnál, csak REPAIR_RETRY_DAYS nap múlva.
 */
async function runSpotifyRepair(summary: SyncSummary) {
  const cutoff = new Date(Date.now() - REPAIR_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('albums')
    .select('id, title, artists(name)')
    .is('spotify_album_id', null)
    .or(`spotify_checked_at.is.null,spotify_checked_at.lt.${cutoff}`)
    .order('spotify_checked_at', { ascending: true, nullsFirst: true })
    .limit(REPAIR_BATCH_SIZE)

  if (error) throw error

  for (const album of (data ?? []) as unknown as RepairAlbumRow[]) {
    const artistName = album.artists?.name
    try {
      const match = artistName ? await searchSpotifyAlbum(artistName, album.title) : null

      if (match) {
        const { error: updateError } = await supabaseAdmin
          .from('albums')
          .update({ spotify_album_id: match.spotifyAlbumId, cover_url: match.coverUrl })
          .eq('id', album.id)
        if (updateError) throw updateError

        if (match.trackIds.length > 0) {
          const { error: tracksError } = await supabaseAdmin.from('tracks').insert(
            match.trackIds.map((t) => ({
              album_id: album.id,
              title: t.title,
              spotify_track_id: t.id,
            }))
          )
          if (tracksError) throw tracksError
          summary.newTracks += match.trackIds.length
        }
        summary.repairedAlbums++
      }

      await supabaseAdmin
        .from('albums')
        .update({ spotify_checked_at: new Date().toISOString() })
        .eq('id', album.id)
    } catch (err) {
      // Hibánál nem jelöljük ellenőrzöttnek, a következő futás újra megpróbálja
      summary.errors.push(`Pótlás (${album.title}): ${errorMessage(err)}`)
    }
  }
}

async function runSync(summary: SyncSummary) {
  // A két rész egymástól függetlenül fut: ha a MusicBrainz az egyiknél hibát ad,
  // a másik attól még lefuthat, és a hiba bekerül az összegzésbe.

  // 1. Friss (elmúlt 180 nap) kiadások
  try {
    const recentReleases = await fetchRecentHungarianReleases(180, 25)
    for (const release of recentReleases) {
      await processRelease(release, summary)
    }
  } catch (err) {
    summary.errors.push(`Friss kiadások: ${errorMessage(err)}`)
  }

  // 2. Archív backfill — egy adagnyi régi kiadás a legújabb dátumsávtól
  // kezdve (ld. BACKFILL_RANGES), ha még nem végeztünk
  try {
    await runBackfillBatch(summary)
  } catch (err) {
    summary.errors.push(`Backfill: ${errorMessage(err)}`)
  }

  // 3. Spotify nélküli albumok újrapárosítása
  try {
    await runSpotifyRepair(summary)
  } catch (err) {
    summary.errors.push(`Pótlás: ${errorMessage(err)}`)
  }
}
