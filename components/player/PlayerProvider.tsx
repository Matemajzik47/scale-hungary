'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Star, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { loadSpotifyApi, type SpotifyController } from '@/lib/spotify-embed'
import { RateSheet } from '@/components/player/RateSheet'
import type { PlayInput, PlayerTrack } from '@/components/player/types'

type PlayerContextValue = {
  current: PlayerTrack | null
  playing: boolean
  play: (input: PlayInput) => void
}

const noop = () => {}
const PlayerContext = createContext<PlayerContextValue>({ current: null, playing: false, play: noop })

export function usePlayer() {
  return useContext(PlayerContext)
}

// Ezeken az oldalakon nincs mini lejátszó (ott saját lejátszó vagy más felület van)
function isHiddenRoute(pathname: string) {
  return pathname === '/' || pathname === '/discover' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/auth')
}

type TrackLookup = {
  id: string
  title: string
  spotify_track_id: string | null
  albums: { cover_url: string | null; spotify_album_id: string | null; artists: { name: string } | null } | null
}

function toUri(t: PlayerTrack): string | null {
  if (t.spotifyTrackId) return `spotify:track:${t.spotifyTrackId}`
  if (t.spotifyAlbumId) return `spotify:album:${t.spotifyAlbumId}`
  return null
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [current, setCurrent] = useState<PlayerTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [rateOpen, setRateOpen] = useState(false)

  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<SpotifyController | null>(null)
  const creatingRef = useRef(false)
  const pendingUriRef = useRef<string | null>(null)
  const currentRef = useRef<PlayerTrack | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  const showNotice = useCallback((text: string) => {
    setNotice(text)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 2800)
  }, [])

  // Egy Spotify-azonosítót tölt be és indít. Az első híváskor létrehozza a lejátszót.
  const startUri = useCallback(
    async (uri: string) => {
      const existing = controllerRef.current
      if (existing) {
        existing.loadUri(uri)
        existing.play()
        return
      }
      pendingUriRef.current = uri
      if (creatingRef.current) return
      creatingRef.current = true
      try {
        const api = await loadSpotifyApi()
        const host = hostRef.current
        if (!host) throw new Error('nincs hely a lejátszónak')
        const mount = document.createElement('div')
        host.appendChild(mount)
        const initialUri = pendingUriRef.current ?? uri
        api.createController(mount, { uri: initialUri, width: '100%', height: 80 }, (controller) => {
          controllerRef.current = controller
          creatingRef.current = false
          controller.addListener('ready', () => controller.play())
          controller.addListener('playback_update', (e) => setPlaying(e.data?.isPaused === false))
          // Ha közben másik számot kértek, azt töltjük be
          if (pendingUriRef.current && pendingUriRef.current !== initialUri) {
            controller.loadUri(pendingUriRef.current)
            controller.play()
          }
        })
      } catch {
        creatingRef.current = false
        showNotice('A lejátszó nem tölthető be. Próbáld újra.')
      }
    },
    [showNotice]
  )

  const begin = useCallback(
    (track: PlayerTrack) => {
      const uri = toUri(track)
      if (!uri) {
        showNotice('Ehhez a dalhoz nincs Spotify-lejátszás.')
        return
      }
      setCurrent(track)
      void startUri(uri)
    },
    [showNotice, startUri]
  )

  const play = useCallback(
    (input: PlayInput) => {
      // Ugyanaz a dal: szünet / folytatás
      if (currentRef.current?.trackId === input.trackId && controllerRef.current) {
        controllerRef.current.togglePlay()
        return
      }

      // Minden adat megvan: azonnal indítunk (így a kattintás "engedélye" megmarad a böngészőben)
      if (typeof input.spotifyTrackId === 'string' && input.title !== undefined) {
        begin({
          trackId: input.trackId,
          spotifyTrackId: input.spotifyTrackId,
          spotifyAlbumId: input.spotifyAlbumId ?? null,
          title: input.title,
          artist: input.artist ?? '',
          coverUrl: input.coverUrl ?? null,
        })
        return
      }

      // Hiányzó adat (pl. Trending listák): az adatbázisból kérjük le
      void (async () => {
        const { data } = await supabase
          .from('tracks')
          .select('id, title, spotify_track_id, albums(cover_url, spotify_album_id, artists(name))')
          .eq('id', input.trackId)
          .maybeSingle()
        const row = data as unknown as TrackLookup | null
        if (!row) {
          showNotice('A dal nem található.')
          return
        }
        begin({
          trackId: row.id,
          spotifyTrackId: row.spotify_track_id,
          spotifyAlbumId: row.albums?.spotify_album_id ?? null,
          title: row.title,
          artist: row.albums?.artists?.name ?? input.artist ?? '',
          coverUrl: row.albums?.cover_url ?? input.coverUrl ?? null,
        })
      })()
    },
    [begin, showNotice]
  )

  function close() {
    controllerRef.current?.pause()
    setPlaying(false)
    setRateOpen(false)
    setCurrent(null)
  }

  const hidden = isHiddenRoute(pathname)

  // Olyan oldalra lépve, ahol nincs mini lejátszó, a zene megáll
  useEffect(() => {
    if (hidden) controllerRef.current?.pause()
  }, [hidden])

  const visible = current !== null && !hidden
  const value = useMemo(() => ({ current, playing, play }), [current, playing, play])

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {visible && <div aria-hidden className="h-[96px] shrink-0" />}

      <div className={`fixed inset-x-0 bottom-[64px] z-30 px-3 sm:bottom-3 ${visible ? '' : 'hidden'}`}>
        <div className="mx-auto flex max-w-[520px] items-stretch gap-1.5 rounded-2xl border border-neutral-200/80 bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-md">
          <div
            ref={hostRef}
            className="h-20 min-w-0 flex-1 overflow-hidden rounded-xl bg-neutral-100 [&_iframe]:h-20 [&_iframe]:w-full"
          />
          <div className="flex w-[78px] shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={close}
              aria-label="Lejátszó bezárása"
              className="flex h-6 w-full items-center justify-end pr-1 text-neutral-400 transition hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRateOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#FF5B37] text-[11px] font-bold text-white shadow-sm transition hover:bg-[#F44B26] active:scale-[0.97]"
            >
              <Star className="h-4 w-4 fill-current" />
              Értékelem
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="fixed inset-x-0 bottom-[84px] z-40 flex justify-center px-4 sm:bottom-6">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">{notice}</div>
        </div>
      )}

      {current && (
        <RateSheet key={current.trackId} track={current} open={rateOpen && visible} onClose={() => setRateOpen(false)} />
      )}
    </PlayerContext.Provider>
  )
}
