import { after, NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  fetchRecentHungarianReleases,
  fetchHungarianReleasesPageInRange,
  fetchArtistOrigin,
  findArtistIdByRelease,
  type ArtistOrigin,
  type MbRelease,
} from '@/lib/musicbrainz'
import {
  SpotifyRateLimitError,
  getSpotifyBlockedUntil,
  setSpotifyBlockedUntil,
  searchSpotifyAlbum,
  getArtistReleases,
  getAlbumTracks,
  findSpotifyArtistId,
} from '@/lib/spotify-server'
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
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()

  // Az elmúlt években (a kislemezekkel együtt sok a kiadás) havi sávok, újabbtól régebbi felé
  for (let y = thisYear; y >= thisYear - 2; y--) {
    for (let m = 12; m >= 1; m--) {
      out.push({ from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay(y, m)}` })
    }
  }
  // 2016-ig negyedéves sávok
  for (let y = thisYear - 3; y >= 2016; y--) {
    for (let q = 4; q >= 1; q--) {
      const m1 = (q - 1) * 3 + 1
      const m2 = q * 3
      out.push({ from: `${y}-${pad(m1)}-01`, to: `${y}-${pad(m2)}-${lastDay(y, m2)}` })
    }
  }
  // 2010-ig féléves, 1980-ig éves, azon túl évtizedes sávok
  for (let y = 2015; y >= 2010; y--) {
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
  filteredOut: number
  auditedArtists: number
  removedArtists: number
  watchedArtists: number
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
    filteredOut: 0,
    auditedArtists: 0,
    removedArtists: 0,
    watchedArtists: 0,
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

/** A legfrissebb kiadás kerüljön előre (a hiányos dátumok is összehasonlíthatók). */
function newestFirst(releases: MbRelease[]): MbRelease[] {
  return [...releases].sort((a, b) =>
    (normalizeDate(b.date) ?? '').localeCompare(normalizeDate(a.date) ?? '')
  )
}

// Egy futásnak ennyi ideje van a feldolgozásra, utána leáll (a maxDuration előtt),
// és a maradékot a következő futás intézi
const TIME_BUDGET_MS = 240_000

function errorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message
    : typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: unknown }).message)
    : JSON.stringify(err)
}

// Az egy futás alatt már megvizsgált előadók (hogy ne kérdezzük le újra)
const originCache = new Map<string, ArtistOrigin>()

/**
 * Magyar-e az előadó? A MusicBrainz "country:HU" keresése a kiadás országára szűr,
 * ezért külföldi előadók magyarországi kiadásai is bejöttek. A biztosan külföldi
 * előadókat a skipped_artists táblában tartjuk számon, így nem kérdezzük újra őket.
 */
async function classifyArtist(mbArtistId: string, name: string): Promise<ArtistOrigin> {
  const cached = originCache.get(mbArtistId)
  if (cached) return cached

  const { data: skipped } = await supabaseAdmin
    .from('skipped_artists')
    .select('mb_artist_id')
    .eq('mb_artist_id', mbArtistId)
    .maybeSingle()
  if (skipped) {
    originCache.set(mbArtistId, 'foreign')
    return 'foreign'
  }

  const { data: known } = await supabaseAdmin
    .from('artists')
    .select('id')
    .eq('mb_artist_id', mbArtistId)
    .maybeSingle()
  if (known) {
    originCache.set(mbArtistId, 'hu')
    return 'hu'
  }

  const origin = await fetchArtistOrigin(mbArtistId)
  if (origin === 'foreign') {
    await supabaseAdmin.from('skipped_artists').upsert({ mb_artist_id: mbArtistId, name })
  }
  originCache.set(mbArtistId, origin)
  return origin
}

/**
 * Egyetlen MusicBrainz release feldolgozása: artist/album/track beszúrása,
 * ha még nem létezik. Ugyanaz a logika a friss és a backfill ágban is.
 */
async function processRelease(release: MbRelease, summary: SyncSummary) {
  try {
    let { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id, mb_artist_id')
      .eq('name', release.artistName)
      .maybeSingle()

    // Ha az album már megvan, nincs mit tenni (és nem terheljük a MusicBrainzet)
    if (artist) {
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
    }

    // Külföldi előadó magyarországi kiadását nem vesszük fel
    if (release.artistId) {
      const origin = await classifyArtist(release.artistId, release.artistName)
      if (origin === 'foreign') {
        summary.filteredOut++
        return
      }
      // A már meglévő, azonosító nélküli előadónál eltesszük az ellenőrzés eredményét
      if (artist && !artist.mb_artist_id) {
        await supabaseAdmin
          .from('artists')
          .update({ mb_artist_id: release.artistId, origin_checked_at: new Date().toISOString() })
          .eq('id', artist.id)
      }
    }

    if (!artist) {
      const { data: newArtist, error: artistError } = await supabaseAdmin
        .from('artists')
        .insert({
          name: release.artistName,
          country: 'HU',
          mb_artist_id: release.artistId ?? null,
          origin_checked_at: release.artistId ? new Date().toISOString() : null,
        })
        .select('id, mb_artist_id')
        .single()

      if (artistError) throw artistError
      artist = newArtist
      summary.newArtists++
    }

    // Ha a Spotify éppen korlátoz, a kiadás Spotify nélkül is bekerül (helyőrző dallal),
    // a Spotify-pótlás később kiegészíti a borítóval és a valódi dallal.
    let spotifyMatch: Awaited<ReturnType<typeof searchSpotifyAlbum>> = null
    try {
      spotifyMatch = await searchSpotifyAlbum(release.artistName, release.title)
    } catch (e) {
      if (!(e instanceof SpotifyRateLimitError)) throw e
    }

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
    } else {
      // Nincs (még) Spotify-egyezés: az önálló szám (kislemez) így is megjelenik a
      // Felfedezésben, a Spotify-pótlás később cseréli a valódi dalra.
      const { error: placeholderError } = await supabaseAdmin
        .from('tracks')
        .insert({ album_id: newAlbum.id, title: release.title, spotify_track_id: null })
      if (placeholderError) throw placeholderError
      summary.newTracks++
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

const AUDIT_BATCH_SIZE = 20

// Ennyi előadót nézünk át egy futásnál friss kiadások után
const WATCH_BATCH_SIZE = 20
// Csak az ennél újabb (nap) kiadásokat vesszük át előadó-figyelésből
const WATCH_RECENT_DAYS = 90

function spotifyDateToIso(value: string): string {
  if (/^\d{4}$/.test(value)) return `${value}-01-01`
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  return value
}

/**
 * Előadó-figyelés: a katalógusban lévő előadók legfrissebb kiadásait közvetlenül a
 * Spotify-tól kérdezi le. A MusicBrainz késik, és a digitális kislemezeket gyakran nem
 * magyar kiadásként tárolja, így az új dalok ott akár napokig hiányozhatnak. A
 * legrégebben ellenőrzött előadók kerülnek sorra, így a teljes lista körbeér.
 */
async function runArtistWatch(summary: SyncSummary, hasTime: () => boolean) {
  const { data: artists } = await supabaseAdmin
    .from('artists')
    .select('id, name, spotify_artist_id')
    // csak az eredetük szerint már ellenőrzött előadókat figyeljük, hogy külföldiek ne jöjjenek be
    .not('origin_checked_at', 'is', null)
    .order('releases_checked_at', { ascending: true, nullsFirst: true })
    .limit(WATCH_BATCH_SIZE)

  const recentFrom = new Date(Date.now() - WATCH_RECENT_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  for (const artist of artists ?? []) {
    if (!hasTime()) break
    try {
      let spotifyArtistId: string | null = artist.spotify_artist_id

      if (!spotifyArtistId) {
        const { data: ownAlbums } = await supabaseAdmin.from('albums').select('title').eq('artist_id', artist.id).limit(10)
        spotifyArtistId = await findSpotifyArtistId(
          artist.name,
          (ownAlbums ?? []).map((a) => a.title)
        )
        if (spotifyArtistId) {
          // ha az azonosító már másnál szerepel, nem baj, a figyelést enélkül is tudjuk folytatni
          await supabaseAdmin.from('artists').update({ spotify_artist_id: spotifyArtistId }).eq('id', artist.id)
        }
      }

      if (spotifyArtistId) {
        const releases = await getArtistReleases(spotifyArtistId)

        for (const rel of releases) {
          const isoDate = spotifyDateToIso(rel.releaseDate)
          if (isoDate < recentFrom) continue

          const { data: bySpotify } = await supabaseAdmin
            .from('albums')
            .select('id')
            .eq('spotify_album_id', rel.id)
            .maybeSingle()
          if (bySpotify) continue

          const { data: byTitle } = await supabaseAdmin
            .from('albums')
            .select('id, spotify_album_id')
            .eq('artist_id', artist.id)
            .eq('title', rel.title)
            .maybeSingle()

          const tracks = await getAlbumTracks(rel.id)
          let albumId: string

          if (byTitle) {
            // a MusicBrainz-ből már megvan, csak a Spotify-adat hiányzott
            if (byTitle.spotify_album_id) continue
            const { error } = await supabaseAdmin
              .from('albums')
              .update({ spotify_album_id: rel.id, cover_url: rel.coverUrl })
              .eq('id', byTitle.id)
            if (error) throw error
            albumId = byTitle.id
          } else {
            const { data: created, error } = await supabaseAdmin
              .from('albums')
              .insert({
                artist_id: artist.id,
                title: rel.title,
                release_date: isoDate,
                cover_url: rel.coverUrl,
                spotify_album_id: rel.id,
                release_week: getIsoWeekString(new Date(isoDate)),
              })
              .select('id')
              .single()
            if (error) throw error
            albumId = created.id
            summary.newAlbums++
          }

          const { count } = await supabaseAdmin
            .from('tracks')
            .select('*', { count: 'exact', head: true })
            .eq('album_id', albumId)
          if ((count ?? 0) === 0 && tracks.length > 0) {
            const { error: tracksError } = await supabaseAdmin
              .from('tracks')
              .insert(tracks.map((t) => ({ album_id: albumId, title: t.title, spotify_track_id: t.id })))
            if (tracksError) throw tracksError
            summary.newTracks += tracks.length
          }
        }
      }

      await supabaseAdmin
        .from('artists')
        .update({ releases_checked_at: new Date().toISOString() })
        .eq('id', artist.id)
      summary.watchedArtists++
    } catch (err) {
      if (err instanceof SpotifyRateLimitError) {
        // Egyetlen jelzés, és megállunk: a maradék előadó a következő futásnál kerül sorra
        summary.errors.push(`Előadó-figyelés megállt (${artist.name}): ${errorMessage(err)}`)
        break
      }
      summary.errors.push(`Előadó-figyelés (${artist.name}): ${errorMessage(err)}`)
    }
  }
}

async function artistHasRatings(artistId: string): Promise<boolean> {
  const { data: albums } = await supabaseAdmin.from('albums').select('id').eq('artist_id', artistId)
  const albumIds = (albums ?? []).map((a) => a.id)
  if (albumIds.length === 0) return false
  const { data: tracks } = await supabaseAdmin.from('tracks').select('id').in('album_id', albumIds)
  const trackIds = (tracks ?? []).map((t) => t.id)
  if (trackIds.length === 0) return false
  const { count } = await supabaseAdmin
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .in('track_id', trackIds)
  return (count ?? 0) > 0
}

/**
 * A korábban (az eredet-ellenőrzés előtt) felvett előadók átvizsgálása: ha az előadó
 * biztosan külföldi és még nem értékelte senki a dalait, törlődik a katalógusból.
 * Ha már van értékelés a dalain, megmarad (ne vesszen el felhasználói adat).
 * Kis adagokban halad, minden futásnál néhány előadót ellenőriz.
 */
async function runArtistAudit(summary: SyncSummary) {
  const { data } = await supabaseAdmin
    .from('artists')
    .select('id, name, mb_artist_id')
    .is('origin_checked_at', null)
    .limit(AUDIT_BATCH_SIZE)

  for (const artist of data ?? []) {
    try {
      let mbId: string | null = artist.mb_artist_id
      if (!mbId) {
        const { data: album } = await supabaseAdmin
          .from('albums')
          .select('title')
          .eq('artist_id', artist.id)
          .limit(1)
          .maybeSingle()
        mbId = album ? await findArtistIdByRelease(artist.name, album.title) : null
      }

      let origin: ArtistOrigin = 'unknown'
      if (mbId) origin = await fetchArtistOrigin(mbId)

      if (origin === 'foreign') {
        if (mbId) await supabaseAdmin.from('skipped_artists').upsert({ mb_artist_id: mbId, name: artist.name })
        if (await artistHasRatings(artist.id)) {
          await supabaseAdmin
            .from('artists')
            .update({ origin_checked_at: new Date().toISOString() })
            .eq('id', artist.id)
        } else {
          await supabaseAdmin.from('artists').delete().eq('id', artist.id)
          summary.removedArtists++
        }
      } else {
        // Magyar vagy ismeretlen: megtartjuk, és ha megvan az azonosító, eltesszük
        const update: { origin_checked_at: string; mb_artist_id?: string } = {
          origin_checked_at: new Date().toISOString(),
        }
        if (mbId && !artist.mb_artist_id) update.mb_artist_id = mbId
        const { error } = await supabaseAdmin.from('artists').update(update).eq('id', artist.id)
        if (error && update.mb_artist_id) {
          // az azonosító már egy másik előadónál szerepel: csak az ellenőrzést jelöljük
          await supabaseAdmin
            .from('artists')
            .update({ origin_checked_at: update.origin_checked_at })
            .eq('id', artist.id)
        }
      }
      summary.auditedArtists++
    } catch (err) {
      // MusicBrainz hiba esetén nem jelöljük ellenőrzöttnek, a következő futás újrapróbálja
      summary.errors.push(`Előadó-ellenőrzés (${artist.name}): ${errorMessage(err)}`)
    }
  }
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
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recentFrom = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await supabaseAdmin
    .from('albums')
    .select('id, title, artists(name)')
    .is('spotify_album_id', null)
    // A nagyon friss kiadásokat (21 napon belül) naponta újrapróbáljuk, mert a Spotify
    // néha csak napokkal a megjelenés után indexeli őket; a régebbieket ritkábban.
    .or(
      `spotify_checked_at.is.null,spotify_checked_at.lt.${cutoff},and(release_date.gte.${recentFrom},spotify_checked_at.lt.${dayAgo})`
    )
    .order('spotify_checked_at', { ascending: true, nullsFirst: true })
    .order('release_date', { ascending: false, nullsFirst: false })
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
          // A korábbi helyőrző (Spotify nélküli) dalt a valódi váltja: egy számnál
          // frissítjük (az értékelések megmaradnak), többnél az értékeletleneket töröljük.
          const { data: placeholders } = await supabaseAdmin
            .from('tracks')
            .select('id')
            .eq('album_id', album.id)
            .is('spotify_track_id', null)
          const placeholderIds = (placeholders ?? []).map((p) => p.id)

          let toInsert = match.trackIds
          if (placeholderIds.length > 0) {
            if (match.trackIds.length === 1) {
              const only = match.trackIds[0]
              const { error: updError } = await supabaseAdmin
                .from('tracks')
                .update({ title: only.title, spotify_track_id: only.id })
                .eq('id', placeholderIds[0])
              if (updError) throw updError
              toInsert = []
            } else {
              const { data: rated } = await supabaseAdmin
                .from('ratings')
                .select('track_id')
                .in('track_id', placeholderIds)
              const ratedSet = new Set((rated ?? []).map((r) => r.track_id))
              const deletable = placeholderIds.filter((id) => !ratedSet.has(id))
              if (deletable.length > 0) await supabaseAdmin.from('tracks').delete().in('id', deletable)
            }
          }

          if (toInsert.length > 0) {
            const { error: tracksError } = await supabaseAdmin.from('tracks').insert(
              toInsert.map((t) => ({
                album_id: album.id,
                title: t.title,
                spotify_track_id: t.id,
              }))
            )
            if (tracksError) throw tracksError
          }
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
      if (err instanceof SpotifyRateLimitError) {
        summary.errors.push(`Pótlás megállt (${album.title}): ${errorMessage(err)}`)
        break
      }
      summary.errors.push(`Pótlás (${album.title}): ${errorMessage(err)}`)
    }
  }
}

/**
 * A Spotify hosszú (akár fél napos) tiltást is adhat. A tiltás végét a sync_state
 * 'spotify_block' sorának last_run_at mezőjében tároljuk, hogy minden futás tudjon róla,
 * és tiltás alatt egyetlen Spotify-kérés se menjen ki (az csak hosszabbítaná).
 */
async function loadSpotifyBlock() {
  const { data } = await supabaseAdmin
    .from('sync_state')
    .select('last_run_at')
    .eq('id', 'spotify_block')
    .maybeSingle()
  const until = data?.last_run_at ? new Date(data.last_run_at).getTime() : 0
  if (until > Date.now()) setSpotifyBlockedUntil(until)
}

async function saveSpotifyBlock() {
  const until = getSpotifyBlockedUntil()
  if (until <= Date.now()) return
  await supabaseAdmin
    .from('sync_state')
    .upsert({ id: 'spotify_block', last_run_at: new Date(until).toISOString() })
}

async function runSync(summary: SyncSummary) {
  // A részek egymástól függetlenül futnak: ha a MusicBrainz az egyiknél hibát ad,
  // a többi attól még lefuthat, és a hiba bekerül az összegzésbe.
  // Fontossági sorrend: 1) a héten megjelentek, 2) az elmúlt másfél hónap,
  // 3) régebbi archív zenék (visszafelé haladva), 4) Spotify-pótlás.
  const startedAt = Date.now()
  const hasTime = () => Date.now() - startedAt < TIME_BUDGET_MS

  try {
    await loadSpotifyBlock()
  } catch {
    // ha nem olvasható, a Spotify-kérés 429-nél úgyis újra megállítja a futást
  }
  const spotifyPaused = () => getSpotifyBlockedUntil() > Date.now()
  if (spotifyPaused()) {
    const hours = ((getSpotifyBlockedUntil() - Date.now()) / 3600000).toFixed(1)
    summary.errors.push(`Spotify szünet: még ~${hours} óráig nem kérdezzük (a kiadások Spotify nélkül is bekerülnek)`)
  }

  // 1. Ezen a héten (elmúlt 7 nap) megjelent kiadások: mindig ez fut le először
  try {
    const thisWeek = newestFirst(await fetchRecentHungarianReleases(7, 100))
    for (const release of thisWeek) {
      if (!hasTime()) break
      await processRelease(release, summary)
    }
  } catch (err) {
    summary.errors.push(`E heti kiadások: ${errorMessage(err)}`)
  }

  // 1a. Korábban felvett előadók eredetének ellenőrzése (külföldiek kiszedése).
  // Az ellenőrzött előadók kerülnek be a figyelésbe.
  try {
    if (hasTime()) await runArtistAudit(summary)
  } catch (err) {
    summary.errors.push(`Előadó-átvizsgálás: ${errorMessage(err)}`)
  }

  // 1b. Előadó-figyelés: a katalógus előadóinak friss kiadásai közvetlenül a Spotify-tól
  try {
    if (!spotifyPaused()) await runArtistWatch(summary, hasTime)
  } catch (err) {
    summary.errors.push(`Előadó-figyelés: ${errorMessage(err)}`)
  }

  // 2. Az elmúlt 45 nap többi kiadása (a már meglévőket gyorsan átugorja)
  try {
    const recentReleases = newestFirst(await fetchRecentHungarianReleases(45, 200))
    for (const release of recentReleases) {
      if (!hasTime()) break
      await processRelease(release, summary)
    }
  } catch (err) {
    summary.errors.push(`Friss kiadások: ${errorMessage(err)}`)
  }

  // 3. Archív backfill — egy adagnyi régebbi kiadás a legújabb dátumsávtól
  // kezdve (ld. BACKFILL_RANGES), ha még nem végeztünk
  try {
    if (hasTime()) await runBackfillBatch(summary)
  } catch (err) {
    summary.errors.push(`Backfill: ${errorMessage(err)}`)
  }

  // 4. Spotify nélküli albumok újrapárosítása (a legfrissebbek előbb)
  try {
    if (hasTime() && !spotifyPaused()) await runSpotifyRepair(summary)
  } catch (err) {
    summary.errors.push(`Pótlás: ${errorMessage(err)}`)
  }

  try {
    await saveSpotifyBlock()
  } catch {
    // nem kritikus: legrosszabb esetben a következő futás újra kap egy 429-et
  }

}
