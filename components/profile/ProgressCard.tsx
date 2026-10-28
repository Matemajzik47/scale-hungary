'use client'

import { useState } from 'react'
import { Compass, Disc3, Flame, Lock, Music, Sparkles, Sunrise } from 'lucide-react'
import { BADGES } from '@/lib/badges'
import type { Progress } from '@/lib/progress'

const ICONS: Record<string, typeof Music> = {
  first: Sparkles,
  r10: Music,
  r50: Music,
  r100: Music,
  r500: Music,
  s7: Flame,
  s30: Flame,
  s100: Flame,
  explorer: Compass,
  early: Sunrise,
}

interface ProgressCardProps {
  progress: Progress
  // A kredit egyenleg csak a saját profilon látszik
  showCredits: boolean
}

export function ProgressCard({ progress, showCredits }: ProgressCardProps) {
  const { level } = progress
  const [selected, setSelected] = useState<string | null>(null)
  const selectedBadge = BADGES.find((b) => b.key === selected) ?? null
  const earnedCount = BADGES.filter((b) => b.earned(progress)).length

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Szint</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black leading-none text-neutral-900">{level.level}</span>
            <span className="truncate text-sm font-extrabold text-[#FF5B37]">{level.title}</span>
          </div>
        </div>

        {showCredits && (
          <div className="flex shrink-0 flex-col items-end">
            <div className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-white shadow-sm">
              <Disc3 className="h-4 w-4 text-[#FF8F68]" />
              <span className="font-mono text-sm font-black">{progress.credits}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">kredit</span>
            </div>
            <span className="mt-1 text-[10px] text-neutral-400">Hamarosan jutalmakra válthatod</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level.progress * 100)}
          aria-label="Haladás a következő szintig"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF5B37] to-[#FF8F68] transition-all duration-700"
            style={{ width: `${Math.max(3, Math.round(level.progress * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span className="font-mono font-semibold text-neutral-700">{level.xp} XP</span>
          <span>
            {level.nextXp === null
              ? 'Elérted a legmagasabb szintet'
              : level.gateLocked
                ? 'Az XP már megvan, de még van egy feltétel'
                : `Még ${level.xpToNext} XP a következő szintig`}
          </span>
        </div>
        {level.gateNote && <p className="text-[10px] leading-snug text-neutral-400">{level.gateNote}</p>}
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Jelvények</span>
          <span className="font-mono text-[10px] font-semibold text-[#FF5B37]">
            {earnedCount}/{BADGES.length}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {BADGES.map((badge) => {
            const earned = badge.earned(progress)
            const Icon = earned ? (ICONS[badge.key] ?? Music) : Lock
            const isSelected = selected === badge.key
            return (
              <button
                key={badge.key}
                type="button"
                onClick={() => setSelected(isSelected ? null : badge.key)}
                aria-pressed={isSelected}
                aria-label={`${badge.label}${earned ? '' : ' (még nem szerezted meg)'}`}
                className="flex min-w-0 flex-col items-center gap-1"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                    earned
                      ? 'border-[#FF5B37]/30 bg-[#FFF5F2] text-[#FF5B37]'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-300'
                  } ${isSelected ? 'ring-2 ring-[#FF5B37]/40' : ''}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`w-full truncate text-center text-[9px] font-semibold leading-tight ${
                    earned ? 'text-neutral-700' : 'text-neutral-400'
                  }`}
                >
                  {badge.label}
                </span>
              </button>
            )
          })}
        </div>

        {selectedBadge && (
          <p className="rounded-xl bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
            <span className="font-bold text-neutral-800">{selectedBadge.label}:</span> {selectedBadge.description}
            {!selectedBadge.earned(progress) && ' · még nem szerezted meg'}
          </p>
        )}
      </div>
    </section>
  )
}
