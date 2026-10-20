'use client'

import { useRef } from 'react'
import { ScaleLogo } from '@/components/ScaleLogo'

// Dekoratív példa Music ID kártya a kezdőoldal hero-jához (nem valódi felhasználó).
// 3D-ben lebeg egy mágneskorong fölött; egérrel enyhén követi a kurzort.

const WAVE = [8, 16, 11, 22, 14, 26, 10, 19, 24, 12, 20, 9, 17, 25, 13, 21, 8, 15, 23, 11, 18, 26, 12, 16]

// Determinisztikus, dekoratív QR-szerű minta (SSR/kliens egyezés miatt fix seed)
function buildQrCells(): boolean[] {
  let seed = 7
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const cells: boolean[] = []
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9)
    const c = i % 9
    const corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)
    const inner = (r % 6 === 1 || r === 7) && (c % 6 === 1 || c === 7)
    cells.push(corner ? !inner : rnd() > 0.5)
  }
  return cells
}

const QR_CELLS = buildQrCells()

export function IdCardPreview() {
  const tiltRef = useRef<HTMLDivElement>(null)

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const el = tiltRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--ry', `${-16 + x * 14}deg`)
    el.style.setProperty('--rx', `${6 - y * 12}deg`)
  }

  function onLeave() {
    const el = tiltRef.current
    if (!el) return
    el.style.setProperty('--ry', '-16deg')
    el.style.setProperty('--rx', '6deg')
  }

  return (
    <div
      aria-label="Példa Music Taste ID kártya"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative mx-auto h-[420px] w-full max-w-[400px] [perspective:1200px]"
    >
      {/* Mágneskorong: több rétegű, narancs peremmel és fénnyel */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 h-[110px]" aria-hidden="true">
        <div className="absolute inset-x-[2%] bottom-0 h-[84px] rounded-[50%] bg-[#0B0B0D] shadow-[0_26px_40px_rgba(17,18,20,0.28)]" />
        <div className="absolute inset-x-[2%] bottom-[10px] h-[84px] rounded-[50%] border border-[#33343A] bg-gradient-to-b from-[#2A2B31] to-[#17181B]" />
        <div className="disc-glow absolute inset-x-[9%] bottom-[18px] h-[64px] rounded-[50%] border-2 border-[#FF5B37] bg-[#121316]" />
        <div className="absolute inset-x-[24%] bottom-[28px] h-[42px] rounded-[50%] bg-gradient-to-b from-[#1E1F24] to-[#0B0B0D] shadow-[inset_0_2px_10px_rgba(255,91,55,0.35)]" />
        {/* A kártya vetett árnyéka a koronggal együtt "lélegzik" */}
        <div className="card-shadow absolute inset-x-[26%] bottom-[34px] h-[30px] rounded-[50%] bg-[#FF5B37]/40 blur-xl" />
      </div>

      {/* Lebegő kártya */}
      <div className="card-float absolute inset-x-0 top-0 flex justify-center">
        <div
          ref={tiltRef}
          style={{ '--ry': '-16deg', '--rx': '6deg' } as React.CSSProperties}
          className="relative w-[88%] transition-transform duration-300 ease-out [transform-style:preserve-3d] [transform:rotateY(var(--ry))_rotateX(var(--rx))]"
        >
          {/* Vastagság: két mögöttes réteg */}
          <div className="absolute inset-0 rounded-[26px] bg-[#0A0A0C] [transform:translateZ(-14px)]" />
          <div className="absolute inset-0 rounded-[26px] bg-[#17181B] [transform:translateZ(-7px)]" />

          <div className="relative overflow-hidden rounded-[26px] border border-[#2B2C31] bg-gradient-to-br from-[#1E1F24] to-[#0F1013] p-[22px] text-white shadow-[0_30px_60px_rgba(17,18,20,0.35)]">
            <div className="pointer-events-none absolute -bottom-14 -right-12 h-56 w-56 rounded-full bg-[#FF5B37] opacity-20 blur-3xl" />
            {/* Fényes csík, ami lassan végigsiklik */}
            <div className="card-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.16em] text-neutral-300">
                <ScaleLogo className="h-6 w-6" />
                SCALE MUSIC TASTE ID
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] text-neutral-300">
                Hallgató
              </span>
            </div>

            <div className="relative z-10 mb-1 mt-6 text-[28px] font-extrabold tracking-tight">
              @pelda_felhasznalo
            </div>
            <div className="relative z-10 font-mono text-xs text-neutral-400">
              128 értékelt dal · 14 napos széria
            </div>

            <div className="relative z-10 mt-[18px] flex h-[26px] items-center gap-[3px]">
              {WAVE.map((h, i) => (
                <span
                  key={i}
                  style={{ height: h }}
                  className={`w-[3px] rounded-sm ${i % 3 === 2 ? 'bg-white' : 'bg-[#FF5B37]'}`}
                />
              ))}
            </div>

            <div className="relative z-10 mt-6 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
              <div>
                <span className="mb-1 block font-mono text-[10px] text-neutral-400">Saját átlagod</span>
                <b className="font-mono text-[34px] font-extrabold leading-none text-[#FF8F68]">7.8</b>
              </div>
              <div aria-hidden="true" className="relative w-[78px]">
                <div className="grid grid-cols-9 gap-[2px] rounded-[10px] bg-white p-1.5">
                  {QR_CELLS.map((on, i) => (
                    <span
                      key={i}
                      className={`aspect-square rounded-[1.5px] ${on ? 'bg-[#111214]' : 'bg-white'}`}
                    />
                  ))}
                </div>
                <ScaleLogo className="absolute left-1/2 top-1/2 h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 shadow-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
