'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search as SearchIcon, Disc3, User as UserIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { updateUserStats } from '@/lib/userStats'
import { RequireAuthModal } from '@/components/RequireAuthModal'
import type { DiscoverTrack } from '@/types/discover'

type AlbumWithTracksRow = {
  id: string
  title: string
  cover_url: string | null
  spotify_album_id: string | null
  artists: { id: string; name: string } | null
  tracks: { id: string; title: string; spotify_track_id: string | null }[] | null
}

type ProfileRow = {
  id: string
  username: string
}

type SearchMode = 'tracks' | 'people'

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>('tracks')

  const [allTracks, setAllTracks] = useState<DiscoverTrack[]>([])
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      // Minden album az összes dalával — a Search oldalon BÁRMELYIK dal elérhető,
      // nem csak a friss/felfedezetlen (ellentétben a Discoverrel)
      const { data: albumsData, error } = await supabase
        .from('albums')
        .select('id, title, cover_url, spotify_album_id, artists(id, name), tracks(id, title, spotify_track_id)')
        .order('release_date', { ascending: false })

      if (!error && albumsData) {
        const flatTracks: {
          id: string
          title: string
          spotify_track_id: string | null
          album: { id: string; title: string; cover_url: string | null; spotify_album_id: string | null }
          artist: { id: string; name: string }
        }[] = []

        for (const a of albumsData as unknown as AlbumWithTracksRow[]) {
          const artist = { id: a.artists?.id ?? '', name: a.artists?.name ?? 'Ismeretlen előadó' }
          const album = {
            id: a.id,
            title: a.title,
            cover_url: a.cover_url,
            spotify_album_id: a.spotify_album_id,
          }
          for (const t of a.tracks ?? []) {
            flatTracks.push({
              id: t.id,
              title: t.title,
              spotify_track_id: t.spotify_track_id,
              album,
              artist,
            })
          }
        }

        const trackIds = flatTracks.map((t) => t.id)

        const { data: allRatings } = await supabase
          .from('ratings')
          .select('track_id, score, user_id')
          .in('track_id', trackIds.length > 0 ? trackIds : [''])

        const ratingsByTrack = new Map<string, number[]>()
        const myRatings: Record<string, number> = {}

        for (const r of allRatings ?? []) {
          const list = ratingsByTrack.get(r.track_id) ?? []
          list.push(Number(r.score))
          ratingsByTrack.set(r.track_id, list)
          if (user && r.user_id === user.id) {
            myRatings[r.track_id] = Number(r.score)
          }
        }

        const mapped: DiscoverTrack[] = flatTracks.map((t) => {
          const scores = ratingsByTrack.get(t.id) ?? []
          const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null
          return {
            ...t,
            communityAverage: avg,
            totalRatings: scores.length,
            userRating: myRatings[t.id] ?? null,
          }
        })

        setAllTracks(mapped)
      }

      // Felhasználók listája a "Felhasználók" fülhöz
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .order('username', { ascending: true })

      setAllProfiles((profilesData as ProfileRow[] | null) ?? [])

      setLoading(false)
    }

    load()
  }, [])

  const filteredTracks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTracks
    return allTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.name.toLowerCase().includes(q) ||
        t.album.title.toLowerCase().includes(q)
    )
  }, [allTracks, query])

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allProfiles
    return allProfiles.filter((p) => p.username.toLowerCase().includes(q))
  }, [allProfiles, query])

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
      setAllTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, userRating: score } : t))
      )
      await updateUserStats(userId)
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

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
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
            Összes dal ({filteredTracks.length})
          </span>

          <div className="flex flex-col gap-2">
            {filteredTracks.map((t) => (
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
                    <h4 className="truncate text-xs font-bold text-neutral-900">{t.title}</h4>
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

            {filteredTracks.length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-400">Nincs találat.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Felhasználók ({filteredProfiles.length})
          </span>

          <div className="flex flex-col gap-2">
            {filteredProfiles.map((p) => (
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

            {filteredProfiles.length === 0 && (
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
