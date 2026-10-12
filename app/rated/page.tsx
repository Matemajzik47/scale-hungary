'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Music } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RequireAuthModal } from '@/components/RequireAuthModal'

type RatingRow = {
  score: number
  created_at: string
  track_id: string
}

type TrackRow = {
  id: string
  title: string
  album_id: string
}

type AlbumRow = {
  id: string
  title: string
  cover_url: string | null
  artist_id: string
}

type ArtistRow = {
  id: string
  name: string
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
  const [loggedOut, setLoggedOut] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoggedOut(true)
        setLoading(false)
        return
      }

      // 1. lépés: a user saját rating-jei (dal-azonosítóval)
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('score, created_at, track_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (ratingsError || !ratingsData || ratingsData.length === 0) {
        setLoading(false)
        return
      }

      const ratings = ratingsData as RatingRow[]
      const trackIds = ratings.map((r) => r.track_id)

      // 2. lépés: a hozzájuk tartozó dalok (cím + album_id)
      const { data: tracksData } = await supabase
        .from('tracks')
        .select('id, title, album_id')
        .in('id', trackIds)

      const tracksById = new Map<string, TrackRow>()
      for (const t of (tracksData as TrackRow[] | null) ?? []) {
        tracksById.set(t.id, t)
      }

      const albumIds = Array.from(new Set(Array.from(tracksById.values()).map((t) => t.album_id)))

      // 3. lépés: az albumok (borító + artist_id)
      const { data: albumsData } = await supabase
        .from('albums')
        .select('id, title, cover_url, artist_id')
        .in('id', albumIds.length > 0 ? albumIds : [''])

      const albumsById = new Map<string, AlbumRow>()
      for (const a of (albumsData as AlbumRow[] | null) ?? []) {
        albumsById.set(a.id, a)
      }

      const artistIds = Array.from(
        new Set(Array.from(albumsById.values()).map((a) => a.artist_id))
      )

      // 4. lépés: az előadók
      const { data: artistsData } = await supabase
        .from('artists')
        .select('id, name')
        .in('id', artistIds.length > 0 ? artistIds : [''])

      const artistsById = new Map<string, ArtistRow>()
      for (const ar of (artistsData as ArtistRow[] | null) ?? []) {
        artistsById.set(ar.id, ar)
      }

      // Összefűzés egy listává
      const mapped: RatedItem[] = ratings
        .map((r) => {
          const track = tracksById.get(r.track_id)
          if (!track) return null
          const album = albumsById.get(track.album_id)
          const artist = album ? artistsById.get(album.artist_id) : undefined
          return {
            trackId: r.track_id,
            title: track.title,
            albumTitle: album?.title ?? '',
            coverUrl: album?.cover_url ?? null,
            artistName: artist?.name ?? 'Ismeretlen előadó',
            rating: Number(r.score),
            ratedAt: formatRatedAt(r.created_at),
          }
        })
        .filter((item): item is RatedItem => item !== null)

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

      <RequireAuthModal
        isOpen={loggedOut}
        message="Az értékelt dalaid megtekintéséhez jelentkezz be, vagy hozz létre egy Scale fiókot."
      />
    </div>
  )
}
