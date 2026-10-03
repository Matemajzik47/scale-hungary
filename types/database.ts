// Scale — adatbázis-séma típusdefiníciók
// Ez tükrözi a tervezett Supabase táblákat (2. hét feladata: ténylegesen létrehozni őket)

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Artist {
  id: string
  name: string
  country: string | null
  spotify_artist_id: string | null
  mb_artist_id: string | null
}

export interface Album {
  id: string
  artist_id: string
  title: string
  release_date: string
  cover_url: string | null
  spotify_album_id: string | null
  release_week: string // pl. "2026-W40"
}

export interface Track {
  id: string
  album_id: string
  title: string
  spotify_track_id: string | null
}

export interface Rating {
  id: string
  user_id: string
  track_id: string
  score: number // 1-10
  created_at: string
}

export interface UserStats {
  user_id: string
  total_ratings: number
  current_streak: number
  last_rated_week: string | null
}
