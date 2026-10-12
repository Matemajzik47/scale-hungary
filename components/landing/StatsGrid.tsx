'use client'

import { useEffect, useRef, useState } from 'react'

export type Stat = { label: string; value: number | null }

const TILE_STYLES = [
  { tile: 'bg-[#111214] text-white', label: 'text-[#FF8F68]' },
  { tile: 'border-[1.5px] border-[#111214] bg-white text-[#111214]', label: 'text-[#FF5B37]' },
  { tile: 'bg-[#FF5B37] text-[#111214]', label: 'text-[#111214]/70' },
  { tile: 'bg-[#111214] text-white', label: 'text-[#FF8F68]' },
]

function CountTile({ stat, index }: { stat: Stat; index: number }) {
  // null = nyugalmi állapot (a valódi érték látszik); szám = épp pörög az animáció
  const [animated, setAnimated] = useState<number | null>(null)
  const display = animated ?? stat.value
  const frame = useRef<number | null>(null)
  const style = TILE_STYLES[index % TILE_STYLES.length]

  // A szám alaphelyzetben a valódi érték; egérrel (vagy érintésre) ráállva
  // 0-ról felpörög ugyanarra az értékre.
  function spin() {
    const target = stat.value
    if (target === null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (frame.current !== null) cancelAnimationFrame(frame.current)

    const duration = 1100
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimated(Math.round(target * eased))
      if (t < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        setAnimated(null)
        frame.current = null
      }
    }
    frame.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [stat.value])

  return (
    <div
      tabIndex={0}
      onMouseEnter={spin}
      onFocus={spin}
      onTouchStart={spin}
      className={`min-w-0 cursor-default rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-0.5 ${style.tile}`}
    >
      <b className="block font-[family-name:var(--font-display)] text-[clamp(34px,6vw,54px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
        {display === null ? '–' : display.toLocaleString('hu-HU')}
      </b>
      <span className={`mt-2 block font-mono text-xs font-bold uppercase tracking-[0.1em] ${style.label}`}>
        {stat.label}
      </span>
    </div>
  )
}

export function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <section aria-label="Katalógus számok">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s, i) => (
          <CountTile key={s.label} stat={s} index={i} />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-3.5 font-mono text-xs text-[#5F6064]">
        <span className="live-dot h-2 w-2 rounded-full bg-[#FF5B37]" />
        Élő katalógus (Napi szinten frissülő megjelenésekkel!)
      </div>
    </section>
  )
}
