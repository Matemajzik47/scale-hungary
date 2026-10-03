'use client'

import { Sparkles, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'

interface MusicIdCardProps {
  username: string
  tierLabel: string
  curatorScore: number | null
}

export function MusicIdCard({ username, tierLabel, curatorScore }: MusicIdCardProps) {
  return (
    <motion.section
      aria-label="Music ID kártya"
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative w-full overflow-hidden rounded-[22px] border border-neutral-800 bg-gradient-to-br from-[#1E1F24] via-[#16171B] to-[#0F1013] p-4 text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
    >
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-36 w-36 rounded-full bg-[#FF5B37] opacity-15 blur-2xl" />
      <svg
        className="pointer-events-none absolute right-0 top-0 bottom-0 h-full w-36 stroke-white opacity-10"
        viewBox="0 0 100 100"
        fill="none"
      >
        <path d="M10,50 Q25,10 50,50 T90,50" strokeWidth="2" />
        <path d="M0,60 Q30,20 60,60 T100,60" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>

      <div className="mb-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#FF5B37] text-[9px] font-black tracking-tighter text-white">
            SC
          </div>
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-neutral-300">
            SCALE PASS · MUSIC ID
          </span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-neutral-300 backdrop-blur-sm">
          <ShieldCheck className="h-3 w-3" />
          {tierLabel}
        </span>
      </div>

      <div className="my-1 flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-lg font-black tracking-tight text-white">
          @{username}
          <Sparkles className="h-3.5 w-3.5 text-[#FF8F68]" />
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-neutral-400">Saját átlagod:</span>
          <span className="rounded-md bg-[#FF5B37]/15 px-1.5 py-0.5 font-mono font-black text-[#FF8F68]">
            {curatorScore !== null ? curatorScore.toFixed(1) : '–'}
          </span>
        </div>
        <div className="flex h-3.5 items-end gap-[3px] opacity-80">
          <span className="h-2 w-[2px] rounded-full bg-[#FF5B37]" />
          <span className="h-3.5 w-[2px] rounded-full bg-white" />
          <span className="h-2.5 w-[2px] rounded-full bg-[#FF8F68]" />
          <span className="h-3 w-[2px] rounded-full bg-white" />
          <span className="h-1.5 w-[2px] rounded-full bg-[#FF5B37]" />
        </div>
      </div>
    </motion.section>
  )
}
