'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DiscoveryCard } from '@/components/discover/DiscoveryCard'
import { CommunityBadge } from '@/components/discover/CommunityBadge'
import { updateUserStats } from '@/lib/userStats'
import { RequireAuthModal } from '@/components/RequireAuthModal'
import {
  DECK_BATCH,
  addSkip,
  clearSkips,
  deckSeed,
  fetchDeckBatch,
  getSkippedIds,
  removeSkip,
  spaceOut,
} from '@/lib/discover-deck'
import type { DiscoverTrack } from '@/types/discover'

// Ennyi dal alatt kérjük a következő adagot a szervertől, hogy sose fogyjon ki a sor
const REFILL_AT = 6

export default function DiscoverPage() {
  // A sor első eleme a mindenkori aktuális kártya. A szerver adagonként adja a dalokat
  // (friss, közelmúlt, alig értékelt régebbi, meglepetés), és ha fogy a sor, automatikusan töltődik.
  // Jobbra húzás (rate-elés) → a dal véglegesen kikerül. Balra húzás (kihagyás) → a dal 24 órára
  // eltűnik (frissítés után sem jön vissza), és csak akkor kerül elő, ha minden más elfogyott.
  const [deck, setDeck] = useState<DiscoverTrack[]>([])
  const [skipped, setSkipped] = useState<DiscoverTrack[]>([])
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [exhausted, setExhausted] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const seenIds = useRef<Set<string>>(new Set())
  const fetching = useRef(false)
  const seed = useRef('guest')
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flash = useCallback((text: string, ms = 1500) => {
    setSaveStatus(text)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setSaveStatus(null), ms)
  }, [])

  // A következő adag lekérése. Kizárjuk, ami már a sorban van, ami már volt, és a 24 órán belül kihagyottakat.
  const loadMore = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    try {
      let skippedIds = getSkippedIds()
      let batch = await fetchDeckBatch([...seenIds.current, ...skippedIds], seed.current, DECK_BATCH)

      // Ha csak a kihagyottak miatt nincs több dal, azok újra számítanak
      if (batch && batch.length === 0 && skippedIds.length > 0) {
        clearSkips()
        skippedIds = []
        batch = await fetchDeckBatch([...seenIds.current], seed.current, DECK_BATCH)
      }

      if (batch === null) {
        setLoadError(true)
        return
      }
      setLoadError(false)

      const fresh = batch.filter((t) => !seenIds.current.has(t.id))
      for (const t of fresh) seenIds.current.add(t.id)
      if (fresh.length === 0) {
        setExhausted(true)
        return
      }
      setDeck((prev) => [...prev, ...spaceOut(fresh, prev.slice(-6))])
    } finally {
      fetching.current = false
    }
  }, [])

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
      seed.current = deckSeed(user?.id ?? null)
      await loadMore()
      setLoading(false)
    }
    void init()
  }, [loadMore])

  // Folyamatos utántöltés: ha fogy a sor, kérjük a következő adagot
  useEffect(() => {
    if (loading || exhausted || loadError) return
    if (deck.length <= REFILL_AT) void loadMore()
  }, [deck.length, loading, exhausted, loadError, loadMore])

  // Ha minden elfogyott, a kihagyott dalok újra végignézhetők
  function reviewSkipped(list: DiscoverTrack[]) {
    clearSkips()
    setDeck(list)
    setSkipped([])
  }

  const currentTrack = deck[0]
  const currentRating = currentTrack ? (ratings[currentTrack.id] ?? null) : null

  const handleRatingChange = useCallback(
    (val: number) => {
      if (!currentTrack) return
      setRatings((prev) => ({ ...prev, [currentTrack.id]: val }))
    },
    [currentTrack]
  )

  // Igaz, ha a mentés sikerült: a hívó csak ekkor veszi ki a dalt a sorból
  async function saveRating(trackId: string, score: number): Promise<boolean> {
    if (!userId) return false

    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, track_id: trackId, score }, { onConflict: 'user_id,track_id' })

    if (!error) {
      await updateUserStats(userId)
      window.dispatchEvent(new CustomEvent('scale:rated', { detail: { trackId, score } }))
    }

    flash(error ? 'Hiba a mentéskor' : 'Mentve!')
    return !error
  }

  // "Tovább" / balra húzás: a dal kikerül a sorból, és 24 órára nem jön vissza
  function handleSkip() {
    if (!currentTrack) return
    const track = currentTrack
    addSkip(track.id)
    const nextDeck = deck.slice(1)
    const nextSkipped = [...skipped, track]
    // Ha ez volt az utolsó dal, a kihagyottak újra sorra kerülnek
    if (nextDeck.length === 0 && exhausted) {
      reviewSkipped(nextSkipped)
    } else {
      setDeck(nextDeck)
      setSkipped(nextSkipped)
    }
  }

  // "Előző": az utoljára kihagyott dal jön vissza elsőnek
  function handlePrev() {
    if (skipped.length === 0) return
    const last = skipped[skipped.length - 1]
    removeSkip(last.id)
    setSkipped((prev) => prev.slice(0, -1))
    setDeck((prev) => [last, ...prev])
  }

  // Jobbra húzás / Mentés gomb: rate-elés, majd a dal véglegesen kikerül a sorból.
  // A pontszámot a csúszka megmozdításával kell megadni, enélkül nem menthető.
  // Kijelentkezve a dal marad a helyén, és felugrik a bejelentkezési popup.
  async function handleRateAndRemove() {
    if (!currentTrack) return
    if (currentRating === null) {
      flash('Előbb állítsd be a pontszámot a csúszkával!', 2200)
      return
    }
    if (!userId) {
      setShowAuthModal(true)
      return
    }
    const ok = await saveRating(currentTrack.id, currentRating)
    if (!ok) return
    const nextDeck = deck.slice(1)
    if (nextDeck.length === 0 && exhausted && skipped.length > 0) {
      reviewSkipped(skipped)
    } else {
      setDeck(nextDeck)
    }
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
    if (loadError) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center text-neutral-500">
          <p>Most nem sikerült betölteni a dalokat.</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(false)
              void loadMore()
            }}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
          >
            Újra próbálom
          </button>
        </div>
      )
    }
    if (!exhausted) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
          Betöltés...
        </div>
      )
    }
    if (skipped.length > 0) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center text-neutral-500">
          <p>Mára ennyi új dal volt.</p>
          <p className="text-sm">A kihagyott dalokat újra végignézheted.</p>
          <button
            type="button"
            onClick={() => reviewSkipped(skipped)}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
          >
            Kihagyottak újra
          </button>
        </div>
      )
    }
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center text-neutral-500">
        <p>Az egész katalógust értékelted! 🎉</p>
        <p className="text-sm">Gyere vissza, ha új kiadás kerül a katalógusba.</p>
      </div>
    )
  }

  // Az oldal pontosan a képernyő magasságához igazodik (a fejléc és az alsó menü
  // levonásával), hogy a teljes felfedezés görgetés nélkül elférjen telefonon is.
  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-[420px] flex-col items-center gap-2 px-4 pb-1 pt-2">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack.id}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="h-full w-full"
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

      <div className="flex w-full max-w-[380px] shrink-0 flex-col items-center gap-1.5">
        <div className="flex w-full items-center justify-between gap-2">
          <CommunityBadge
            score={currentTrack.communityAverage}
            totalRatings={currentTrack.totalRatings}
          />
          {saveStatus ? (
            <span className="text-[11px] font-semibold text-[#FF5B37]">{saveStatus}</span>
          ) : (
            <Link
              href={`/track/${currentTrack.id}`}
              className="shrink-0 text-[11px] font-semibold text-neutral-400 underline-offset-2 transition hover:text-neutral-700 hover:underline"
            >
              Részletek ›
            </Link>
          )}
        </div>

        <div className="flex w-full items-center justify-between px-2 text-neutral-400">
          <button
            type="button"
            onClick={handlePrev}
            disabled={skipped.length === 0}
            className="flex items-center gap-0.5 rounded-full p-1 transition-colors hover:bg-neutral-200/80 hover:text-neutral-700 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[11px] font-medium">Előző</span>
          </button>

          <button
            type="button"
            onClick={handleRateAndRemove}
            className={`rounded-full px-5 py-2 text-xs font-semibold text-white transition ${
              currentRating === null ? 'bg-neutral-400 hover:bg-neutral-500' : 'bg-black hover:bg-gray-800'
            }`}
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
