/**
 * Szintek az XP alapján. Az XP-t az adatbázis számolja (user_progress függvény),
 * itt csak a küszöbök és a megjelenítés van. A küszöbök bármikor átírhatók.
 */
export interface LevelDef {
  level: number
  minXp: number
  title: string
}

export const LEVELS: LevelDef[] = [
  { level: 1, minXp: 0, title: 'Kezdő' },
  { level: 2, minXp: 150, title: 'Kezdő' },
  { level: 3, minXp: 400, title: 'Rajongó' },
  { level: 4, minXp: 900, title: 'Rajongó' },
  { level: 5, minXp: 1700, title: 'Műértő' },
  { level: 6, minXp: 3000, title: 'Műértő' },
  { level: 7, minXp: 5000, title: 'Zenei Szakértő' },
  { level: 8, minXp: 8000, title: 'Zenei Szakértő' },
  { level: 9, minXp: 12000, title: 'Ízlés-Ikon' },
  { level: 10, minXp: 18000, title: 'Ízlés-Ikon' },
  { level: 11, minXp: 27000, title: 'Kritikus' },
  { level: 12, minXp: 40000, title: 'Kritikus' },
]

// A Kritikus címhez (11. szinttől) az XP mellett ez is kell
export const KRITIKUS_FROM_LEVEL = 11
export const KRITIKUS_GATE = { minRatings: 500, minStreak: 30 }
export const KRITIKUS_GATE_TEXT = 'A Kritikus címhez az XP mellett legalább 500 értékelés és egy 30 napos széria is kell.'

export interface GateStats {
  totalRatings: number
  maxStreak: number
}

export function isKritikusGateMet(stats: GateStats): boolean {
  return stats.totalRatings >= KRITIKUS_GATE.minRatings && stats.maxStreak >= KRITIKUS_GATE.minStreak
}

export interface LevelInfo {
  level: number
  title: string
  xp: number
  // Az aktuális szint kezdete és a következő szint küszöbe (null, ha a legmagasabb szinten van)
  floorXp: number
  nextXp: number | null
  // 0–1: mennyire jutott el a következő szintig
  progress: number
  // Ennyi XP hiányzik a következő szinthez (0, ha a legmagasabb szinten van)
  xpToNext: number
  // Igaz, ha az XP már elég a Kritikus címhez, de az extra feltétel még nem teljesült
  gateLocked: boolean
  // A Kritikus címhez tartozó extra feltétel szövege, ha a következő szint a Kritikus (különben null)
  gateNote: string | null
}

export function getLevelInfo(xp: number, stats?: GateStats): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp))
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (safeXp >= l.minXp) current = l
  }

  const gateMet = stats ? isKritikusGateMet(stats) : true
  let gateLocked = false
  if (current.level >= KRITIKUS_FROM_LEVEL && !gateMet) {
    current = LEVELS[KRITIKUS_FROM_LEVEL - 2]
    gateLocked = true
  }

  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null
  const progress = gateLocked ? 1 : next ? (safeXp - current.minXp) / (next.minXp - current.minXp) : 1
  const nextIsKritikus = next !== null && next.level >= KRITIKUS_FROM_LEVEL
  return {
    level: current.level,
    title: current.title,
    xp: safeXp,
    floorXp: current.minXp,
    nextXp: next ? next.minXp : null,
    progress: Math.min(1, Math.max(0, progress)),
    xpToNext: gateLocked || !next ? 0 : Math.max(0, next.minXp - safeXp),
    gateLocked,
    gateNote: nextIsKritikus && !gateMet ? KRITIKUS_GATE_TEXT : null,
  }
}
