import type { Progress } from '@/lib/progress'

export interface BadgeDef {
  key: string
  label: string
  description: string
  earned: (p: Progress) => boolean
}

export const BADGES: BadgeDef[] = [
  { key: 'first', label: 'Első lépés', description: 'Az első értékelésed', earned: (p) => p.totalRatings >= 1 },
  { key: 'r10', label: '10 dal', description: '10 értékelt dal', earned: (p) => p.totalRatings >= 10 },
  { key: 'r50', label: '50 dal', description: '50 értékelt dal', earned: (p) => p.totalRatings >= 50 },
  { key: 'r100', label: '100 dal', description: '100 értékelt dal', earned: (p) => p.totalRatings >= 100 },
  { key: 'r500', label: '500 dal', description: '500 értékelt dal', earned: (p) => p.totalRatings >= 500 },
  { key: 's7', label: 'Széria 7', description: '7 egymást követő nap értékeltél', earned: (p) => p.maxStreak >= 7 },
  { key: 's30', label: 'Széria 30', description: '30 egymást követő nap értékeltél', earned: (p) => p.maxStreak >= 30 },
  { key: 's100', label: 'Széria 100', description: '100 egymást követő nap értékeltél', earned: (p) => p.maxStreak >= 100 },
  {
    key: 'explorer',
    label: 'Felfedező',
    description: '10 dalt értékeltél az elsők között (az első 10 értékelő egyike voltál)',
    earned: (p) => p.earlyRatings >= 10,
  },
  {
    key: 'early',
    label: 'Korai madár',
    description: '10 dalt értékeltél a megjelenésük napján',
    earned: (p) => p.releaseDayRatings >= 10,
  },
]
