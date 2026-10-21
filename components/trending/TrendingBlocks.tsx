'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Flame, Music, Star } from 'lucide-react'
import { Reveal } from '@/components/landing/Reveal'
import type { TrackCardData } from '@/lib/trending'

export function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string
  title: string
  hint?: string
}) {
  return (
    <div className="mb-3">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF5B37]">{eyebrow}</div>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-neutral-900">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}

export function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-xs text-neutral-500">
      {children}
    </div>
  )
}

function Cover({ url, className }: { url: string | null; className: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-neutral-100 text-neutral-300`}>
      <Music className="h-5 w-5" />
    </div>
  )
}

function ScoreChip({ value }: { value: number | null }) {
  if (value === null) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5B37] px-2 py-0.5 text-xs font-extrabold text-white shadow-sm">
      <Star className="h-3 w-3 fill-current" />
      {value.toFixed(1)}
    </span>
  )
}

/** Felkapott lista: az első egy nagy kártya, a többi rangsorolt sor. */
export function TrendingList({ items, periodLabel }: { items: TrackCardData[]; periodLabel: string }) {
  const [first, ...rest] = items
  if (!first) return null

  return (
    <div className="flex flex-col gap-3">
      <Reveal>
        <Link
          href={`/track/${first.trackId}`}
          className="group relative flex items-end overflow-hidden rounded-[26px] bg-[#111214] p-4 text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
        >
          {first.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={first.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="relative z-10 flex min-h-[200px] w-full flex-col justify-between">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#FF5B37] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider">
              <Flame className="h-3 w-3" /> #1 {periodLabel}
            </span>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">
                  {first.title}
                </div>
                <div className="truncate text-sm text-neutral-200">{first.artist}</div>
                <div className="mt-1 font-mono text-[11px] text-neutral-300">{first.count} értékelés ebben az időszakban</div>
              </div>
              <ScoreChip value={first.avg} />
            </div>
          </div>
        </Link>
      </Reveal>

      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          {rest.map((t, i) => (
            <Reveal key={t.trackId} delay={Math.min(i, 8) * 0.04}>
              <Link
                href={`/track/${t.trackId}`}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98]"
              >
                <span className="w-6 text-center font-mono text-sm font-bold text-neutral-400">{i + 2}</span>
                <Cover url={t.coverUrl} className="h-12 w-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-neutral-900">{t.title}</div>
                  <div className="truncate text-xs text-neutral-500">{t.artist}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ScoreChip value={t.avg} />
                  <span className="font-mono text-[10px] text-neutral-400">{t.count} értékelés</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}

/** Vízszintesen görgethető kártyasor. */
export function Scroller({
  items,
  ranked = false,
}: {
  items: (TrackCardData & { href?: string })[]
  ranked?: boolean
}) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((t, i) => (
        <Reveal key={t.trackId} delay={Math.min(i, 6) * 0.05} className="shrink-0 snap-start">
          <Link
            href={t.href ?? `/track/${t.trackId}`}
            className="block w-[140px] transition-transform active:scale-[0.97]"
          >
            <div className="relative">
              <Cover url={t.coverUrl} className="aspect-square w-full rounded-2xl shadow-sm" />
              {ranked && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-sm">
                  #{i + 1}
                </span>
              )}
              {t.avg !== null && (
                <span className="absolute bottom-1.5 right-1.5">
                  <ScoreChip value={t.avg} />
                </span>
              )}
            </div>
            <div className="mt-1.5 truncate text-[13px] font-bold text-neutral-900">{t.title}</div>
            <div className="truncate text-xs text-neutral-500">{t.note ?? t.artist}</div>
          </Link>
        </Reveal>
      ))}
    </div>
  )
}
