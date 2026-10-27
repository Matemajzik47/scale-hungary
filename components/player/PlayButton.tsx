'use client'

import { Play } from 'lucide-react'
import { usePlayer } from '@/components/player/PlayerProvider'
import type { PlayInput } from '@/components/player/types'

function EqBars() {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      <span className="eq-bar h-full w-[3px] rounded-full bg-current" />
      <span className="eq-bar h-full w-[3px] rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="eq-bar h-full w-[3px] rounded-full bg-current [animation-delay:-0.6s]" />
    </span>
  )
}

type Variant = 'solid' | 'overlay' | 'wide'

// Lejátszás gomb: a dalt a folyamatosan szóló mini lejátszóban indítja, bármelyik oldalról.
export function PlayButton({
  track,
  variant = 'solid',
  className = '',
}: {
  track: PlayInput
  variant?: Variant
  className?: string
}) {
  const { current, playing, play } = usePlayer()

  // Ha biztosan nincs mit lejátszani (helyőrző dal), nem mutatjuk a gombot
  if (track.spotifyTrackId !== undefined && !track.spotifyTrackId && !track.spotifyAlbumId) return null

  const isCurrent = current?.trackId === track.trackId
  const active = isCurrent && playing

  function handleClick(e: React.MouseEvent) {
    // A gomb sokszor linkben van (kártya, sor): ne navigáljon el
    e.preventDefault()
    e.stopPropagation()
    play(track)
  }

  if (variant === 'wide') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full items-center justify-center gap-2 rounded-full bg-[#FF5B37] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,91,55,0.3)] transition hover:bg-[#F44B26] active:scale-[0.98] ${className}`}
      >
        {active ? <EqBars /> : <Play className="h-4 w-4 fill-current" />}
        {isCurrent ? (playing ? 'Szól · szünet' : 'Folytatás') : 'Meghallgatás'}
      </button>
    )
  }

  const look =
    variant === 'overlay'
      ? 'bg-white/90 text-[#FF5B37] shadow-md backdrop-blur-sm hover:bg-white'
      : 'bg-[#FF5B37] text-white shadow-sm hover:bg-[#F44B26]'

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isCurrent && playing ? 'Szünet' : 'Lejátszás'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${look} ${className}`}
    >
      {active ? <EqBars /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
    </button>
  )
}
