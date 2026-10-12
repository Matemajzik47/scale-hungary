// Dekoratív példa Music ID kártya a kezdőoldal hero-jához (nem valódi felhasználó).

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
  return (
    <div
      aria-label="Példa Music Taste ID kártya"
      className="relative w-full max-w-[380px] -rotate-3 overflow-hidden rounded-[26px] border border-[#2B2C31] bg-gradient-to-br from-[#1E1F24] to-[#0F1013] p-[22px] text-white shadow-[0_30px_60px_rgba(17,18,20,0.28)]"
    >
      <div className="pointer-events-none absolute -bottom-14 -right-12 h-56 w-56 rounded-full bg-[#FF5B37] opacity-20 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.16em] text-neutral-300">
          <span className="rounded-[7px] bg-[#FF5B37] px-[5px] py-[3px] font-sans text-[10px] font-extrabold text-white">
            SC
          </span>
          SCALE MUSIC TASTE ID
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] text-neutral-300">
          Hallgató
        </span>
      </div>

      <div className="relative z-10 mb-1 mt-6 text-[30px] font-extrabold tracking-tight">
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
        <div aria-hidden="true" className="grid w-[78px] grid-cols-9 gap-[2px] rounded-[10px] bg-white p-1.5">
          {QR_CELLS.map((on, i) => (
            <span
              key={i}
              className={`aspect-square rounded-[1.5px] ${on ? 'bg-[#111214]' : 'bg-white'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
