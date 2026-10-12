'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // A főoldalon a header fekete a lap tetején, görgetésre fehérre vált
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const dark = pathname === '/' && !scrolled

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
    <nav
      className={`sticky top-0 z-40 flex items-center justify-between border-b px-6 py-4 transition-colors duration-300 ${
        dark ? 'border-transparent bg-[#111214] text-white' : 'border-gray-200 bg-white text-[#111214]'
      }`}
    >
      <Link href="/" className="text-lg font-semibold">
        Scale
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/discover" className="hover:underline">
          Felfedezés
        </Link>
        {user ? (
          <Link href="/profile" className={`rounded-full px-4 py-2 transition-colors duration-300 ${
              dark ? 'bg-white text-[#111214]' : 'bg-black text-white'
            }`}>
            Profilom
          </Link>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              Bejelentkezés
            </Link>
            <Link href="/register" className={`rounded-full px-4 py-2 transition-colors duration-300 ${
              dark ? 'bg-white text-[#111214]' : 'bg-black text-white'
            }`}>
              Regisztráció
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
