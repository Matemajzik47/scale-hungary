export interface DiscoverAlbum {
  id: string
  title: string
  cover_url: string | null
  release_date: string | null
  release_week: string | null
  spotify_album_id: string | null
  artist: {
    id: string
    name: string
  }
  communityAverage: number | null
  totalRatings: number
  userRating: number | null
}
