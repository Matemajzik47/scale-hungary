'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Search as SearchIcon, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeMatches, listConnections, type PersonRow, type TasteMatch } from '@/lib/social'
import { RequireAuthModal } from '@/components/RequireAuthModal'

type Tab = 'following' | 'followers'

export default function NetworkPage() {
  const [tab, setTab] = useState<Tab>('following')
  const [lists, setLists] = useState<Record<Tab, PersonRow[]>>({ following: [], followers: [] })
  const [matches, setMatches] = useState<Record<string, TasteMatch>>({})
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }

      const [following, followers] = await Promise.all([
        listConnections(user.id, 'following'),
        listConnections(user.id, 'followers'),
      ])

      const allIds = Array.from(new Set([...following, ...followers].map((p) => p.id)))
      const matchMap = await computeMatches(user.id, allIds)

      setLists({ following, followers })
      setMatches(matchMap)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  if (needsAuth) {
    return (
      <RequireAuthModal
        isOpen
        message="Az ismerőseid megtekintéséhez jelentkezz be, vagy hozz létre egy Scale fiókot."
      />
    )
  }

  const visible = lists[tab]

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          aria-label="Vissza a profilhoz"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-base font-extrabold text-neutral-900">Ismerőseim</h2>
      </div>

      <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 p-1">
        {(
          [
            { key: 'following', label: `Követem (${lists.following.length})` },
            { key: 'followers', label: `Követőim (${lists.followers.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-bold transition-all ${
              tab === t.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="my-4 flex flex-col items-center gap-3 rounded-3xl border border-neutral-200/70 bg-white p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">
              {tab === 'following' ? 'Még nem követsz senkit' : 'Még nem követ senki'}
            </h3>
            <p className="mt-1 max-w-[230px] text-xs text-neutral-500">
              {tab === 'following'
                ? 'Keress rá felhasználókra a Keresés fülön, és kövesd az ízlésüket.'
                : 'Oszd meg a profilodat a QR-kóddal, hogy az ismerőseid megtaláljanak.'}
            </p>
            {tab === 'following' && (
              <Link
                href="/search"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FF5B37] px-4 py-2 text-xs font-bold text-white"
              >
                <SearchIcon className="h-3.5 w-3.5" />
                Felhasználók keresése
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((p) => {
            const m = matches[p.id]
            return (
              <Link
                key={p.id}
                href={`/u/${p.username}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF5B37] via-[#FF8F68] to-neutral-200 p-[2px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-black text-neutral-700">
                      {p.username.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-xs font-bold text-neutral-900">{p.username}</h4>
                    <span className="truncate font-mono text-[11px] text-neutral-400">
                      @{p.username}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-[#FFF5F2] px-2.5 py-1 text-right">
                  <div className="font-mono text-xs font-black text-[#FF5B37]">
                    {m?.percent != null ? `${m.percent}%` : '–'}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-tight text-neutral-400">
                    egyezés
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
