import { LEVELS } from '@/lib/levels'

/**
 * A címek (tierek) a szintekből adódnak: minden címhez egy vagy több szint tartozik.
 * A landing szint-listája használja.
 */
export interface Tier {
  label: string
  minLevel: number
  minXp: number
}

export const TIERS: Tier[] = LEVELS.reduce<Tier[]>((acc, l) => {
  if (!acc.some((t) => t.label === l.title)) {
    acc.push({ label: l.title, minLevel: l.level, minXp: l.minXp })
  }
  return acc
}, [])
