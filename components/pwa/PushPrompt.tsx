'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell } from 'lucide-react'
import { enablePush, getPushState } from '@/lib/push-client'

const STORAGE_KEY = 'scale-push-prompt'
const MAX_ASKS = 3 // az első kérdés + legfeljebb két újabb
const RE_ASK_AFTER_MS = 3 * 24 * 60 * 60 * 1000

type Saved = { asks: number; last: number; done?: boolean }

function read(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    // a böngésző nem engedi a tárolást: nem kérdezünk
  }
  return { asks: 0, last: 0 }
}

function write(value: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // nem kritikus
  }
}

// Saját, kedves kérdés az értesítésekről az első értékelés után. A böngésző saját engedélykérése
// csak az "Igen" után jön, így a "Most nem" nem tiltja le végleg az értesítéseket.
export function PushPrompt() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checking = useRef(false)

  useEffect(() => {
    async function onRated() {
      if (checking.current) return
      checking.current = true
      try {
        const saved = read()
        if (saved.done || saved.asks >= MAX_ASKS) return
        if (saved.last && Date.now() - saved.last < RE_ASK_AFTER_MS) return
        if ((await getPushState()) !== 'off') return
        // kis késleltetés, hogy a "Mentve!" visszajelzés látszódjon
        setTimeout(() => {
          write({ ...read(), asks: saved.asks + 1, last: Date.now() })
          setOpen(true)
        }, 1200)
      } finally {
        checking.current = false
      }
    }
    window.addEventListener('scale:rated', onRated)
    return () => window.removeEventListener('scale:rated', onRated)
  }, [])

  function later() {
    setOpen(false)
    setError(null)
  }

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const result = await enablePush()
      write({ ...read(), done: true })
      if (result === 'denied') {
        setError('Az értesítések le vannak tiltva a böngészőben. A böngésző beállításaiban engedélyezheted.')
        return
      }
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nem sikerült bekapcsolni.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={later}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-white p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] sm:rounded-[28px] sm:pb-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5B37]/10 text-[#FF5B37]">
              <Bell className="h-6 w-6 fill-current" />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold leading-tight text-neutral-900">
                Szeretnél értesülni a legújabb kiadásokról?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Reggel 8-kor szólunk, ha új magyar szám vár az értékelésedre, vagy ha veszélyben a szériád. Naponta
                legfeljebb egy értesítést küldünk, és bármikor kikapcsolhatod a Profilban.
              </p>
            </div>
            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={accept}
                disabled={busy}
                className="w-full rounded-full bg-[#FF5B37] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,91,55,0.3)] transition hover:bg-[#F44B26] active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? 'Bekapcsolás...' : 'Igen, kérem'}
              </button>
              <button
                type="button"
                onClick={later}
                disabled={busy}
                className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-neutral-500 transition hover:text-neutral-800"
              >
                Most nem
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
