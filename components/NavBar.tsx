'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
      <Link href="/" className="text-lg font-semibold">
        Scale
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <Link href="/profile" className="rounded-full bg-black px-4 py-2 text-white">
            Profilom
          </Link>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              Bejelentkezés
            </Link>
            <Link href="/register" className="rounded-full bg-black px-4 py-2 text-white">
              Regisztráció
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
