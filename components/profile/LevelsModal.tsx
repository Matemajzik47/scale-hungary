'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Check, Crown, Gem, GraduationCap, Headphones, Heart, Lock, Sprout, X } from 'lucide-react'
import { LEVELS, type LevelInfo } from '@/lib/levels'
import { TIERS } from '@/lib/tiers'

const TIER_ICONS: Record<string, typeof Sprout> = {
  Kezdő: Sprout,
  Rajongó: Heart,
  Műértő: Headphones,
  'Zenei Szakértő': GraduationCap,
  'Ízlés-Ikon': Crown,
  Kritikus: Gem,
}

interface LevelsModalProps {
  isOpen: boolean
  onClose: () => void
  level: LevelInfo
}

export function LevelsModal({ isOpen, onClose, level }: LevelsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Szintek"
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-10 flex max-h-[85vh] w-full max-w-[360px] flex-col gap-3 rounded-[28px] border border-neutral-100 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-400">Szintek</div>
                <div className="mt-0.5 text-sm font-extrabold text-neutral-900">
                  {level.level}. szint · <span className="text-[#FF5B37]">{level.title}</span>
                </div>
                <div className="font-mono text-[11px] text-neutral-500">{level.xp} XP</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Bezárás"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1 pb-1">
              {TIERS.map((tier) => {
                const Icon = TIER_ICONS[tier.label] ?? Sprout
                const tierLevels = LEVELS.filter((l) => l.title === tier.label)
                const isCurrent = tier.label === level.title
                const reached = tierLevels[0].level <= level.level
                const isKritikus = tier.label === 'Kritikus'

                return (
                  <li
                    key={tier.label}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      isCurrent
                        ? 'border-[#FF5B37]/40 bg-[#FFF5F2]'
                        : reached
                          ? 'border-neutral-200 bg-white'
                          : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        isCurrent
                          ? 'bg-[#FF5B37] text-white'
                          : reached
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-200 text-neutral-400'
                      }`}
                    >
                      {reached ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-extrabold ${reached ? 'text-neutral-900' : 'text-neutral-500'}`}>
                          {tier.label}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full bg-[#FF5B37] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Itt tartasz
                          </span>
                        ) : reached ? (
                          <Check className="h-3.5 w-3.5 text-neutral-400" />
                        ) : null}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        {tierLevels.map((l) => `${l.level}. szint: ${l.minXp} XP`).join(' · ')}
                      </div>
                      {isKritikus && (
                        <div className="mt-1 text-[10px] leading-snug text-neutral-400">
                          Az XP mellett legalább 500 értékelés és egy 30 napos széria is kell.
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
