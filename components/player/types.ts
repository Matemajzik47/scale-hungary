export type PlayerTrack = {
  trackId: string
  spotifyTrackId: string | null
  spotifyAlbumId: string | null
  title: string
  artist: string
  coverUrl: string | null
}

// Amit egy lejátszás gomb átad. Ha a Spotify-azonosító (spotifyTrackId) vagy a cím hiányzik,
// a lejátszó az adatbázisból kéri le a kattintáskor.
export type PlayInput = { trackId: string } & Partial<Omit<PlayerTrack, 'trackId'>>
