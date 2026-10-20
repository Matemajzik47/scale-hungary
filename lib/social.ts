import { supabase } from '@/lib/supabase'

export type PersonRow = { id: string; username: string }
export type TasteMatch = { percent: number | null; commonTracks: number }

// Ennyi közös dal kell, hogy az egyezés százalék értelmes legyen
export const MIN_COMMON_TRACKS = 3

const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: unknown }

// A Supabase egy kéréssel legfeljebb 1000 sort ad vissza, ezért lapozunk
async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return all
}

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

export async function isFollowing(myId: string, otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', myId)
    .eq('following_id', otherId)
    .maybeSingle()
  return !!data
}

export async function followUser(myId: string, otherId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: myId, following_id: otherId })
  // 23505 = már követed, ez számunkra sikernek számít
  return !error || error.code === '23505'
}

export async function unfollowUser(myId: string, otherId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', myId)
    .eq('following_id', otherId)
  return !error
}

/** A követettek (following) vagy a követők (followers) listája */
export async function listConnections(
  userId: string,
  kind: 'following' | 'followers'
): Promise<PersonRow[]> {
  const ownColumn = kind === 'following' ? 'follower_id' : 'following_id'
  const otherColumn = kind === 'following' ? 'following_id' : 'follower_id'

  const { data: rows } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .eq(ownColumn, userId)

  const ids = (rows ?? []).map((r) => (r as Record<string, string>)[otherColumn])
  if (ids.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', ids)
    .order('username', { ascending: true })

  return (profiles as PersonRow[] | null) ?? []
}

type RatingPair = { user_id: string; track_id: string; score: number }

/**
 * Ízlés-egyezés a saját és mások értékelései között.
 * Képlet: a közösen értékelt dalokon az átlagos pontszám-eltérés (0–9 skálán)
 * százalékra átváltva: 100% = minden közös dalt ugyanannyira pontoztatok.
 */
export async function computeMatches(
  myId: string,
  otherIds: string[]
): Promise<Record<string, TasteMatch>> {
  const result: Record<string, TasteMatch> = {}
  for (const id of otherIds) result[id] = { percent: null, commonTracks: 0 }
  if (otherIds.length === 0) return result

  const mine = await fetchAllPages<RatingPair>((from, to) =>
    supabase.from('ratings').select('user_id, track_id, score').eq('user_id', myId).range(from, to)
  )
  if (mine.length === 0) return result

  const myScores = new Map<string, number>()
  for (const r of mine) myScores.set(r.track_id, Number(r.score))

  const others = await fetchAllPages<RatingPair>((from, to) =>
    supabase
      .from('ratings')
      .select('user_id, track_id, score')
      .in('user_id', otherIds)
      .range(from, to)
  )

  const sums = new Map<string, { diff: number; count: number }>()
  for (const r of others) {
    const mineScore = myScores.get(r.track_id)
    if (mineScore === undefined) continue
    const entry = sums.get(r.user_id) ?? { diff: 0, count: 0 }
    entry.diff += Math.abs(mineScore - Number(r.score))
    entry.count += 1
    sums.set(r.user_id, entry)
  }

  for (const [userId, { diff, count }] of sums) {
    result[userId] = {
      commonTracks: count,
      percent:
        count >= MIN_COMMON_TRACKS ? Math.round(100 * (1 - diff / count / 9)) : null,
    }
  }
  return result
}

export async function computeMatch(myId: string, otherId: string): Promise<TasteMatch> {
  const all = await computeMatches(myId, [otherId])
  return all[otherId]
}
