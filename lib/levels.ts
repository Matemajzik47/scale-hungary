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
  { level: 2, minXp: 100, title: 'Kezdő' },
  { level: 3, minXp: 250, title: 'Rajongó' },
  { level: 4, minXp: 500, title: 'Rajongó' },
  { level: 5, minXp: 900, title: 'Műértő' },
  { level: 6, minXp: 1500, title: 'Műértő' },
  { level: 7, minXp: 2400, title: 'Zenei Szakértő' },
  { level: 8, minXp: 3700, title: 'Zenei Szakértő' },
  { level: 9, minXp: 5500, title: 'Ízlés-Ikon' },
  { level: 10, minXp: 8000, title: 'Ízlés-Ikon' },
  { level: 11, minXp: 12000, title: 'Kritikus' },
  { level: 12, minXp: 18000, title: 'Kritikus' },
]

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
}

export function getLevelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp))
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (safeXp >= l.minXp) current = l
  }
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null
  const progress = next ? (safeXp - current.minXp) / (next.minXp - current.minXp) : 1
  return {
    level: current.level,
    title: current.title,
    xp: safeXp,
    floorXp: current.minXp,
    nextXp: next ? next.minXp : null,
    progress: Math.min(1, Math.max(0, progress)),
    xpToNext: next ? next.minXp - safeXp : 0,
  }
}
