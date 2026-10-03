'use client'

import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { Disc3, Sparkles, ArrowRight } from 'lucide-react'
import { RatingControl } from './RatingControl'
import type { DiscoverTrack } from '@/types/discover'

interface DiscoveryCardProps {
  track: DiscoverTrack
  rating: number
  onRatingChange: (val: number) => void
  onSwipe: (direction: 'left' | 'right') => void
}

export function DiscoveryCard({ track, rating, onRatingChange, onSwipe }: DiscoveryCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-10, 10])
  const opacity = useTransform(x, [-250, -150, 0, 150, 250], [0.4, 0.9, 1, 0.9, 0.4])
  const likeOpacity = useTransform(x, [20, 120], [0, 1])
  const skipOpacity = useTransform(x, [-20, -120], [0, 1])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 90 || info.velocity.x > 400) {
      onSwipe('right')
    } else if (info.offset.x < -90 || info.velocity.x < -400) {
      onSwipe('left')
    }
  }

  // Dalszintű beágyazás — a konkrét számot mutatja, nem az egész albumot
  const embedUrl = track.spotify_track_id
    ? `https://open.spotify.com/embed/track/${track.spotify_track_id}?utm_source=generator&theme=0`
    : track.album.spotify_album_id
    ? `https://open.spotify.com/embed/album/${track.album.spotify_album_id}?utm_source=generator&theme=0`
    : null

  return (
    <div className="relative mx-auto w-full max-w-[380px] select-none">
      <div className="absolute left-3 right-3 top-2 -z-10 h-[500px] scale-[0.96] rounded-[24px] bg-neutral-200/60 opacity-70" />
      <div className="absolute left-5 right-5 top-4 -z-20 h-[500px] scale-[0.92] rounded-[24px] bg-neutral-300/40 opacity-40" />

      <motion.div
        style={{ x, rotate, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        className="relative flex cursor-grab flex-col gap-3.5 overflow-hidden rounded-[24px] border border-neutral-200/80 bg-white p-4 shadow-[0_12px_36px_rgba(0,0,0,0.07)] active:cursor-grabbing"
      >
        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute right-6 top-6 z-30 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md rotate-6"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>MENTVE</span>
        </motion.div>

        <motion.div
          style={{ opacity: skipOpacity }}
          className="pointer-events-none absolute left-6 top-6 z-30 flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md -rotate-6"
        >
          <span>KÖVETKEZŐ</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.div>

        <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-neutral-100 shadow-inner">
          {track.album.cover_url ? (
            <img
              src={track.album.cover_url}
              alt={`${track.artist.name} - ${track.album.title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-300">
              <Disc3 className="h-16 w-16" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
            <div className="flex max-w-[85%] items-center gap-1.5 truncate rounded-full border border-white/10 bg-black/40 px-2.5 py-1 backdrop-blur-md">
              <Disc3 className="h-3 w-3 shrink-0 text-[#FF8F68]" />
              <span className="truncate text-[11px] font-medium">{track.album.title}</span>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2 px-0.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-tight text-[#FF5B37]">
              {track.artist.name}
            </p>
            <h3 className="truncate text-lg font-extrabold leading-tight tracking-tight text-neutral-900">
              {track.title}
            </h3>
          </div>
        </div>

        {embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            width="100%"
            height="152"
            style={{ borderRadius: 16, border: 'none' }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[80px] items-center justify-center rounded-2xl bg-neutral-50 text-xs text-neutral-400">
            Nincs elérhető Spotify-előnézet
          </div>
        )}

        <RatingControl rating={rating} onChange={onRatingChange} />
      </motion.div>
    </div>
  )
}
