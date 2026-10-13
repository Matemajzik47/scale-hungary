'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/

// Egy Google névből / e-mailből javasolt, érvényes felhasználónév
function suggestUsername(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '')
    .slice(0, 24)
  return cleaned.length >= 3 ? cleaned : ''
}

// Az első Google belépés után kell: a Scale profilokhoz (és a QR-kódhoz, /u/név címhez)
// egyedi felhasználónév tartozik.
export default function ChooseUsernamePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (existing) {
        router.replace('/profile')
        return
      }

      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined
      const source = meta?.full_name ?? meta?.name ?? user.email?.split('@')[0] ?? ''
      setUsername(suggestUsername(source))
      setUserId(user.id)
      setLoading(false)
    }

    init()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setError(null)

    const trimmed = username.trim()
    if (!USERNAME_PATTERN.test(trimmed)) {
      setError('3–24 karakter lehet: betűk (ékezet nélkül), számok, pont, kötőjel, aláhúzás.')
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, username: trimmed })

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'Ez a felhasználónév már foglalt, válassz másikat.'
          : 'Nem sikerült a mentés: ' + insertError.message
      )
      setSaving(false)
      return
    }

    router.replace('/profile')
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">Válassz felhasználónevet</h1>
        <p className="mb-6 text-sm text-gray-500">
          Ez lesz a Scale profilod neve és a megosztható Music ID-d címe.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="felhasznalonev"
            autoFocus
            required
            className="rounded-xl border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Mentés...' : 'Tovább'}
          </button>
        </form>
      </div>
    </div>
  )
}
