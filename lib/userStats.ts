import { supabase } from '@/lib/supabase'

function getIsoDateString(date: Date): string {
  // YYYY-MM-DD, helyi idő szerint (nem UTC), hogy a nap-váltás a usernek
  // logikus pillanatban történjen, ne éjfélkor UTC-ben
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Egy rating mentése után hívjuk meg: újraszámolja a total_ratings-et
 * és frissíti a NAPI streak-et a user_stats táblában.
 * (A last_rated_week oszlop neve történelmi, de mostantól egy ISO dátumot
 * tárol benne, pl. "2026-10-03" — a napi sorozat alapja.)
 *
 * Szabály: ha ma már rate-elt → marad a streak; ha tegnap rate-elt
 * utoljára → +1; egyébként (kihagyott nap) → reset 1-re.
 */
export async function updateUserStats(userId: string) {
  const { count } = await supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const now = new Date()
  const today = getIsoDateString(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getIsoDateString(yesterdayDate)

  const { data: existingStats } = await supabase
    .from('user_stats')
    .select('current_streak, last_rated_week')
    .eq('user_id', userId)
    .maybeSingle()

  let newStreak = 1
  if (existingStats) {
    if (existingStats.last_rated_week === today) {
      newStreak = existingStats.current_streak
    } else if (existingStats.last_rated_week === yesterday) {
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
      last_rated_week: today,
    },
    { onConflict: 'user_id' }
  )
}
