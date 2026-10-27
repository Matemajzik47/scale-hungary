// MusicBrainz API kapcsolat — nyílt, nem igényel API-kulcsot,
// de a MusicBrainz szabályai szerint kötelező egy azonosító User-Agent fejléc.

const MB_BASE_URL = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'ScaleApp/0.1 (matemajzik47@gmail.com)'


// A MusicBrainz szabálya: legfeljebb 1 kérés/másodperc. A Vercel szerverei közös
// IP-címeket használnak, ezért a túlterhelt (503) / korlátozott (429) válaszok
// gyakoriak. Ezért két védelem van: kérések közt szünet, és hibánál újrapróbálás.
const MB_MIN_GAP_MS = 1100
const MB_MAX_ATTEMPTS = 4
let lastMbRequestAt = 0

// Nem csak teljes albumok: a legfrissebb zenék jellemzően kislemezek (single) és EP-k.
const TYPE_FILTER = '(primarytype:Album OR primarytype:EP OR primarytype:Single)'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function mbFetchJson(url: string): Promise<unknown> {
  let lastError = 'ismeretlen hiba'

  for (let attempt = 1; attempt <= MB_MAX_ATTEMPTS; attempt++) {
    const wait = lastMbRequestAt + MB_MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastMbRequestAt = Date.now()

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      })

      if (res.ok) return await res.json()

      const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)
      lastError = `${res.status} ${res.statusText}${body ? ` (${body})` : ''}`

      // Csak az átmeneti hibákat érdemes újrapróbálni
      const retriable = res.status === 503 || res.status === 429 || res.status >= 500
      if (!retriable) break

      const retryAfter = Number(res.headers.get('retry-after'))
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter, 10) * 1000
        : 2000 * attempt
      if (attempt < MB_MAX_ATTEMPTS) await sleep(backoff)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < MB_MAX_ATTEMPTS) await sleep(2000 * attempt)
    }
  }

  throw new Error(`MusicBrainz hiba: ${lastError} (${MB_MAX_ATTEMPTS} próbálkozás után)`)
}

export interface MbRelease {
  id: string
  title: string
  date?: string
  artistName: string
  // A MusicBrainz előadó-azonosítója (az eredet ellenőrzéséhez)
  artistId?: string
}

type MbRawRelease = {
  id: string
  title: string
  date?: string
  'artist-credit'?: { name: string; artist?: { id?: string } }[]
}

function mapRawRelease(r: MbRawRelease): MbRelease {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    artistName: r['artist-credit']?.[0]?.name ?? 'Ismeretlen előadó',
    artistId: r['artist-credit']?.[0]?.artist?.id,
  }
}

/**
 * Az előadó eredete. A "country:HU" keresés a KIADÁS országára szűr, ezért külföldi
 * előadók magyarországi kiadásai is bekerültek. Ezért az előadót is megnézzük.
 * 'hu' = magyar, 'foreign' = biztosan külföldi, 'unknown' = nincs elég adat (megtartjuk).
 */
export type ArtistOrigin = 'hu' | 'foreign' | 'unknown'

export async function fetchArtistOrigin(mbArtistId: string): Promise<ArtistOrigin> {
  const data = (await mbFetchJson(`${MB_BASE_URL}/artist/${mbArtistId}?fmt=json`)) as {
    country?: string | null
    area?: { 'iso-3166-1-codes'?: string[] } | null
  }

  const country = data.country ?? null
  const areaCodes = data.area?.['iso-3166-1-codes'] ?? []
  // XW (világszerte) és XE (Európa) nem jelent tényleges országot
  const real = (c: string) => c !== 'XW' && c !== 'XE'

  if (country === 'HU' || areaCodes.includes('HU')) return 'hu'
  if (country && real(country)) return 'foreign'
  if (areaCodes.length > 0 && areaCodes.every(real)) return 'foreign'
  return 'unknown'
}

/** Egy meglévő előadó MusicBrainz-azonosítójának megkeresése egy kiadása alapján. */
export async function findArtistIdByRelease(artistName: string, albumTitle: string): Promise<string | null> {
  const esc = (t: string) => t.replace(/["\\]/g, ' ')
  const query = `release:"${esc(albumTitle)}" AND artist:"${esc(artistName)}"`
  const data = (await mbFetchJson(
    `${MB_BASE_URL}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`
  )) as { releases?: MbRawRelease[] }

  const wanted = artistName.trim().toLowerCase()
  for (const r of data.releases ?? []) {
    const credit = r['artist-credit']?.[0]
    if (credit?.artist?.id && credit.name.trim().toLowerCase() === wanted) return credit.artist.id
  }
  return null
}

/**
 * Lekéri a legutóbbi, Magyarországon kiadott zenei release-eket.
 * A "country:HU" a release kiadási országára szűr (ez egy ésszerű proxy
 * a "magyar kiadás" fogalmára induláskor).
 */
export async function fetchRecentHungarianReleases(
  daysBack = 30,
  maxResults = 200
): Promise<MbRelease[]> {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - daysBack)
  const sinceStr = sinceDate.toISOString().split('T')[0]

  const query = `country:HU AND date:[${sinceStr} TO *] AND ${TYPE_FILTER}`
  const pageSize = 100
  const out: MbRelease[] = []

  // A MusicBrainz nem tud "legújabb elöl" sorrendet adni, ezért az egész
  // időszakot (több oldalon) behozzuk, így a legfrissebb sem maradhat ki.
  for (let offset = 0; offset < maxResults; offset += pageSize) {
    const url = `${MB_BASE_URL}/release/?query=${encodeURIComponent(
      query
    )}&fmt=json&limit=${pageSize}&offset=${offset}`
    const data = (await mbFetchJson(url)) as { releases?: MbRawRelease[]; count?: number }
    const page = (data.releases ?? []).map(mapRawRelease)
    out.push(...page)
    if (page.length < pageSize) break
  }

  return out
}

export interface MbReleasePage {
  releases: MbRelease[]
  total: number
}

/**
 * A magyar (country:HU) album-katalógus lapozható lekérdezése egy adott
 * dátumtartományon belül — ez adja a fokozatos, napi adagokban történő
 * archív feltöltés (backfill) alapját. A MusicBrainz Lucene keresője nem
 * tud "legújabb elöl" sorrendet adni, ezért a backfill dátumsávokban halad
 * (pl. előbb az elmúlt 10 év, utána a régebbi évtizedek), hogy a frissebb
 * zene mindig előbb kerüljön be, mint a nagyon régi.
 * A `total` a MusicBrainz által jelzett összes találatszám ezen a sávon
 * belül, ebből tudjuk, mikor értünk a sáv végére.
 */
export async function fetchHungarianReleasesPageInRange(
  fromDate: string,
  toDate: string,
  offset: number,
  limit = 50
): Promise<MbReleasePage> {
  const query = `country:HU AND ${TYPE_FILTER} AND date:[${fromDate} TO ${toDate}]`
  const url = `${MB_BASE_URL}/release/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=${limit}&offset=${offset}`

  const data = (await mbFetchJson(url)) as { releases?: MbRawRelease[]; count?: number }

  const releases = (data.releases ?? []).map(mapRawRelease)

  return { releases, total: data.count ?? releases.length }
}
