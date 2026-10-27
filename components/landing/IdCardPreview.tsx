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

  const frame = useRef<number | null>(null)

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const el = tiltRef.current
    if (!el || frame.current !== null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX
    const cy = e.clientY
    // Legfeljebb képkockánként egyszer frissítünk (kíméli a gépet)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const x = (cx - rect.left) / rect.width - 0.5
      const y = (cy - rect.top) / rect.height - 0.5
      el.style.setProperty('--ry', `${-9 + x * 10}deg`)
      el.style.setProperty('--rx', `${3 - y * 8}deg`)
    })
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
          {/* Tányér alja: vastagság + narancs fény (a fény csak áttetszőségben pulzál, ez olcsó) */}
          <div className="absolute inset-0 rounded-full bg-[#0B0B0D] shadow-[0_0_28px_rgba(255,91,55,0.4)] [transform:translateZ(-16px)]" />
          <div className="disc-glow absolute inset-0 rounded-full shadow-[0_0_46px_rgba(255,91,55,0.8)] [transform:translateZ(-16px)]" />
          {/* Fényes fekete korong (nem mozog) */}
          <div className="absolute inset-0 rounded-full bg-[#0a0a0b] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" />
          {/* Finom barázdák: a címke körüli üres gyűrűtől a peremig */}
          <div
            className="absolute inset-[1.5%] rounded-full"
            style={{
              background: 'repeating-radial-gradient(circle at center, #0b0b0d 0 1.2px, #17181c 1.2px 2.2px)',
              WebkitMaskImage: 'radial-gradient(circle closest-side, transparent 0 37%, #000 38% 98%, transparent 100%)',
              maskImage: 'radial-gradient(circle closest-side, transparent 0 37%, #000 38% 98%, transparent 100%)',
            }}
          />
          {/* Számhatárok: sima, fényes gyűrűk a barázdák között, ahogy a valódi lemezen */}
          <div
            className="absolute inset-[1.5%] rounded-full"
            style={{
              background:
                'radial-gradient(circle closest-side, transparent 0 51%, rgba(8,8,10,0.92) 51.5% 53.5%, transparent 54% 62%, rgba(8,8,10,0.92) 62.5% 64.2%, transparent 64.7% 73%, rgba(8,8,10,0.92) 73.5% 75.2%, transparent 75.7% 84%, rgba(8,8,10,0.92) 84.5% 86.2%, transparent 86.7%)',
            }}
          />
          {/* Fix fényívek: két átellenes, puha visszatükröződés */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 20deg, transparent 0 10%, rgba(255,255,255,0.3) 17%, rgba(255,255,255,0.07) 22%, transparent 30% 60%, rgba(255,255,255,0.3) 67%, rgba(255,255,255,0.05) 72%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(circle closest-side, transparent 0 35%, #000 40% 100%)',
              maskImage: 'radial-gradient(circle closest-side, transparent 0 35%, #000 40% 100%)',
            }}
          />
          {/* Forgó címke: narancs, kiemelkedő pereme van, rajta kör alakú felirat; csak ez mozog */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="vinyl-spin relative aspect-square w-[33%] rounded-full shadow-[0_0_0_2px_rgba(0,0,0,0.55),0_0_10px_rgba(0,0,0,0.6)] [will-change:transform]">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                <defs>
                  <radialGradient id="lbl" cx="40%" cy="35%" r="75%">
                    <stop offset="0" stopColor="#FF8F68" />
                    <stop offset="1" stopColor="#FF5B37" />
                  </radialGradient>
                  <path id="lblRing" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
                </defs>
                <circle cx="50" cy="50" r="50" fill="url(#lbl)" />
                <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1.4" />
                <circle cx="50" cy="50" r="44.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
                <text fontSize="6.4" fontWeight="800" letterSpacing="1.5" fill="#1a0f0b" fontFamily="var(--font-display), sans-serif">
                  <textPath href="#lblRing" startOffset="0">
                    SCALE · MUSIC TASTE ID · MADE IN HUNGARY ·
                  </textPath>
                </text>
                <g fill="#1a0f0b" fontFamily="var(--font-geist-mono), monospace" fontSize="4.4" fontWeight="700" textAnchor="middle">
                  <text x="50" y="76">STEREO · 33⅓</text>
                  <text x="50" y="83">SCALE-001 · A</text>
                </g>
                <circle cx="50" cy="50" r="15" fill="rgba(0,0,0,0.18)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <ScaleLogo className="h-[30%] w-[30%] !ring-0" />
              </div>
            </div>
          </div>
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
