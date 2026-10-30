'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search as SearchIcon, Disc3, User as UserIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { updateUserStats } from '@/lib/userStats'
import { RequireAuthModal } from '@/components/RequireAuthModal'
import { PlayButton } from '@/components/player/PlayButton'
import type { DiscoverTrack } from '@/types/discover'
import { fetchFeaturedByAlbum, withFeat } from '@/lib/credits'

type SearchRow = {
  track_id: string
  track_title: string
  spotify_track_id: string | null
  album_id: string
  album_title: string
  cover_url: string | null
  spotify_album_id: string | null
  artist_id: string
  artist_name: string
}

const PAGE_SIZE = 30

type ProfileRow = {
  id: string
  username: string
}

type SearchMode = 'tracks' | 'people'

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>('tracks')

  const [tracks, setTracks] = useState<DiscoverTrack[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  // Az utoljára betöltött keresés kulcsa; ha eltér a mostanitól, még töltünk
  const [loadedKey, setLoadedKey] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null)
  const searchKey = `${mode}|${debounced}|${userId ?? ''}`
  const searching = loadedKey !== searchKey
  // A régebbi, lassan megérkező válaszok ne írják felül az újabbat
  const requestSeq = useRef(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // A mini lejátszóból adott értékelés a listában is frissüljön
  useEffect(() => {
    function onRated(e: Event) {
      const { trackId, score } = (e as CustomEvent<{ trackId: string; score: number }>).detail
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, userRating: score } : t)))
    }
    window.addEventListener('scale:rated', onRated)
    return () => window.removeEventListener('scale:rated', onRated)
  }, [])

  // Gépelés közben rövid várakozás, hogy ne minden betűnél menjen kérés
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  // Egy oldalnyi dal a szerverről (az egész katalógusban keres), értékelésekkel
  const fetchTracks = useCallback(
    async (q: string, offset: number, uid: string | null): Promise<{ items: DiscoverTrack[]; more: boolean }> => {
      const { data, error } = await supabase.rpc('search_tracks', { q, lim: PAGE_SIZE, skip: offset })
      if (error || !data) return { items: [], more: false }
      const rows = data as SearchRow[]

      const ratingsByTrack = new Map<string, number[]>()
      const mine: Record<string, number> = {}
      const ids = rows.map((r) => r.track_id)
      if (ids.length > 0) {
        const { data: ratings } = await supabase.from('ratings').select('track_id, score, user_id').in('track_id', ids)
        for (const r of ratings ?? []) {
          const list = ratingsByTrack.get(r.track_id) ?? []
          list.push(Number(r.score))
          ratingsByTrack.set(r.track_id, list)
          if (uid && r.user_id === uid) mine[r.track_id] = Number(r.score)
        }
      }

      const featured = await fetchFeaturedByAlbum(rows.map((r) => r.album_id))

      const items: DiscoverTrack[] = rows.map((r) => {
        const scores = ratingsByTrack.get(r.track_id) ?? []
        return {
          id: r.track_id,
          title: r.track_title,
          spotify_track_id: r.spotify_track_id,
          album: {
            id: r.album_id,
            title: r.album_title,
            cover_url: r.cover_url,
            spotify_album_id: r.spotify_album_id,
          },
          artist: { id: r.artist_id, name: withFeat(r.artist_name, featured.get(r.album_id)) },
          communityAverage: scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
          totalRatings: scores.length,
          userRating: mine[r.track_id] ?? null,
        }
      })
      return { items, more: rows.length === PAGE_SIZE }
    },
    []
  )

  // Új keresés: az eredmény az első oldaltól indul
  useEffect(() => {
    if (mode !== 'tracks') return
    const seq = ++requestSeq.current
    fetchTracks(debounced, 0, userId).then(({ items, more }) => {
      if (seq !== requestSeq.current) return
      setTracks(items)
      setHasMore(more)
      setLoadedKey(searchKey)
    })
  }, [debounced, mode, userId, fetchTracks, searchKey])

  // Felhasználók: szintén szerver oldali szűrés
  useEffect(() => {
    if (mode !== 'people') return
    const seq = ++requestSeq.current
    let req = supabase.from('profiles').select('id, username').order('username', { ascending: true }).limit(50)
    if (debounced) req = req.ilike('username', `%${debounced.replace(/[%_\\]/g, '\\$&')}%`)
    req.then(({ data }) => {
      if (seq !== requestSeq.current) return
      setProfiles((data as ProfileRow[] | null) ?? [])
      setLoadedKey(searchKey)
    })
  }, [debounced, mode, searchKey])

  async function loadMore() {
    setLoadingMore(true)
    const { items, more } = await fetchTracks(debounced, tracks.length, userId)
    setTracks((prev) => {
      const seen = new Set(prev.map((t) => t.id))
      return [...prev, ...items.filter((t) => !seen.has(t.id))]
    })
    setHasMore(more)
    setLoadingMore(false)
  }

  async function handleRate(track: DiscoverTrack, score: number) {
    if (!userId) {
      setAuthModalMessage('A rate-eléshez jelentkezz be, vagy hozz létre egy Scale fiókot.')
      return
    }
    setSavingId(track.id)

    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, track_id: track.id, score }, { onConflict: 'user_id,track_id' })

    if (!error) {
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, userRating: score } : t))
      )
      await updateUserStats(userId)
      window.dispatchEvent(new CustomEvent('scale:rated', { detail: { trackId: track.id, score } }))
    }
    setSavingId(null)
  }

  function handleSelectPeopleTab() {
    if (!userId) {
      setAuthModalMessage('A felhasználók profiljának megtekintéséhez jelentkezz be.')
      return
    }
    setMode('people')
  }

  function handleProfileClick(e: React.MouseEvent) {
    if (!userId) {
      e.preventDefault()
      setAuthModalMessage('A profil megtekintéséhez jelentkezz be.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      {/* Dalok / Felhasználók váltó */}
      <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setMode('tracks')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold transition-all ${
            mode === 'tracks' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          <Disc3 className="h-3.5 w-3.5" />
          Dalok
        </button>
        <button
          type="button"
          onClick={handleSelectPeopleTab}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold transition-all ${
            mode === 'people' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          }`}
        >
          <UserIcon className="h-3.5 w-3.5" />
          Felhasználók
        </button>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === 'tracks' ? 'Előadó, dal vagy album keresése...' : 'Felhasználónév keresése...'
          }
          className="w-full rounded-2xl border border-neutral-200/80 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#FF5B37]/40"
        />
      </div>

      {mode === 'tracks' ? (
        <>
          <span className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {debounced ? `Találatok (${tracks.length}${hasMore ? '+' : ''})` : 'Legfrissebb dalok'}
          </span>

          <div className="flex flex-col gap-2">
            {tracks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {t.album.cover_url ? (
                    <img
                      src={t.album.cover_url}
                      alt={t.title}
                      className="h-11 w-11 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-300">
                      <Disc3 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link href={`/track/${t.id}`} className="block hover:underline">
                      <h4 className="truncate text-xs font-bold text-neutral-900">{t.title}</h4>
                    </Link>
                    <p className="truncate text-[11px] font-medium text-neutral-500">
                      {t.artist.name}
                    </p>
                    <span className="text-[9px] font-semibold text-[#FF5B37]">
                      {t.communityAverage !== null
                        ? `★ ${t.communityAverage.toFixed(1)}`
                        : 'Nincs értékelés még'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <PlayButton
                    track={{
                      trackId: t.id,
                      spotifyTrackId: t.spotify_track_id,
                      spotifyAlbumId: t.album.spotify_album_id,
                      title: t.title,
                      artist: t.artist.name,
                      coverUrl: t.album.cover_url,
                    }}
                    className="h-8 w-8"
                  />
                  {t.userRating !== null && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                      Te: {t.userRating.toFixed(1)}
                    </span>
                  )}
                  <select
                    defaultValue=""
                    disabled={savingId === t.id}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (val) handleRate(t, val)
                      e.currentTarget.value = ''
                    }}
                    className="rounded-full border border-neutral-200/80 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-700"
                  >
                    <option value="" disabled>
                      {t.userRating !== null ? 'Újra' : 'Rate'}
                    </option>
                    {Array.from({ length: 19 }, (_, i) => (1 + i * 0.5).toFixed(1)).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {searching && tracks.length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-400">Keresés...</p>
            )}
            {!searching && tracks.length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-400">Nincs találat.</p>
            )}
            {hasMore && !searching && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mx-auto mt-1 rounded-full bg-neutral-100 px-5 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200/80 disabled:opacity-60"
              >
                {loadingMore ? 'Betöltés...' : 'Továbbiak'}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Felhasználók ({profiles.length})
          </span>

          <div className="flex flex-col gap-2">
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/u/${p.username}`}
                onClick={handleProfileClick}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF5B37] via-[#FF8F68] to-neutral-200 p-[2px]">
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
              </Link>
            ))}

            {!searching && profiles.length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-400">Nincs találat.</p>
            )}
          </div>
        </>
      )}

      <RequireAuthModal
        isOpen={authModalMessage !== null}
        onClose={() => setAuthModalMessage(null)}
        message={authModalMessage ?? undefined}
      />
    </div>
  )
}
