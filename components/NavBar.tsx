'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Search, Star, User as UserIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ScaleLogo } from '@/components/ScaleLogo'
import type { User } from '@supabase/supabase-js'

const TABS = [
  { href: '/discover', label: 'Felfedezés', icon: Compass },
  { href: '/search', label: 'Keresés', icon: Search },
  { href: '/rated', label: 'Értékeléseim', icon: Star },
] as const

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const onLanding = pathname === '/'
  const dark = onLanding && !scrolled
  const authPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/auth')

  // Menüpontok a felső sávban: nagyobb képernyőn mindenhol, a főoldalon (ahol nincs alsó
  // menü) belépve telefonon is, ikonokkal. Telefonon a többi oldalon az alsó sáv a menü.
  const showTabs = !authPage && (!onLanding || Boolean(user))
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/')

  return (
    <nav
      className={`sticky top-0 z-40 flex items-center justify-between gap-2 border-b px-4 py-3 transition-colors duration-300 sm:px-6 sm:py-4 ${
        dark ? 'border-transparent bg-[#111214] text-white' : 'border-gray-200 bg-white text-[#111214]'
      }`}
    >
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <ScaleLogo className="h-7 w-7" />
        Scale
      </Link>

      {showTabs && (
        <div className={`items-center gap-0.5 text-sm sm:gap-1 ${onLanding ? 'flex' : 'hidden sm:flex'}`}>
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium transition-colors sm:px-3.5 ${
                  active
                    ? dark
                      ? 'bg-white/10 text-[#FF8F68]'
                      : 'bg-[#FF5B37]/10 text-[#FF5B37]'
                    : dark
                      ? 'text-neutral-300 hover:text-white'
                      : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-3 text-sm sm:gap-4">
        {user ? (
          <Link
            href="/profile"
            aria-label="Profilom"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 ${
              dark ? 'bg-white text-[#111214]' : 'bg-black text-white'
            } ${profileActive ? 'ring-2 ring-[#FF5B37] ring-offset-2 ' + (dark ? 'ring-offset-[#111214]' : 'ring-offset-white') : ''}`}
          >
            <UserIcon className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <>
            <Link href="/discover" className={`hover:underline ${showTabs ? 'sm:hidden' : ''}`}>
              Felfedezés
            </Link>
            <Link href="/login" className="hover:underline">
              Bejelentkezés
            </Link>
            <Link
              href="/register"
              className={`rounded-full px-4 py-2 transition-colors duration-300 ${
                dark ? 'bg-white text-[#111214]' : 'bg-black text-white'
              }`}
            >
              Regisztráció
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
