'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DiscoveryCard } from '@/components/discover/DiscoveryCard'
import { CommunityBadge } from '@/components/discover/CommunityBadge'
import { updateUserStats } from '@/lib/userStats'
import { RequireAuthModal } from '@/components/RequireAuthModal'
import type { DiscoverTrack } from '@/types/discover'

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
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Fisher–Yates shuffle — a régi katalógusból érkező fallback dalok
  // teljesen véletlenszerű sorrendben kerüljenek a deckbe
  function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  /**
   * Albumok (adott id-kra szűkítve, vagy mind) lekérése dalokkal, előadóval
   * és a rating-ekkel együtt — DiscoverTrack listává alakítva.
   */
  async function fetchTracksForAlbums(
    albumIds: string[] | null,
    currentUserId: string | null
  ): Promise<DiscoverTrack[]> {
    let query = supabase
      .from('albums')
      .select('id, title, cover_url, spotify_album_id, artists(id, name), tracks(id, title, spotify_track_id)')

    if (albumIds) {
      query = query.in('id', albumIds.length > 0 ? albumIds : [''])
    } else {
      query = query.order('release_date', { ascending: false }).limit(15)
    }

    const { data: albumsData, error } = await query
    if (error || !albumsData) return []

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
      if (currentUserId && r.user_id === currentUserId) {
        myRatings[r.track_id] = Number(r.score)
      }
    }

    return flatTracks.map((t) => {
      const scores = ratingsByTrack.get(t.id) ?? []
      const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null
      return {
        ...t,
        communityAverage: avg,
        totalRatings: scores.length,
        userRating: myRatings[t.id] ?? null,
      }
    })
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const currentUserId = user?.id ?? null
      setUserId(currentUserId)

      // 1. Friss (legutóbbi 15 album) kiadások — elsődleges forrás
      const recentTracks = await fetchTracksForAlbums(null, currentUserId)
      const unratedRecent = recentTracks.filter((t) => t.userRating === null)

      let finalDeck = unratedRecent
      const myRatings: Record<string, number> = {}
      for (const t of recentTracks) {
        if (t.userRating !== null) myRatings[t.id] = t.userRating
      }

      // 2. Fallback: ha a friss kiadásokból kifogyott a még nem ratelt anyag,
      // hozzunk be véletlenszerűen régi, még nem ratelt dalokat is a teljes
      // katalógusból, hogy sose fogyjon ki a deck
      if (unratedRecent.length === 0) {
        const { data: allAlbumIdsData } = await supabase.from('albums').select('id')
        const allAlbumIds = (allAlbumIdsData ?? []).map((a) => a.id)

        if (allAlbumIds.length > 0) {
          const allTracks = await fetchTracksForAlbums(allAlbumIds, currentUserId)
          const unratedAll = allTracks.filter((t) => t.userRating === null)
          finalDeck = shuffle(unratedAll)

          for (const t of allTracks) {
            if (t.userRating !== null) myRatings[t.id] = t.userRating
          }
        }
      }

      setDeck(finalDeck)
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

  // Igaz, ha a mentés sikerült — a hívó csak ekkor veszi ki a dalt a sorból
  async function saveRating(trackId: string, score: number): Promise<boolean> {
    if (!userId) return false

    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, track_id: trackId, score }, { onConflict: 'user_id,track_id' })

    if (!error) {
      await updateUserStats(userId)
    }

    setSaveStatus(error ? 'Hiba a mentéskor' : 'Mentve!')
    setTimeout(() => setSaveStatus(null), 1500)
    return !error
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
  // Kijelentkezve a dal marad a helyén (a vendég tovább próbálgathatja),
  // és felugrik a bejelentkezési popup.
  async function handleRateAndRemove() {
    if (!currentTrack) return
    if (!userId) {
      setShowAuthModal(true)
      return
    }
    const ok = await saveRating(currentTrack.id, currentRating)
    if (ok) setDeck((prev) => prev.slice(1))
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
        <p>Az egész katalógust rate-elted! 🎉</p>
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

      <RequireAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="A dal értékeléséhez jelentkezz be, vagy hozz létre egy ingyenes Scale fiókot. Addig nyugodtan hallgass bele és próbálgasd a csúszkát!"
      />
    </div>
  )
}
