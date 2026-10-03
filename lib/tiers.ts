/**
 * Egyszerű tier-rendszer a total_ratings alapján.
 * Később finomítható (pl. streak, minőségi mutatók bevonásával).
 */
export interface Tier {
  label: string
  minRatings: number
}

export const TIERS: Tier[] = [
  { label: 'Kezdő', minRatings: 0 },
  { label: 'Rajongó', minRatings: 10 },
  { label: 'Műértő', minRatings: 25 },
  { label: 'Zenei Szakértő', minRatings: 50 },
  { label: 'Ízlés-Ikon', minRatings: 150 },
]

export function getTierForRatings(totalRatings: number): Tier {
  let current = TIERS[0]
  for (const tier of TIERS) {
    if (totalRatings >= tier.minRatings) {
      current = tier
    }
  }
  return current
}
