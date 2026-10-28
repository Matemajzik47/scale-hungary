'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Disc3, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { updateUserStats } from '@/lib/userStats'
import { RatingControl } from '@/components/discover/RatingControl'
import { RequireAuthModal } from '@/components/RequireAuthModal'
import type { PlayerTrack } from '@/components/player/types'

// Gyors értékelés a mini lejátszóból: ugyanaz a csúszka, mint a Felfedezésben, felugró lapon.
export function RateSheet({ track, open, onClose }: { track: PlayerTrack; open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Megnyitáskor megnézzük, be van-e jelentkezve, és volt-e már értékelése
  useEffect(() => {
    if (!open) return
    let cancelled = false
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      let existing: number | null = null
      if (uid) {
        const { data: row } = await supabase
          .from('ratings')
          .select('score')
          .eq('user_id', uid)
          .eq('track_id', track.trackId)
          .maybeSingle()
        if (row) existing = Number(row.score)
      }
      if (cancelled) return
      setUserId(uid)
      if (existing !== null) setRating(existing)
      setChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [open, track.trackId])

  async function handleSave() {
    if (!userId || saving || rating === null) return
    setSaving(true)
    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, track_id: track.trackId, score: rating }, { onConflict: 'user_id,track_id' })
    if (error) {
      setStatus('Hiba a mentéskor')
      setSaving(false)
      return
    }
    await updateUserStats(userId)
    window.dispatchEvent(new CustomEvent('scale:rated', { detail: { trackId: track.trackId, score: rating } }))
    setStatus('Mentve!')
    setSaving(false)
    setTimeout(() => {
      setStatus(null)
      onClose()
    }, 700)
  }

  const guest = open && checked && !userId

  return (
    <>
      <RequireAuthModal
        isOpen={guest}
        onClose={onClose}
        message="A dal értékeléséhez jelentkezz be, vagy hozz létre egy ingyenes Scale fiókot."
      />
      <AnimatePresence>
        {open && !guest && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-white p-5 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] sm:rounded-[28px] sm:pb-5"
            >
              <div className="flex items-center gap-3">
                {track.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.coverUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-300">
                    <Disc3 className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold text-neutral-900">{track.title}</div>
                  <div className="truncate text-xs text-neutral-500">{track.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Bezárás"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <RatingControl rating={rating} onChange={setRating} hint={null} />

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !checked || rating === null}
                className="w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50"
              >
                {status ?? (saving ? 'Mentés...' : 'Mentés')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
