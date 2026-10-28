import { supabase } from '@/lib/supabase'
import { getLevelInfo, type LevelInfo } from '@/lib/levels'

export interface Progress {
  totalRatings: number
  xp: number
  creditsEarned: number
  // A kredit-naplóból származó egyenleg-módosítás (költések negatív, jóváírások pozitív)
  ledgerSum: number
  // Elérhető kredit: szerzett + napló
  credits: number
  maxStreak: number
  earlyRatings: number
  releaseDayRatings: number
  level: LevelInfo
}

type ProgressRow = {
  total_ratings: number
  xp: number
  credits_earned: number
  ledger_sum: number
  max_streak: number
  early_ratings: number
  release_day_ratings: number
}

/**
 * Egy felhasználó előrehaladása (XP, szint, kredit, jelvényekhez szükséges számok).
 * null, ha a user_progress függvény még nincs létrehozva az adatbázisban (add-levels.sql).
 * Az egyenleg csak a saját profilon értelmes: más felhasználó naplóját az RLS nem mutatja.
 */
export async function fetchProgress(userId: string): Promise<Progress | null> {
  const { data, error } = await supabase.rpc('user_progress', { p_user: userId })
  if (error || !data) return null
  const row = (Array.isArray(data) ? data[0] : data) as ProgressRow | undefined
  if (!row) return null
  return {
    totalRatings: row.total_ratings,
    xp: row.xp,
    creditsEarned: row.credits_earned,
    ledgerSum: row.ledger_sum,
    credits: Math.max(0, row.credits_earned + row.ledger_sum),
    maxStreak: row.max_streak,
    earlyRatings: row.early_ratings,
    releaseDayRatings: row.release_day_ratings,
    level: getLevelInfo(row.xp),
  }
}
