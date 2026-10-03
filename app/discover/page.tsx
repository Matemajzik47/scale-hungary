'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DiscoveryCard } from '@/components/discover/DiscoveryCard'
import { CommunityBadge } from '@/components/discover/CommunityBadge'
import { getIsoWeekString } from '@/lib/week'
import type { DiscoverAlbum } from '@/types/discover'

async function updateUserStats(userId: string) {
  const { count } = await supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const now = new Date()
  const nowWeek = getIsoWeekString(now)
  const prevWeekDate = new Date(now)
  prevWeekDate.setDate(prevWeekDate.getDate() - 7)
  const prevWeek = getIsoWeekString(prevWeekDate)

  const { data: existingStats } = await supabase
    .from('user_stats')
    .select('current_streak, last_rated_week')
    .eq('user_id', userId)
    .maybeSingle()

  let newStreak = 1
  if (existingStats) {
    if (existingStats.last_rated_week === nowWeek) {
      newStreak = existingStats.current_streak
    } else if (existingStats.last_rated_week === prevWeek) {
      newStreak = existingStats.current_streak + 1
    } else {
      newStreak = 1
    }
  }

  await supabase.from('user_stats').upsert(
    {
      user_id: userId,
      total_ratings: count ?? 0,
      current_streak: newStreak,
      last_rated_week: nowWeek,
    },
    { onConflict: 'user_id' }
  )
}

export default function DiscoverPage() {
  const [albums, setAlbums] = useState<DiscoverAlbum[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      // Albumok lekérése az előadóval összekötve
      const { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select('id, title, cover_url, release_date, release_week, spotify_album_id, artists(id, name)')
        .order('release_date', { ascending: false })
        .limit(30)

      if (albumsError || !albumsData) {
        setLoading(false)
        return
      }

      const albumIds = albumsData.map((a) => a.id)

      // Összes rating lekérése ezekhez az albumokhoz, hogy kiszámoljuk a közösségi átlagot
      const { data: allRatings } = await supabase
        .from('ratings')
        .select('album_id, score, user_id')
        .in('album_id', albumIds)

      const ratingsByAlbum = new Map<string, number[]>()
      const myRatings: Record<string, number> = {}

      for (const r of allRatings ?? []) {
        const list = ratingsByAlbum.get(r.album_id) ?? []
        list.push(Number(r.score))
        ratingsByAlbum.set(r.album_id, list)
        if (user && r.user_id === user.id) {
          myRatings[r.album_id] = Number(r.score)
        }
      }

      type AlbumRow = {
        id: string
        title: string
        cover_url: string | null
        release_date: string | null
        release_week: string | null
        spotify_album_id: string | null
        artists: { id: string; name: string } | null
      }

      const mapped: DiscoverAlbum[] = (albumsData as unknown as AlbumRow[]).map((a) => {
        const scores = ratingsByAlbum.get(a.id) ?? []
        const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null
        return {
          id: a.id,
          title: a.title,
          cover_url: a.cover_url,
          release_date: a.release_date,
          release_week: a.release_week,
          spotify_album_id: a.spotify_album_id,
          artist: { id: a.artists?.id ?? '', name: a.artists?.name ?? 'Ismeretlen előadó' },
          communityAverage: avg,
          totalRatings: scores.length,
          userRating: myRatings[a.id] ?? null,
        }
      })

      setAlbums(mapped)
      setRatings(myRatings)
      setLoading(false)
    }

    load()
  }, [])

  const currentAlbum = albums[currentIndex]
  const currentRating = currentAlbum ? ratings[currentAlbum.id] ?? 7.5 : 7.5

  const handleRatingChange = useCallback(
    (val: number) => {
      if (!currentAlbum) return
      setRatings((prev) => ({ ...prev, [currentAlbum.id]: val }))
    },
    [currentAlbum]
  )

  async function saveRating(albumId: string, score: number) {
    if (!userId) {
      setSaveStatus('Jelentkezz be a rate-eléshez!')
      return
    }
    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, album_id: albumId, score }, { onConflict: 'user_id,album_id' })

    if (!error) {
      await updateUserStats(userId)
    }

    setSaveStatus(error ? 'Hiba a mentéskor' : 'Mentve!')
    setTimeout(() => setSaveStatus(null), 1500)
  }

  function handleNext() {
    setCurrentIndex((prev) => (prev + 1) % albums.length)
  }

  function handlePrev() {
    setCurrentIndex((prev) => (prev - 1 + albums.length) % albums.length)
  }

  async function handleSwipe(direction: 'left' | 'right') {
    if (direction === 'right' && currentAlbum) {
      await saveRating(currentAlbum.id, currentRating)
    }
    handleNext()
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center text-neutral-500">
        <p>Még nincs zene a katalógusban.</p>
        <p className="text-sm">Futtasd le a katalógus-szinkronizációt először.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-between px-4 py-6">
      <div className="relative flex w-full flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAlbum.id}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full"
          >
            <DiscoveryCard
              album={currentAlbum}
              rating={currentRating}
              onRatingChange={handleRatingChange}
              onSwipe={handleSwipe}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex w-full max-w-[380px] flex-col items-center gap-3">
        {saveStatus && <p className="text-xs font-medium text-[#FF5B37]">{saveStatus}</p>}

        <CommunityBadge
          score={currentAlbum.communityAverage}
          totalRatings={currentAlbum.totalRatings}
        />

        <div className="flex w-full items-center justify-between px-2 text-neutral-400">
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-0.5 rounded-full p-1 transition-colors hover:bg-neutral-200/80 hover:text-neutral-700"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[11px] font-medium">Előző</span>
          </button>

          <button
            type="button"
            onClick={() => saveRating(currentAlbum.id, currentRating)}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
          >
            Mentés
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-0.5 rounded-full p-1 transition-colors hover:bg-neutral-200/80 hover:text-neutral-700"
          >
            <span className="text-[11px] font-medium">Tovább</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
