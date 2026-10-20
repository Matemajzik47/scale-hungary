'use client'

import { useRef } from 'react'
import { ShieldCheck, Flame } from 'lucide-react'
import { ScaleLogo } from '@/components/ScaleLogo'
import type { ReactNode } from 'react'
import { CardQr } from '@/components/profile/CardQr'
import { CardBgImage, DEFAULT_BG_POS, type CardBgPos } from '@/components/profile/CardBgImage'

interface MusicIdCardProps {
  username: string
  tierLabel: string
  curatorScore: number | null
  totalRatings: number
  streak: number
  joinedLabel?: string
  bgUrl?: string | null
  bgPos?: CardBgPos
  // Saját háttér (pl. borítómozaik) a feltöltött kép helyett
  bgSlot?: ReactNode
  // false: nem követi a kurzort (pl. a főoldali példakártyán)
  interactive?: boolean
  // Időnként végigfutó átfénylés
  autoSheen?: boolean
}

// A felhasználónévből képzett, mindig ugyanolyan "ízlés-hullámforma" és ID szám
function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function waveFor(username: string): number[] {
  let seed = hashOf(username) || 1
  const out: number[] = []
  for (let i = 0; i < 24; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    out.push(6 + (seed % 100) * 0.26)
  }
  return out
}

export function MusicIdCard({
  username,
  tierLabel,
  curatorScore,
  totalRatings,
  streak,
  joinedLabel,
  bgUrl,
  bgPos = DEFAULT_BG_POS,
  bgSlot,
  interactive = true,
  autoSheen = false,
}: MusicIdCardProps) {
  const tiltRef = useRef<HTMLDivElement>(null)
  const wave = waveFor(username)
  const idNumber = String(hashOf(username) % 1000000).padStart(6, '0')

  // Egérrel/érintéssel enyhén megdől, mint egy valódi kártya
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = tiltRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--ry', `${x * 12}deg`)
    el.style.setProperty('--rx', `${-y * 12}deg`)
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`)
  }
  function onLeave() {
    const el = tiltRef.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--gx', '30%')
  }

  return (
    <section
      aria-label="Music Taste ID kártya"
      onPointerMove={interactive ? onMove : undefined}
      onPointerLeave={interactive ? onLeave : undefined}
      className="[perspective:900px]"
    >
      <div
        ref={tiltRef}
        style={{ '--ry': '0deg', '--rx': '0deg', '--gx': '30%' } as React.CSSProperties}
        className="relative min-h-[236px] w-full overflow-hidden rounded-[24px] border border-neutral-700/70 bg-[#101114] p-5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-out [transform:rotateY(var(--ry))_rotateX(var(--rx))]"
      >
        {/* Hátoldal: a felhasználó saját képe, halványan */}
        {bgSlot ?? (bgUrl && <CardBgImage url={bgUrl} pos={bgPos} className="opacity-80" />)}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1E1F24]/55 via-[#14151A]/40 to-[#0B0B0D]/70" />
        <div className="pointer-events-none absolute -bottom-12 -right-10 h-48 w-48 rounded-full bg-[#FF5B37] opacity-25 blur-3xl" />
        {/* Holografikus fénycsík, a kurzorral mozog */}
        {interactive && (
        <div
          className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
          style={{
            background:
              'linear-gradient(115deg, transparent calc(var(--gx) - 18%), rgba(255,255,255,0.28) var(--gx), transparent calc(var(--gx) + 18%))',
          }}
        />
        )}

        {autoSheen && (
          <div className="card-sheen pointer-events-none absolute inset-y-[-10%] -left-[40%] z-20 w-[34%] bg-gradient-to-r from-transparent via-white/40 to-transparent blur-[2px]" />
        )}

        <div className="relative z-10 flex min-h-[196px] flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScaleLogo className="h-7 w-7" />
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-200">
                Scale Music Taste ID
              </span>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[10px] text-neutral-100 backdrop-blur-sm">
              <ShieldCheck className="h-3 w-3 text-[#FF8F68]" />
              {tierLabel}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pt-1">
              <div className="truncate font-[family-name:var(--font-display)] text-[24px] font-bold leading-none tracking-tight drop-shadow">
                @{username}
              </div>
              <div className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-neutral-200">
                ID № {idNumber}
              </div>
              <div className="mt-3 flex h-[22px] items-center gap-[3px]" aria-hidden="true">
                {wave.map((h, i) => (
                  <span
                    key={i}
                    style={{ height: h }}
                    className={`w-[3px] rounded-sm ${i % 4 === 3 ? 'bg-white' : 'bg-[#FF5B37]'}`}
                  />
                ))}
              </div>
            </div>
            <CardQr username={username} />
          </div>

          <div className="flex items-end justify-between border-t border-white/15 pt-3">
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-300">
                Saját átlag
              </span>
              <b className="font-[family-name:var(--font-display)] text-[30px] font-bold leading-none text-[#FF8F68]">
                {curatorScore !== null ? curatorScore.toFixed(1) : '–'}
              </b>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-300">
                  Dal
                </span>
                <b className="font-mono text-base font-bold">{totalRatings}</b>
              </div>
              <div>
                <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-300">
                  Széria
                </span>
                <b className="flex items-center justify-end gap-0.5 font-mono text-base font-bold text-[#FF8F68]">
                  <Flame className="h-3.5 w-3.5" />
                  {streak}
                </b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
