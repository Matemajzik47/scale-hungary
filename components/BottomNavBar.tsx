'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Search, Star, User } from 'lucide-react'

const TABS = [
  { href: '/discover', label: 'Felfedezés', icon: Compass },
  { href: '/search', label: 'Keresés', icon: Search },
  { href: '/rated', label: 'Értékeléseim', icon: Star },
  { href: '/profile', label: 'Profil', icon: User },
] as const

export default function BottomNavBar() {
  const pathname = usePathname()

  // Auth oldalakon és a főoldalon ne jelenjen meg az alsó navigáció
  const hiddenOn = ['/login', '/register']
  if (hiddenOn.includes(pathname) || pathname === '/') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-neutral-200/70 bg-white/95 px-4 py-2 backdrop-blur-md sm:sticky">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center justify-center rounded-2xl px-3 py-1 transition-all ${
              isActive ? 'text-[#FF5B37]' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {isActive && (
              <span className="absolute inset-0 -z-10 rounded-2xl bg-[#FF5B37]/10" />
            )}
            <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
            <span className={`mt-0.5 text-[10px] font-medium tracking-tight ${isActive ? 'font-bold' : ''}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
