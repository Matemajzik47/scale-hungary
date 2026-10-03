'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Music } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type RatedTrackRow = {
  score: number
  created_at: string
  track_id: string
  tracks: {
    id: string
    title: string
    spotify_track_id: string | null
    albums: {
      id: string
      title: string
      cover_url: string | null
    } | null
    artists: { id: string; name: string } | null
  } | null
}

type RatedItem = {
  trackId: string
  title: string
  albumTitle: string
  coverUrl: string | null
  artistName: string
  rating: number
  ratedAt: string
}

function formatRatedAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

export default function RatedPage() {
  const [items, setItems] = useState<RatedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('ratings')
        .select(
          'score, created_at, track_id, tracks(id, title, spotify_track_id, albums(id, title, cover_url), artists(id, name))'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error || !data) {
        setLoading(false)
        return
      }

      const mapped: RatedItem[] = (data as unknown as RatedTrackRow[])
        .filter((r) => r.tracks !== null)
        .map((r) => ({
          trackId: r.track_id,
          title: r.tracks!.title,
          albumTitle: r.tracks!.albums?.title ?? '',
          coverUrl: r.tracks!.albums?.cover_url ?? null,
          artistName: r.tracks!.artists?.name ?? 'Ismeretlen előadó',
          rating: Number(r.score),
          ratedAt: formatRatedAt(r.created_at),
        }))

      setItems(mapped)
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

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-neutral-900">Értékelt dalaim</h2>
          <p className="text-xs text-neutral-500">
            {items.length} mentett értékelés a Scale-en
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5B37]/10 text-[#FF5B37]">
          <Star className="h-4 w-4 fill-current" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="my-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-neutral-200/70 bg-white p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <Music className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">Még nem értékeltél dalt</h3>
            <p className="mt-1 max-w-[220px] text-xs text-neutral-500">
              Húzd jobbra a kártyákat a felfedezőben vagy keress rá egy dalra, hogy elkezdj
              rate-elni!
            </p>
            <Link
              href="/discover"
              className="mt-3 inline-block rounded-full bg-[#FF5B37] px-4 py-2 text-xs font-bold text-white"
            >
              Felfedezés indítása
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <Link
              key={item.trackId}
              href="/search"
              className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-12 w-12 rounded-xl border border-neutral-100 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-300">
                    <Music className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-neutral-900">{item.title}</h4>
                  <p className="truncate text-xs font-medium text-neutral-500">
                    {item.artistName}
                  </p>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {item.albumTitle}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-1 rounded-full bg-[#FF5B37] px-2 py-0.5 text-xs font-extrabold text-white shadow-sm">
                  <Star className="h-3 w-3 fill-current" />
                  <span>{item.rating.toFixed(1)}</span>
                </div>
                <span className="text-[9px] text-neutral-400">{item.ratedAt}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
