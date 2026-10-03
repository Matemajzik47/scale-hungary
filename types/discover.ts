export interface DiscoverTrack {
  id: string
  title: string
  spotify_track_id: string | null
  album: {
    id: string
    title: string
    cover_url: string | null
    spotify_album_id: string | null
  }
  artist: {
    id: string
    name: string
  }
  communityAverage: number | null
  totalRatings: number
  userRating: number | null
}
