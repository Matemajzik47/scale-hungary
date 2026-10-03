'use client'

import { Flame, Calendar, Star, Disc3 } from 'lucide-react'
import { getTierForRatings } from '@/lib/tiers'
import { MusicIdCard } from '@/components/profile/MusicIdCard'
import type { ProfileData } from '@/lib/profileData'

interface ProfileDisplayProps {
  data: ProfileData
}

export function ProfileDisplay({ data }: ProfileDisplayProps) {
  const { profile, stats, curatorScore, topAlbums } = data
  const tier = getTierForRatings(stats.total_ratings ?? 0)
  const joinedLabel = new Date(profile.created_at).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'short',
  })

  return (
    <>
      <header className="flex items-center justify-between pb-0.5 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF5B37] via-[#FF8F68] to-neutral-200 p-[2px] shadow-sm">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-black text-neutral-700">
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-extrabold leading-none tracking-tight text-neutral-900">
              {profile.username}
            </h2>
            <span className="mt-0.5 font-mono text-[11px] font-medium text-neutral-500">
              @{profile.username}
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-[#FF5B37]/20 bg-[#FFF5F2] px-2.5 py-1 text-[#FF5B37] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-tight">{tier.label}</span>
        </div>
      </header>

      <MusicIdCard username={profile.username} tierLabel={tier.label} curatorScore={curatorScore} />

      {topAlbums.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Legmagasabbra értékelt lemezei
            </span>
            <span className="text-[10px] font-semibold text-[#FF5B37]">
              {topAlbums.length} kiemelt
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {topAlbums.map((album) => (
              <div
                key={album.albumId}
                className="flex flex-col gap-1.5 rounded-[16px] border border-neutral-200/80 bg-white p-1.5 shadow-sm"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-neutral-100">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-300">
                      <Disc3 className="h-6 w-6" />
                    </div>
                  )}
                  <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full border border-white/10 bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur-sm">
                    <Star className="h-2.5 w-2.5 fill-[#FF8F68] text-[#FF8F68]" />
                    <span>{album.rating.toFixed(1)}</span>
                  </div>
                </div>
                <h4 className="truncate px-0.5 text-[11px] font-bold leading-tight text-neutral-900">
                  {album.title}
                </h4>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2 pt-0.5">
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-white p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            Értékelések
          </span>
          <span className="font-mono text-base font-black text-neutral-900">
            {stats.total_ratings ?? 0}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-white p-2.5 text-center shadow-sm">
          <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            <Flame className="h-2.5 w-2.5 text-[#FF5B37]" />
            Sorozat
          </span>
          <span className="font-mono text-base font-black text-[#FF5B37]">
            {stats.current_streak ?? 0} nap
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-white p-2.5 text-center shadow-sm">
          <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            <Calendar className="h-2.5 w-2.5 text-neutral-400" />
            Csatlakozás
          </span>
          <span className="mt-0.5 font-mono text-xs font-bold text-neutral-800">{joinedLabel}</span>
        </div>
      </section>
    </>
  )
}
