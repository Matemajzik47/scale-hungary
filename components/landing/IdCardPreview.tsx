'use client'

import { useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MusicIdCard } from '@/components/profile/MusicIdCard'

// Példa Music ID kártya a kezdőoldal hero-jához (nem valódi felhasználó). Ugyanazt a kártyát
// használja, mint a profil, így a főoldalon is pontosan ilyet kapsz.
// 3D-ben lebeg egy mágneskorong fölött; egérrel enyhén követi a kurzort.

export function IdCardPreview({ bgUrl }: { bgUrl?: string | null }) {
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
      {/* Mágneskorong: több rétegű, narancs peremmel és fénnyel */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.8, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-x-0 bottom-2 h-[110px]"
        aria-hidden="true"
      >
        <div className="absolute inset-x-[2%] bottom-0 h-[84px] rounded-[50%] bg-[#0B0B0D] shadow-[0_26px_40px_rgba(17,18,20,0.28)]" />
        <div className="absolute inset-x-[2%] bottom-[10px] h-[84px] rounded-[50%] border border-[#33343A] bg-gradient-to-b from-[#2A2B31] to-[#17181B]" />
        <div className="disc-glow absolute inset-x-[9%] bottom-[18px] h-[64px] rounded-[50%] border-2 border-[#FF5B37] bg-[#121316]" />
        <div className="absolute inset-x-[24%] bottom-[28px] h-[42px] rounded-[50%] bg-gradient-to-b from-[#1E1F24] to-[#0B0B0D] shadow-[inset_0_2px_10px_rgba(255,91,55,0.35)]" />
        {/* A kártya vetett árnyéka a koronggal együtt "lélegzik" */}
        <div className="card-shadow absolute inset-x-[26%] bottom-[34px] h-[30px] rounded-[50%] bg-[#FF5B37]/40 blur-xl" />
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
            bgUrl={bgUrl}
            interactive={false}
            autoSheen
          />
        </div>
      </div>
      </motion.div>
    </div>
  )
}
