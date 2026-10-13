'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// A Google belépés után ide érkezik vissza a böngésző. A Supabase kliens a címből
// automatikusan beállítja a munkamenetet; ezután eldöntjük, hova menjen tovább:
// van már profil → /profile, nincs → felhasználónév-választás.
export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let finished = false

    async function finish(userId: string) {
      if (finished) return
      finished = true

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      router.replace(profile ? '/profile' : '/auth/username')
    }

    // Ha a szolgáltató hibát küldött vissza (pl. a felhasználó megszakította)
    const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace('#', ''))
    const providerError = params.get('error_description')

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        finish(session.user.id)
      } else if (providerError) {
        setError(providerError)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session.user.id)
    })

    const timeout = setTimeout(() => {
      if (!finished) setError('A bejelentkezés nem sikerült. Próbáld újra.')
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <a href="/login" className="rounded-full bg-black px-4 py-2 text-sm text-white">
          Vissza a bejelentkezéshez
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
      Bejelentkezés...
    </div>
  )
}
