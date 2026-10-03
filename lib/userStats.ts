import { supabase } from '@/lib/supabase'
import { getIsoWeekString } from '@/lib/week'

/**
 * Egy rating mentése után hívjuk meg: újraszámolja a total_ratings-et
 * és frissíti a heti streak-et a user_stats táblában.
 * (Megosztott logika a Discover és a Search oldal között.)
 */
export async function updateUserStats(userId: string) {
  const { count } = await supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const now = new Date()
  const nowWeek = getIsoWeekString(now)
  const prevWeekDate = new Date(now)
  prevWeekDate.setDate(prevWeekDate.getDate() - 7)
  const prevWeek = getIsoWeekString(prevWeekDate)

  const { data: existingStats } = await supabase
    .from('user_stats')
    .select('current_streak, last_rated_week')
    .eq('user_id', userId)
    .maybeSingle()

  let newStreak = 1
  if (existingStats) {
    if (existingStats.last_rated_week === nowWeek) {
      newStreak = existingStats.current_streak
    } else if (existingStats.last_rated_week === prevWeek) {
      newStreak = existingStats.current_streak + 1
    } else {
      newStreak = 1
    }
  }

  await supabase.from('user_stats').upsert(
    {
      user_id: userId,
      total_ratings: count ?? 0,
      current_streak: newStreak,
      last_rated_week: nowWeek,
    },
    { onConflict: 'user_id' }
  )
}
