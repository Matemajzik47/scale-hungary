'use client'

import { MIN_COMMON_TRACKS, type TasteMatch } from '@/lib/social'

function describe(percent: number): string {
  if (percent >= 85) return 'Szinte ugyanaz az ízlés'
  if (percent >= 70) return 'Nagyon hasonló ízlés'
  if (percent >= 55) return 'Van közös hang'
  return 'Eléggé eltérő ízlés'
}

const RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TasteMatchCard({ match, username }: { match: TasteMatch; username: string }) {
  const percent = match.percent
  const dash = percent === null ? 0 : (percent / 100) * CIRCUMFERENCE

  return (
    <section
      aria-label="Ízlés-egyezés"
      className="flex items-center gap-4 rounded-[22px] border border-neutral-200/80 bg-white p-4 shadow-sm"
    >
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
          <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="#F0EEEB" strokeWidth="8" />
          <circle
            cx="42"
            cy="42"
            r={RADIUS}
            fill="none"
            stroke="#FF5B37"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-black text-neutral-900">
          {percent === null ? '–' : `${percent}%`}
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Ízlés-egyezés
        </div>
        {percent !== null ? (
          <>
            <div className="mt-0.5 text-sm font-extrabold text-neutral-900">{describe(percent)}</div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {match.commonTracks} közös dal alapján, te és @{username}.
            </p>
          </>
        ) : (
          <>
            <div className="mt-0.5 text-sm font-extrabold text-neutral-900">Még kevés a közös dal</div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {match.commonTracks}/{MIN_COMMON_TRACKS} közös értékelés van. Értékeljetek több azonos
              dalt, hogy kiderüljön az egyezés.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
