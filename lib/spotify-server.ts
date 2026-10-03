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

/**
 * Megkeresi egy album Spotify-megfelelőjét előadó + cím alapján.
 * Visszaadja a borítóképet és a track-listát, amit a mi adatbázisunkba mentünk.
 */
export async function searchSpotifyAlbum(
  artistName: string,
  albumTitle: string
): Promise<SpotifyAlbumMatch | null> {
  const token = await getSpotifyToken()

  const query = `album:${albumTitle} artist:${artistName}`
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
    query
  )}&type=album&market=HU&limit=1`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Spotify search hiba: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const album = data.albums?.items?.[0]

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
    trackIds: (tracksData.items ?? []).map((t: any) => ({
      id: t.id,
      title: t.name,
    })),
  }
}
