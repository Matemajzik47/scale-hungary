'use client'

import { useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MusicIdCard } from '@/components/profile/MusicIdCard'
import { ScaleLogo } from '@/components/ScaleLogo'
import { CardBgShowcase } from '@/components/landing/CardBgShowcase'

// Példa Music ID kártya a kezdőoldal hero-jához (nem valódi felhasználó). Ugyanazt a kártyát
// használja, mint a profil, így a főoldalon is pontosan ilyet kapsz.
// 3D-ben lebeg egy mágneskorong fölött; egérrel enyhén követi a kurzort.

export function IdCardPreview({ covers }: { covers: string[] }) {
  const tiltRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const el = tiltRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--ry', `${-9 + x * 10}deg`)
    el.style.setProperty('--rx', `${3 - y * 8}deg`)
  }

  function onLeave() {
    const el = tiltRef.current
    if (!el) return
    el.style.setProperty('--ry', '-9deg')
    el.style.setProperty('--rx', '3deg')
  }

  return (
    <div
      aria-label="Példa Music Taste ID kártya"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative mx-auto h-[365px] w-full max-w-[400px] [perspective:1200px]"
    >
      {/* Bakelitlemez: a korong lapos, a közepén forgó címke van */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.8, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-x-0 bottom-2 flex h-[110px] items-center justify-center [perspective:900px]"
        aria-hidden="true"
      >
        <div className="relative aspect-square w-[86%] [transform-style:preserve-3d] [transform:rotateX(72deg)]">
          {/* Tányér alja: vastagság + narancs fény */}
          <div className="disc-glow absolute inset-0 rounded-full bg-[#0B0B0D] [transform:translateZ(-16px)]" />
          {/* Az egész lemez együtt forog a közepe körül (címkével együtt) */}
          <div
            className="vinyl-spin absolute inset-0 flex items-center justify-center rounded-full border-2 border-[#FF5B37]"
            style={{
              background: 'repeating-radial-gradient(circle at center, #0c0c0e 0 2px, #1a1b1f 2px 3px)',
            }}
          >
            {/* Címke */}
            <div className="relative flex aspect-square w-[34%] items-center justify-center rounded-full bg-gradient-to-br from-[#FF5B37] to-[#FF8F68] shadow-[inset_0_0_0_3px_rgba(0,0,0,0.25)]">
              <ScaleLogo className="h-[34%] w-[34%] !ring-0" />
              <span className="absolute left-[16%] top-1/2 h-[6%] w-[6%] -translate-y-1/2 rounded-full bg-white/80" />
            </div>
          </div>
          {/* Fix fényív: nem forog a lemezzel, így a fény a helyén marad */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 30deg, transparent 0 18%, rgba(255,255,255,0.16) 24%, transparent 32% 68%, rgba(255,255,255,0.16) 74%, transparent 82%)',
            }}
          />
        </div>
        {/* A kártya vetett fénye a lemezen */}
        <div className="card-shadow absolute inset-x-[26%] top-[34px] h-[30px] rounded-[50%] bg-[#FF5B37]/40 blur-xl" />
      </motion.div>

      {/* Lebegő kártya: a korong után "leereszkedik", majd lebeg */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -70 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 70, delay: 0.35 }}
        className="absolute inset-x-0 top-0"
      >
      <div className="card-float flex justify-center [will-change:transform]">
        <div
          ref={tiltRef}
          style={{ '--ry': '-9deg', '--rx': '3deg' } as React.CSSProperties}
          className="relative w-[88%] transition-transform duration-300 ease-out [transform-style:preserve-3d] [transform:rotateY(var(--ry))_rotateX(var(--rx))]"
        >
          {/* Vastagság: két mögöttes réteg */}
          <div className="absolute inset-0 rounded-[24px] bg-[#0A0A0C] [transform:translateZ(-14px)]" />
          <div className="absolute inset-0 rounded-[24px] bg-[#17181B] [transform:translateZ(-7px)]" />

          <MusicIdCard
            username="zenebolond"
            tierLabel="Hallgató"
            curatorScore={8.1}
            totalRatings={312}
            streak={21}
            bgSlot={<CardBgShowcase covers={covers} />}
            interactive={false}
          />
        </div>
      </div>
      </motion.div>
    </div>
  )
}
