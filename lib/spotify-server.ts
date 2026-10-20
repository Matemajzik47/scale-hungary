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

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
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
  const tracksRes = await fetch(
    `https://api.spotify.com/v1/albums/${album.id}/tracks?market=HU&limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
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
