'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { CoverMosaic } from '@/components/landing/CoverMosaic'

// A főoldali kártya háttere: minden csillanással egy új kép "úszik be", mintha a
// fénycsík húzná át. Ezzel mutatjuk, hogy a kártya háttere saját képre cserélhető.
// A fénycsík és a képváltás ugyanabban az ütemben fut (lásd globals.css: sheen-run, bg-wipe).

const CYCLE_MS = 7000

type Item = { kind: 'mosaic' } | { kind: 'cover'; url: string }

function Layer({ item, covers }: { item: Item; covers: string[] }) {
  if (item.kind === 'mosaic') return <CoverMosaic covers={covers} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70 saturate-[0.85]"
    />
  )
}

export function CardBgShowcase({ covers }: { covers: string[] }) {
  const reduce = useReducedMotion()
  const [tick, setTick] = useState(0)

  const items: Item[] = [
    { kind: 'mosaic' },
    ...covers.slice(0, 6).map((url): Item => ({ kind: 'cover', url })),
  ]
  const n = items.length

  // A képeket előre betöltjük, hogy a beúszáskor ne villanjon be üresen
  useEffect(() => {
    for (const url of covers.slice(0, 6)) {
      const img = new Image()
      img.src = url
    }
  }, [covers])

  useEffect(() => {
    if (reduce || n < 2) return
    const id = setInterval(() => setTick((t) => t + 1), CYCLE_MS)
    return () => clearInterval(id)
  }, [reduce, n])

  const base = items[tick % n]
  const next = items[(tick + 1) % n]

  return (
    <>
      <div className="absolute inset-0 overflow-hidden">
        <Layer item={base} covers={covers} />
      </div>
      {!reduce && n > 1 && (
        <div key={tick} className="bg-wipe absolute inset-0 overflow-hidden">
          <Layer item={next} covers={covers} />
        </div>
      )}
      {!reduce && n > 1 && (
        <div
          key={`s${tick}`}
          aria-hidden="true"
          className="sheen-run pointer-events-none absolute inset-y-[-10%] -left-[40%] z-20 w-[34%] bg-gradient-to-r from-transparent via-white/40 to-transparent blur-[2px]"
        />
      )}
    </>
  )
}
