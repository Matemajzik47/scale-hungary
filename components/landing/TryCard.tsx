'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Disc3 } from 'lucide-react'
import { RequireAuthModal } from '@/components/RequireAuthModal'

export type TryTrack = {
  title: string
  artist: string
  coverUrl: string | null
  communityAverage: number | null
  totalRatings: number
}

// Kipróbálható értékelő kártya vendégeknek: a csúszka mozog, a mentésnél popup jön.
export function TryCard({ track }: { track: TryTrack | null }) {
  const [score, setScore] = useState(7.5)
  const [authOpen, setAuthOpen] = useState(false)
  const pct = ((score - 1) / 9) * 100

  return (
    <div className="w-full max-w-[420px] justify-self-center rounded-[30px] border border-[#E6E3DF] bg-[#F6F4F1] p-5">
      <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[#111214]">
        {track?.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverUrl} alt={track.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <Disc3 className="h-16 w-16" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-[22px] font-extrabold tracking-tight text-[#111214]">
          {track?.title ?? 'Hamarosan dalok'}
        </h3>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-[#5F6064]">
        {track ? track.artist : 'A katalógus épül'}
        {track && track.communityAverage !== null && (
          <>
            {' '}· közösség: <b className="text-[#FF5B37]">{track.communityAverage.toFixed(1)}</b> (
            {track.totalRatings})
          </>
        )}
      </p>

      <div className="mt-[18px] flex items-center gap-3.5">
        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          aria-label="Pontszám"
          style={{
            background: `linear-gradient(90deg,#FF5B37 ${pct}%,#E6E3DF ${pct}%)`,
          }}
          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-[#FF5B37] [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-[#FF5B37] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        />
        <output className="min-w-[3.4ch] text-right font-mono text-[40px] font-extrabold tabular-nums text-[#111214]">
          {score.toFixed(1)}
        </output>
      </div>

      <div className="mt-[18px] flex items-center justify-between gap-2">
        <Link href="/discover" className="p-2 text-[13px] text-[#5F6064] hover:text-[#111214]">
          Tovább a felfedezőhöz ›
        </Link>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="rounded-full bg-[#111214] px-[18px] py-2.5 text-[13px] font-bold text-white transition hover:bg-neutral-800 active:scale-95"
        >
          Mentés
        </button>
      </div>

      <RequireAuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        message="A dal értékeléséhez jelentkezz be, vagy hozz létre egy ingyenes Scale fiókot. Addig nyugodtan hallgass bele és próbálgasd a csúszkát!"
      />
    </div>
  )
}
