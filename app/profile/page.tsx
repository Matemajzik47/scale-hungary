'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Calendar, QrCode, Share2, Star, Disc3, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTierForRatings } from '@/lib/tiers'
import { MusicIdCard } from '@/components/profile/MusicIdCard'
import { QrCodeShareModal } from '@/components/profile/QrCodeShareModal'
import type { Profile, UserStats } from '@/types/database'

type RatingRow = { score: number; track_id: string }
type TrackRow = { id: string; title: string; album_id: string }
type AlbumRow = { id: string; title: string; cover_url: string | null }

type TopAlbum = {
  albumId: string
  title: string
  coverUrl: string | null
  rating: number
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [curatorScore, setCuratorScore] = useState<number | null>(null)
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: statsData } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setProfile(profileData)
      setStats(
        statsData ?? {
          user_id: user.id,
          total_ratings: 0,
          current_streak: 0,
          last_rated_week: null,
        }
      )

      // Saját rating-ek lekérése a curator score-hoz és a top albumokhoz
      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('score, track_id')
        .eq('user_id', user.id)

      const ratings = (ratingsData as RatingRow[] | null) ?? []

      if (ratings.length > 0) {
        const avg = ratings.reduce((sum, r) => sum + Number(r.score), 0) / ratings.length
        setCuratorScore(avg)

        const trackIds = ratings.map((r) => r.track_id)
        const { data: tracksData } = await supabase
          .from('tracks')
          .select('id, title, album_id')
          .in('id', trackIds)

        const tracksById = new Map<string, TrackRow>()
        for (const t of (tracksData as TrackRow[] | null) ?? []) {
          tracksById.set(t.id, t)
        }

        const albumIds = Array.from(
          new Set(Array.from(tracksById.values()).map((t) => t.album_id))
        )
        const { data: albumsData } = await supabase
          .from('albums')
          .select('id, title, cover_url')
          .in('id', albumIds.length > 0 ? albumIds : [''])

        const albumsById = new Map<string, AlbumRow>()
        for (const a of (albumsData as AlbumRow[] | null) ?? []) {
          albumsById.set(a.id, a)
        }

        // A legmagasabbra értékelt dalok albumonként — a legjobb pontszámú verzió marad,
        // ha több dalt is ratelt ugyanarról az albumról
        const bestByAlbum = new Map<string, TopAlbum>()
        for (const r of ratings) {
          const track = tracksById.get(r.track_id)
          if (!track) continue
          const album = albumsById.get(track.album_id)
          if (!album) continue
          const score = Number(r.score)
          const existing = bestByAlbum.get(album.id)
          if (!existing || score > existing.rating) {
            bestByAlbum.set(album.id, {
              albumId: album.id,
              title: album.title,
              coverUrl: album.cover_url,
              rating: score,
            })
          }
        }

        const top = Array.from(bestByAlbum.values())
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 6)
        setTopAlbums(top)
      }

      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const tier = getTierForRatings(stats?.total_ratings ?? 0)
  const joinedLabel = new Date(profile.created_at).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'short',
  })

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      {/* Fejléc: avatar + username + tier badge */}
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

      {/* Music ID kártya */}
      <MusicIdCard username={profile.username} tierLabel={tier.label} curatorScore={curatorScore} />

      {/* Top ratelt albumok */}
      {topAlbums.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Legmagasabbra értékelt lemezeid
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

      {/* Statisztikák */}
      <section className="grid grid-cols-3 gap-2 pt-0.5">
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-white p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            Értékelések
          </span>
          <span className="font-mono text-base font-black text-neutral-900">
            {stats?.total_ratings ?? 0}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-white p-2.5 text-center shadow-sm">
          <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            <Flame className="h-2.5 w-2.5 text-[#FF5B37]" />
            Sorozat
          </span>
          <span className="font-mono text-base font-black text-[#FF5B37]">
            {stats?.current_streak ?? 0} hét
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

      {/* Profil megosztása */}
      <div className="pb-1 pt-1">
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF5B37] px-5 py-3 text-xs font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(255,91,55,0.3)] transition-all hover:bg-[#F44B26] active:scale-[0.98]"
        >
          <QrCode className="h-4 w-4" />
          <span>Profil megosztása</span>
          <Share2 className="h-3.5 w-3.5 opacity-80" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        Kijelentkezés
      </button>

      <QrCodeShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        username={profile.username}
      />
    </div>
  )
}
