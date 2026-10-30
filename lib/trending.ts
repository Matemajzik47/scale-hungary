import { supabase } from '@/lib/supabase'
import { fetchFeaturedByAlbum, fetchFeaturedByTrack, withFeat } from '@/lib/credits'

export type TrackCardData = {
  trackId: string
  title: string
  artist: string
  coverUrl: string | null
  avg: number | null
  count: number | null
  note?: string
}

type TrendingRow = {
  track_id: string
  title: string
  artist_name: string
  cover_url: string | null
  avg_score: number | string | null
  total_ratings: number | string
  recent_ratings?: number | string
  note?: string | null
}

/** A felkapott/legjobb/stb. listákon a dalok előadója mellé kerül a vendég is (feat.). */
async function withFeatured(cards: TrackCardData[]): Promise<TrackCardData[]> {
  if (cards.length === 0) return cards
  const featured = await fetchFeaturedByTrack(cards.map((c) => c.trackId))
  return cards.map((c) => ({ ...c, artist: withFeat(c.artist, featured.get(c.trackId)) }))
}

function mapRow(r: TrendingRow, countFromRecent: boolean): TrackCardData {
  return {
    trackId: r.track_id,
    title: r.title,
    artist: r.artist_name,
    coverUrl: r.cover_url,
    avg: r.avg_score === null ? null : Number(r.avg_score),
    count: Number(countFromRecent && r.recent_ratings !== undefined ? r.recent_ratings : r.total_ratings),
    note: r.note ?? undefined,
  }
}

/** Felkapott: az időszakban a legtöbb értékelést kapott dalok. null = hiba (pl. hiányzó SQL). */
export async function fetchTrending(days: number, limit = 10): Promise<TrackCardData[] | null> {
  const { data, error } = await supabase.rpc('trending_tracks', { p_days: days, p_limit: limit })
  if (error) return null
  return withFeatured(((data ?? []) as TrendingRow[]).map((r) => mapRow(r, true)))
}

/** Legjobb átlagú dalok az időszakban (legalább minCount értékeléssel). */
export async function fetchTopRated(days: number, minCount = 2, limit = 10): Promise<TrackCardData[] | null> {
  const { data, error } = await supabase.rpc('top_rated_tracks', {
    p_days: days,
    p_min: minCount,
    p_limit: limit,
  })
  if (error) return null
  return withFeatured(((data ?? []) as TrendingRow[]).map((r) => mapRow(r, false)))
}

/** Megosztó: nagy a szórás az értékelések között. */
export async function fetchDivisive(limit = 12): Promise<TrackCardData[] | null> {
  const { data, error } = await supabase.rpc('divisive_tracks', { p_min: 3, p_limit: limit })
  if (error) return null
  return withFeatured(((data ?? []) as TrendingRow[]).map((r) => mapRow(r, false)))
}

/** Rejtett gyöngyszemek: magas átlag, kevés értékelés. */
export async function fetchHiddenGems(limit = 12): Promise<TrackCardData[] | null> {
  const { data, error } = await supabase.rpc('hidden_gems', { p_limit: limit })
  if (error) return null
  return withFeatured(((data ?? []) as TrendingRow[]).map((r) => mapRow(r, false)))
}

/** Neked javasolt (csak bejelentkezve értelmes): hasonló ízlésű felhasználók kedvencei. */
export async function fetchRecommended(limit = 12): Promise<TrackCardData[] | null> {
  const { data, error } = await supabase.rpc('recommended_tracks', { p_limit: limit })
  if (error) return null
  return withFeatured(((data ?? []) as TrendingRow[]).map((r) => mapRow(r, false)))
}

export type FreshRelease = {
  albumId: string
  title: string
  artist: string
  coverUrl: string | null
  firstTrackId: string | null
}

type FreshRow = {
  id: string
  title: string
  cover_url: string | null
  artists: { name: string } | null
  tracks: { id: string }[] | null
}

