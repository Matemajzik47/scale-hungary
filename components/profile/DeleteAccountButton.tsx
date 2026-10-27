'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Fiók végleges törlése: a felhasználónevet be kell írni a megerősítéshez.
export function DeleteAccountButton({ username }: { username: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmed = typed.trim().toLowerCase() === username.toLowerCase()

  async function handleDelete() {
    if (!confirmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('A munkamenet lejárt, jelentkezz be újra.')

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'A törlés nem sikerült.')

      await supabase.auth.signOut()
      router.push('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A törlés nem sikerült.')
      setBusy(false)
    }
  }

  function close() {
    if (busy) return
    setOpen(false)
    setTyped('')
    setError(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Fiók törlése
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative z-10 flex w-full max-w-[340px] flex-col gap-3 rounded-[26px] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-neutral-900">
                  Biztosan törlöd a fiókod?
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Bezárás"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-neutral-600">
                Ez végleges és nem vonható vissza. Törlődik a profilod, az összes értékelésed, a követéseid és a
                feltöltött kártyaháttered.
              </p>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-700">
                A megerősítéshez írd be a felhasználóneved: <span className="font-mono font-bold">{username}</span>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
                />
              </label>

              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="flex-1 rounded-full border border-neutral-200 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!confirmed || busy}
                  className="flex-1 rounded-full bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? 'Törlés...' : 'Végleges törlés'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
