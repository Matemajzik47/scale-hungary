import { supabase } from '@/lib/supabase'
import type { Profile, UserStats } from '@/types/database'

type RatingRow = { score: number; track_id: string }
type TrackRow = { id: string; title: string; album_id: string }
type AlbumRow = { id: string; title: string; cover_url: string | null }

export type TopAlbum = {
  albumId: string
  title: string
  coverUrl: string | null
  rating: number
}

export interface ProfileData {
  profile: Profile
  stats: UserStats
  curatorScore: number | null
  topAlbums: TopAlbum[]
}

/**
 * Egy profil (username alapján) teljes, megjelenítéshez szükséges adatcsomagja:
 * alapadatok, statisztikák, saját átlag és a legmagasabbra értékelt albumok.
 * Megosztott logika a saját (/profile) és a publikus (/u/[username]) oldal között.
 */
export async function loadProfileDataByUsername(username: string): Promise<ProfileData | null> {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profileData) return null

  return loadProfileDataForUser(profileData as Profile)
}

export async function loadProfileDataByUserId(userId: string): Promise<ProfileData | null> {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profileData) return null

  return loadProfileDataForUser(profileData as Profile)
}

async function loadProfileDataForUser(profile: Profile): Promise<ProfileData> {
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', profile.id)
    .single()

  const stats: UserStats =
    (statsData as UserStats | null) ?? {
      user_id: profile.id,
      total_ratings: 0,
      current_streak: 0,
      last_rated_week: null,
    }

  const { data: ratingsData } = await supabase
    .from('ratings')
    .select('score, track_id')
    .eq('user_id', profile.id)

  const ratings = (ratingsData as RatingRow[] | null) ?? []

  let curatorScore: number | null = null
  let topAlbums: TopAlbum[] = []

  if (ratings.length > 0) {
    curatorScore = ratings.reduce((sum, r) => sum + Number(r.score), 0) / ratings.length

    const trackIds = ratings.map((r) => r.track_id)
    const { data: tracksData } = await supabase
      .from('tracks')
      .select('id, title, album_id')
      .in('id', trackIds)

    const tracksById = new Map<string, TrackRow>()
    for (const t of (tracksData as TrackRow[] | null) ?? []) {
      tracksById.set(t.id, t)
    }

    const albumIds = Array.from(new Set(Array.from(tracksById.values()).map((t) => t.album_id)))
    const { data: albumsData } = await supabase
      .from('albums')
      .select('id, title, cover_url')
      .in('id', albumIds.length > 0 ? albumIds : [''])

    const albumsById = new Map<string, AlbumRow>()
    for (const a of (albumsData as AlbumRow[] | null) ?? []) {
      albumsById.set(a.id, a)
    }

    const bestByAlbum = new Map<string, TopAlbum>()
    for (const r of ratings) {
      const track = tracksById.get(r.track_id)
      if (!track) continue
      const album = albumsById.get(track.album_id)
      if (!album) continue
      const score = Number(r.score)
      const existing = bestByAlbum.get(album.id)
      if (!existing || score > existing.rating) {
        bestByAlbum.set(album.id, {
          albumId: album.id,
          title: album.title,
          coverUrl: album.cover_url,
          rating: score,
        })
      }
    }

    topAlbums = Array.from(bestByAlbum.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6)
  }

  return { profile, stats, curatorScore, topAlbums }
}
