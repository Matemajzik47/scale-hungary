'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchFreshReleases,
  fetchFriendFavorites,
  fetchTopRated,
  fetchTrending,
  type FreshRelease,
  type FriendFavorites,
  type TrackCardData,
} from '@/lib/trending'
import { EmptyBlock, Scroller, SectionHeader, TrendingList } from '@/components/trending/TrendingBlocks'
import { Reveal } from '@/components/landing/Reveal'

const PERIODS = [
  { key: 'week', label: 'Ez a hét', days: 7 },
  { key: 'month', label: 'Hónap', days: 30 },
  { key: 'all', label: 'Mindig', days: 36500 },
] as const

type PeriodKey = (typeof PERIODS)[number]['key']

type PeriodData = {
  period: PeriodKey
  trending: TrackCardData[] | null
  top: TrackCardData[] | null
}

export default function TrendingPage() {
  const [period, setPeriod] = useState<PeriodKey>('week')
  const [periodData, setPeriodData] = useState<PeriodData | null>(null)
  const [fresh, setFresh] = useState<FreshRelease[] | null>(null)
  const [friends, setFriends] = useState<FriendFavorites | 'guest' | null>(null)

  // Időszak szerinti listák (felkapott + legjobbra értékelt)
  useEffect(() => {
    let cancelled = false
    const days = PERIODS.find((p) => p.key === period)!.days
    Promise.all([fetchTrending(days, 10), fetchTopRated(days, 2, 10)]).then(([trending, top]) => {
      if (!cancelled) setPeriodData({ period, trending, top })
    })
    return () => {
      cancelled = true
    }
  }, [period])

  // Friss kiadások és az ismerősök kedvencei (egyszer töltődnek)
  useEffect(() => {
    let cancelled = false
    fetchFreshReleases(12).then((r) => {
      if (!cancelled) setFresh(r)
    })
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        if (!cancelled) setFriends('guest')
        return
      }
      const result = await fetchFriendFavorites(data.user.id)
      if (!cancelled) setFriends(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loadingPeriod = !periodData || periodData.period !== period
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase()

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-4 py-5">
      <Reveal>
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-neutral-900">
              Trending
            </h1>
            <p className="text-sm text-neutral-500">Mit hallgat és értékel most a közösség.</p>
          </div>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  period === p.key
                    ? 'bg-[#111214] text-white'
                    : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Felkapott */}
      <section className={`transition-opacity duration-300 ${loadingPeriod ? 'opacity-50' : 'opacity-100'}`}>
        <SectionHeader eyebrow="Felkapott" title="A legtöbbet értékelt dalok" hint="Ennyien értékelték az időszakban." />
        {!periodData ? (
          <EmptyBlock>Betöltés…</EmptyBlock>
        ) : periodData.trending === null ? (
          <EmptyBlock>A lista most nem tölthető be. Próbáld újra kicsit később.</EmptyBlock>
        ) : periodData.trending.length === 0 ? (
          <EmptyBlock>
            Ebben az időszakban még nincs értékelés.{' '}
            <Link href="/discover" className="font-semibold text-[#FF5B37] underline-offset-2 hover:underline">
              Légy te az első!
            </Link>
          </EmptyBlock>
        ) : (
          <TrendingList items={periodData.trending} periodLabel={periodLabel} />
        )}
      </section>

      {/* Legjobbra értékeltek */}
      <section className={`transition-opacity duration-300 ${loadingPeriod ? 'opacity-50' : 'opacity-100'}`}>
        <SectionHeader
          eyebrow="Toplista"
          title="Legjobbra értékeltek"
          hint="Legalább 2 értékeléssel, átlag szerint."
        />
        {!periodData ? (
          <EmptyBlock>Betöltés…</EmptyBlock>
        ) : !periodData.top || periodData.top.length === 0 ? (
          <EmptyBlock>Még nincs elég értékelés a toplistához. Értékelj te is!</EmptyBlock>
        ) : (
          <Scroller items={periodData.top} ranked />
        )}
      </section>

      {/* Friss kiadások */}
      <section>
        <SectionHeader eyebrow="Új" title="Friss kiadások" hint="A katalógus legújabb albumai." />
        {fresh === null ? (
          <EmptyBlock>Betöltés…</EmptyBlock>
        ) : fresh.length === 0 ? (
          <EmptyBlock>Még nincs album a katalógusban.</EmptyBlock>
        ) : (
          <Scroller
            items={fresh
              .filter((a) => a.firstTrackId)
              .map((a) => ({
                trackId: a.firstTrackId as string,
                title: a.title,
                artist: a.artist,
                coverUrl: a.coverUrl,
                avg: null,
                count: null,
              }))}
          />
        )}
      </section>

      {/* Ismerőseid kedvencei */}
      <section>
        <SectionHeader
          eyebrow="Közösség"
          title="Ismerőseid kedvencei"
          hint="Amit az általad követettek magasra értékeltek."
        />
        {friends === null ? (
          <EmptyBlock>Betöltés…</EmptyBlock>
        ) : friends === 'guest' ? (
          <EmptyBlock>
            <Link href="/login" className="font-semibold text-[#FF5B37] underline-offset-2 hover:underline">
              Jelentkezz be
            </Link>
            , hogy lásd, mit kedvelnek az ismerőseid.
          </EmptyBlock>
        ) : friends.status === 'no-follows' ? (
          <EmptyBlock>
            Még nem követsz senkit.{' '}
            <Link href="/profile/network" className="font-semibold text-[#FF5B37] underline-offset-2 hover:underline">
              Keress ismerősöket
            </Link>
            , és itt megjelennek a kedvenceik.
          </EmptyBlock>
        ) : friends.items.length === 0 ? (
          <EmptyBlock>Az ismerőseid még nem értékeltek magasra egyetlen dalt sem.</EmptyBlock>
        ) : (
          <Scroller items={friends.items} />
        )}
      </section>
    </div>
  )
}
