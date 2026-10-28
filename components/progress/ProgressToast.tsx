'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Disc3, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchProgress } from '@/lib/progress'

type Toast = {
  id: number
  gained: number
  levelUp: { level: number; title: string } | null
}

/**
 * Globális visszajelzés értékelés után: "+10 XP", szintlépéskor külön üzenet.
 * Minden értékelő felület a `scale:rated` eseményt küldi, ezért itt egy helyen kezelhető.
 */
export function ProgressToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const userId = useRef<string | null>(null)
  const last = useRef<{ xp: number; level: number } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counter = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function prime(uid: string) {
      const p = await fetchProgress(uid)
      if (!cancelled && userId.current === uid) last.current = p ? { xp: p.xp, level: p.level.level } : null
    }

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null
      userId.current = uid
      if (uid) void prime(uid)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null
      if (uid !== userId.current) {
        userId.current = uid
        last.current = null
        if (uid) void prime(uid)
      }
    })

    async function onRated() {
      const uid = userId.current
      if (!uid) return
      const p = await fetchProgress(uid)
      if (!p || userId.current !== uid) return
      const before = last.current
      last.current = { xp: p.xp, level: p.level.level }
      if (before === null) return
      const gained = p.xp - before.xp
      if (gained <= 0) return

      const levelUp = p.level.level > before.level ? { level: p.level.level, title: p.level.title } : null

      counter.current += 1
      setToast({ id: counter.current, gained, levelUp })
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setToast(null), levelUp ? 4500 : 2600)
    }

    window.addEventListener('scale:rated', onRated)
    return () => {
      cancelled = true
      window.removeEventListener('scale:rated', onRated)
      sub.subscription.unsubscribe()
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="flex flex-col items-center gap-1 rounded-2xl bg-neutral-900 px-4 py-2.5 text-white shadow-xl"
            role="status"
          >
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-[#FF8F68]">+{toast.gained} XP</span>
              <span className="flex items-center gap-1 text-neutral-200">
                <Disc3 className="h-3.5 w-3.5 text-[#FF8F68]" />+{toast.gained} kredit
              </span>
            </div>
            {toast.levelUp && (
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Sparkles className="h-3.5 w-3.5 text-[#FF5B37]" />
                Szintlépés! {toast.levelUp.level}. szint · {toast.levelUp.title}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
