'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DiscoveryCard } from '@/components/discover/DiscoveryCard'
import { CommunityBadge } from '@/components/discover/CommunityBadge'
import { getIsoWeekString } from '@/lib/week'
import type { DiscoverTrack } from '@/types/discover'

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

type AlbumWithTracksRow = {
  id: string
  title: string
  cover_url: string | null
  spotify_album_id: string | null
  artists: { id: string; name: string } | null
  tracks: { id: string; title: string; spotify_track_id: string | null }[] | null
}

export default function DiscoverPage() {
  // A "deck" egy sor: az első elem a mindenkori aktuális kártya.
  // Jobbra húzás (rate-elés) → a dal véglegesen kikerül a sorból.
  // Balra húzás (skip) → a dal a sor végére kerül, csak a kör végén jön elő újra.
  const [deck, setDeck] = useState<DiscoverTrack[]>([])
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

      // Albumok lekérése a hozzájuk tartozó dalokkal és előadóval együtt
      const { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select('id, title, cover_url, spotify_album_id, artists(id, name), tracks(id, title, spotify_track_id)')
        .order('release_date', { ascending: false })
        .limit(15)

      if (albumsError || !albumsData) {
        setLoading(false)
        return
      }

      // Albumok kilapítása dal-listává — minden dal saját kártya lesz a swipe-flow-ban
      const flatTracks: {
        id: string
        title: string
        spotify_track_id: string | null
        album: { id: string; title: string; cover_url: string | null; spotify_album_id: string | null }
        artist: { id: string; name: string }
      }[] = []

      for (const a of albumsData as unknown as AlbumWithTracksRow[]) {
        const artist = { id: a.artists?.id ?? '', name: a.artists?.name ?? 'Ismeretlen előadó' }
        const album = {
          id: a.id,
          title: a.title,
          cover_url: a.cover_url,
          spotify_album_id: a.spotify_album_id,
        }
        for (const t of a.tracks ?? []) {
          flatTracks.push({
            id: t.id,
            title: t.title,
            spotify_track_id: t.spotify_track_id,
            album,
            artist,
          })
        }
      }

      const trackIds = flatTracks.map((t) => t.id)

      // Rating-ek lekérése az összes dalhoz, hogy kiszámoljuk a közösségi átlagot
      const { data: allRatings } = await supabase
        .from('ratings')
        .select('track_id, score, user_id')
        .in('track_id', trackIds.length > 0 ? trackIds : [''])

      const ratingsByTrack = new Map<string, number[]>()
      const myRatings: Record<string, number> = {}

      for (const r of allRatings ?? []) {
        const list = ratingsByTrack.get(r.track_id) ?? []
        list.push(Number(r.score))
        ratingsByTrack.set(r.track_id, list)
        if (user && r.user_id === user.id) {
          myRatings[r.track_id] = Number(r.score)
        }
      }

      const mapped: DiscoverTrack[] = flatTracks.map((t) => {
        const scores = ratingsByTrack.get(t.id) ?? []
        const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null
        return {
          ...t,
          communityAverage: avg,
          totalRatings: scores.length,
          userRating: myRatings[t.id] ?? null,
        }
      })

      setDeck(mapped.filter((t) => t.userRating === null))
      setRatings(myRatings)
      setLoading(false)
    }

    load()
  }, [])

  const currentTrack = deck[0]
  const currentRating = currentTrack ? ratings[currentTrack.id] ?? 7.5 : 7.5

  const handleRatingChange = useCallback(
    (val: number) => {
      if (!currentTrack) return
      setRatings((prev) => ({ ...prev, [currentTrack.id]: val }))
    },
    [currentTrack]
  )

  async function saveRating(trackId: string, score: number) {
    if (!userId) {
      setSaveStatus('Jelentkezz be a rate-eléshez!')
      return
    }
    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, track_id: trackId, score }, { onConflict: 'user_id,track_id' })

    if (!error) {
      await updateUserStats(userId)
    }

    setSaveStatus(error ? 'Hiba a mentéskor' : 'Mentve!')
    setTimeout(() => setSaveStatus(null), 1500)
  }

  // "Tovább" / balra húzás: a dal a sor végére kerül, nem rate-elődik
  function handleSkip() {
    setDeck((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev))
  }

  // "Előző": a sor visszafelé forgatása — az utoljára hátrakerült dal jön vissza elsőnek
  function handlePrev() {
    setDeck((prev) =>
      prev.length > 1 ? [prev[prev.length - 1], ...prev.slice(0, -1)] : prev
    )
  }

  // Jobbra húzás / Mentés gomb: rate-elés, majd a dal véglegesen kikerül a sorból
  async function handleRateAndRemove() {
    if (!currentTrack) return
    await saveRating(currentTrack.id, currentRating)
    setDeck((prev) => prev.slice(1))
  }

  async function handleSwipe(direction: 'left' | 'right') {
    if (direction === 'right') {
      await handleRateAndRemove()
    } else {
      handleSkip()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  if (deck.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center text-neutral-500">
        <p>Minden friss dalt rate-eltél! 🎉</p>
        <p className="text-sm">Gyere vissza, ha új kiadás kerül a katalógusba.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-between px-4 py-6">
      <div className="relative flex w-full flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack.id}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full"
          >
            <DiscoveryCard
              track={currentTrack}
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
          score={currentTrack.communityAverage}
          totalRatings={currentTrack.totalRatings}
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
            onClick={handleRateAndRemove}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
          >
            Mentés
          </button>

          <button
            type="button"
            onClick={handleSkip}
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