/** A katalógus legfrissebb albumai (a borítóval rendelkezők). */
export async function fetchFreshReleases(limit = 12): Promise<FreshRelease[]> {
  const { data } = await supabase
    .from('albums')
    .select('id, title, cover_url, artists(name), tracks(id)')
    .not('cover_url', 'is', null)
    .not('release_date', 'is', null)
    .lte('release_date', new Date().toISOString().slice(0, 10))
    .order('release_date', { ascending: false })
    .limit(limit)

  const rows = (data ?? []) as unknown as FreshRow[]
  const featured = await fetchFeaturedByAlbum(rows.map((a) => a.id))

  return rows.map((a) => ({
    albumId: a.id,
    title: a.title,
    artist: withFeat(a.artists?.name ?? 'Ismeretlen előadó', featured.get(a.id)),
    coverUrl: a.cover_url,
    firstTrackId: a.tracks?.[0]?.id ?? null,
  }))
}

type TrackMeta = { title: string; artist: string; coverUrl: string | null }

async function fetchTrackMeta(trackIds: string[]): Promise<Map<string, TrackMeta>> {
  const out = new Map<string, TrackMeta>()
  if (trackIds.length === 0) return out

  const { data: tracks } = await supabase.from('tracks').select('id, title, album_id').in('id', trackIds)
  const trackRows = (tracks ?? []) as { id: string; title: string; album_id: string }[]
  const albumIds = Array.from(new Set(trackRows.map((t) => t.album_id)))

  const { data: albums } = await supabase
    .from('albums')
    .select('id, cover_url, artist_id')
    .in('id', albumIds.length > 0 ? albumIds : [''])
  const albumRows = (albums ?? []) as { id: string; cover_url: string | null; artist_id: string }[]
  const artistIds = Array.from(new Set(albumRows.map((a) => a.artist_id)))

  const { data: artists } = await supabase
    .from('artists')
    .select('id, name')
    .in('id', artistIds.length > 0 ? artistIds : [''])
  const artistById = new Map(((artists ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]))
  const albumById = new Map(albumRows.map((a) => [a.id, a]))
  const featuredByAlbum = await fetchFeaturedByAlbum(albumIds)

  for (const t of trackRows) {
    const album = albumById.get(t.album_id)
    out.set(t.id, {
      title: t.title,
      artist: withFeat((album && artistById.get(album.artist_id)) ?? 'Ismeretlen előadó', featuredByAlbum.get(t.album_id)),
      coverUrl: album?.cover_url ?? null,
    })
  }
  return out
}

export type FriendFavorites =
  | { status: 'no-follows' }
  | { status: 'ok'; items: TrackCardData[] }

/** Amit az általad követett felhasználók magasra (7.0+) értékeltek. */
export async function fetchFriendFavorites(userId: string, limit = 12): Promise<FriendFavorites> {
  const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  const ids = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)
  if (ids.length === 0) return { status: 'no-follows' }

  const { data: ratings } = await supabase
    .from('ratings')
    .select('track_id, score, user_id, created_at')
    .in('user_id', ids)
    .gte('score', 7)
    .order('created_at', { ascending: false })
    .limit(80)

  const best = new Map<string, { score: number; userId: string }>()
  for (const r of (ratings ?? []) as { track_id: string; score: number | string; user_id: string }[]) {
    const score = Number(r.score)
    const cur = best.get(r.track_id)
    if (!cur || score > cur.score) best.set(r.track_id, { score, userId: r.user_id })
  }

  const trackIds = Array.from(best.keys()).slice(0, limit)
  if (trackIds.length === 0) return { status: 'ok', items: [] }

  const raterIds = Array.from(new Set(trackIds.map((id) => best.get(id)!.userId)))
  const [meta, profilesRes] = await Promise.all([
    fetchTrackMeta(trackIds),
    supabase.from('profiles').select('id, username').in('id', raterIds),
  ])
  const nameById = new Map(((profilesRes.data ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]))

  const items: TrackCardData[] = []
  for (const id of trackIds) {
    const m = meta.get(id)
    if (!m) continue
    const b = best.get(id)!
    items.push({
      trackId: id,
      title: m.title,
      artist: m.artist,
      coverUrl: m.coverUrl,
      avg: b.score,
      count: null,
      note: `@${nameById.get(b.userId) ?? 'ismerős'}`,
    })
  }
  return { status: 'ok', items }
}
