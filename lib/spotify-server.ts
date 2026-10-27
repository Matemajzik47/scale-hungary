// Spotify Web API — Client Credentials flow (app-szintű hitelesítés,
// NEM user-OAuth, így nem ütközik a 2026-os Spotify fejlesztői korlátozásokba)

let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyToken(): Promise<string> {
  // Újrahasználjuk a tokent, amíg érvényes, hogy ne kérjünk feleslegesen újat
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    throw new Error(`Spotify token hiba: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60mp biztonsági ráhagyás
  }

  return cachedToken.token
}

/**
 * A Spotify korlátozta a kéréseket (429). A hívó ilyenkor abbahagyja a Spotify-os munkát,
 * és a következő futás folytatja — a további próbálkozás csak hosszabbítaná a tiltást.
 */
export class SpotifyRateLimitError extends Error {
  retryAfterSec: number
  constructor(retryAfterSec: number) {
    super(`Spotify korlát (429), ${retryAfterSec} mp múlva próbálható újra`)
    this.name = 'SpotifyRateLimitError'
    this.retryAfterSec = retryAfterSec
  }
}

const MIN_GAP_MS = 220 // kérések közti minimális szünet (kb. 4-5 kérés/mp)
const MAX_WAIT_MS = 8000 // ennél hosszabb Retry-After esetén nem várunk, feladjuk
let blockedUntil = 0
let lastRequestAt = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Spotify GET kérés ütemezéssel; 429-nél a Retry-After szerint egyszer vár, utána feladja. */
async function spotifyRequest(url: string, token: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    if (Date.now() < blockedUntil) {
      throw new SpotifyRateLimitError(Math.ceil((blockedUntil - Date.now()) / 1000))
    }
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status !== 429) return res

    const retryAfter = Number(res.headers.get('retry-after')) || 5
    if (attempt >= 1 || retryAfter * 1000 > MAX_WAIT_MS) {
      blockedUntil = Date.now() + retryAfter * 1000
      throw new SpotifyRateLimitError(retryAfter)
    }
    await sleep(retryAfter * 1000)
  }
}

export interface SpotifyAlbumMatch {
  spotifyAlbumId: string
  coverUrl: string | null
  trackIds: { id: string; title: string }[]
}

type SpotifyAlbumItem = {
  id: string
  name: string
  images?: { url: string }[]
  artists?: { name: string }[]
  release_date?: string
  album_type?: string
}

type SpotifyTrackItem = { id: string; name: string }

/** Ékezetek, kis/nagybetű és írásjelek nélküli összehasonlító alak */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Az album címének "tisztított" változata: a zárójeles részek ("(Deluxe)",
 * "[Remastered]") és a gyakori kiadás-jelölések nélkül — ezek miatt nem talál
 * a Spotify keresője, mert a MusicBrainz és a Spotify másképp írja őket.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s[-–—]\s(deluxe|remaster(ed)?|expanded|special|bonus|extended).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function artistMatches(item: SpotifyAlbumItem, artistName: string): boolean {
  const wanted = normalize(artistName)
  if (!wanted) return false
  return (item.artists ?? []).some((a) => {
    const have = normalize(a.name)
    return have === wanted || have.includes(wanted) || wanted.includes(have)
  })
}

function titleMatches(item: SpotifyAlbumItem, albumTitle: string): boolean {
  const wanted = normalize(cleanTitle(albumTitle))
  const have = normalize(cleanTitle(item.name))
  if (!wanted || !have) return false
  return have === wanted || have.includes(wanted) || wanted.includes(have)
}

async function searchAlbums(query: string, token: string): Promise<SpotifyAlbumItem[]> {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
    query
  )}&type=album&market=HU&limit=5`

  const res = await spotifyRequest(url, token)
  if (!res.ok) {
    throw new Error(`Spotify search hiba: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return (data.albums?.items ?? []) as SpotifyAlbumItem[]
}

/**
 * Megkeresi egy album Spotify-megfelelőjét előadó + cím alapján.
 * Több keresési változatot próbál (pontos cím, tisztított cím, sima szöveges
 * keresés), és csak olyan találatot fogad el, ahol az előadó is egyezik, hogy
 * ne kerüljön be rossz album.
 */
export async function searchSpotifyAlbum(
  artistName: string,
  albumTitle: string
): Promise<SpotifyAlbumMatch | null> {
  const token = await getSpotifyToken()
  const cleaned = cleanTitle(albumTitle)

  const queries = [
    `album:${albumTitle} artist:${artistName}`,
    ...(cleaned && cleaned !== albumTitle ? [`album:${cleaned} artist:${artistName}`] : []),
    `${cleaned || albumTitle} ${artistName}`,
  ]

  let album: SpotifyAlbumItem | null = null

  for (const query of queries) {
    const items = await searchAlbums(query, token)
    const candidates = items.filter((item) => artistMatches(item, artistName))
    album = candidates.find((item) => titleMatches(item, albumTitle)) ?? null
    if (album) break
  }

  if (!album) return null

  // Track-lista lekérése az albumhoz
  const tracksRes = await spotifyRequest(
    `https://api.spotify.com/v1/albums/${album.id}/tracks?market=HU&limit=50`,
    token
  )
  const tracksData = tracksRes.ok ? await tracksRes.json() : { items: [] }

  return {
    spotifyAlbumId: album.id,
    coverUrl: album.images?.[0]?.url ?? null,
    trackIds: ((tracksData.items ?? []) as SpotifyTrackItem[]).map((t) => ({
      id: t.id,
      title: t.name,
    })),
  }
}


// ---------------------------------------------------------------------------
// Előadó-figyelés: a Spotify a megjelenés napján tudja az új kiadásokat, a
// MusicBrainz (közösségi adatbázis) viszont napokat késhet, és a digitális
// kislemezeket sokszor nem "HU", hanem "világszerte" országgal tárolja.
// ---------------------------------------------------------------------------

export interface SpotifyArtistRelease {
  id: string
  title: string
  releaseDate: string // "2026-10-26", "2026-10" vagy "2026"
  coverUrl: string | null
}

async function spotifyGet(url: string, token: string): Promise<unknown> {
  const res = await spotifyRequest(url, token)
  if (!res.ok) throw new Error(`Spotify hiba: ${res.status} ${res.statusText}`)
  return res.json()
}

/** Egy előadó legfrissebb albumai és kislemezei (a legújabb elöl). */
export async function getArtistReleases(spotifyArtistId: string): Promise<SpotifyArtistRelease[]> {
  const token = await getSpotifyToken()
  const data = (await spotifyGet(
    `https://api.spotify.com/v1/artists/${spotifyArtistId}/albums?include_groups=album,single&market=HU&limit=10`,
    token
  )) as { items?: SpotifyAlbumItem[] }

  return (data.items ?? [])
    .map((a) => ({
      id: a.id,
      title: a.name,
      releaseDate: a.release_date ?? '',
      coverUrl: a.images?.[0]?.url ?? null,
    }))
    .filter((a) => a.releaseDate)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
}

export async function getAlbumTracks(spotifyAlbumId: string): Promise<{ id: string; title: string }[]> {
  const token = await getSpotifyToken()
  const data = (await spotifyGet(
    `https://api.spotify.com/v1/albums/${spotifyAlbumId}/tracks?market=HU&limit=50`,
    token
  )) as { items?: SpotifyTrackItem[] }
  return (data.items ?? []).map((t) => ({ id: t.id, title: t.name }))
}

/**
 * Megkeresi az előadó Spotify-azonosítóját. Csak akkor fogadja el, ha a név pontosan
 * egyezik (ékezetek és kisbetű-nagybetű nélkül), és ha több ilyen is van, akkor azt,
 * amelynek az albumai között szerepel valamelyik nálunk már meglévő album címe.
 */
export async function findSpotifyArtistId(artistName: string, knownAlbumTitles: string[]): Promise<string | null> {
  const token = await getSpotifyToken()
  const data = (await spotifyGet(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:${artistName}`)}&type=artist&market=HU&limit=5`,
    token
  )) as { artists?: { items?: { id: string; name: string }[] } }

  const wanted = normalize(artistName)
  const exact = (data.artists?.items ?? []).filter((a) => normalize(a.name) === wanted)
  if (exact.length === 0) return null
  if (exact.length === 1) return exact[0].id

  const known = new Set(knownAlbumTitles.map((t) => normalize(cleanTitle(t))))
  for (const candidate of exact) {
    const releases = await getArtistReleases(candidate.id)
    if (releases.some((r) => known.has(normalize(cleanTitle(r.title))))) return candidate.id
  }
  return null
}
