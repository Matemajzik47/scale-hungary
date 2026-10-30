'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Disc3, Minus, Music, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { updateUserStats } from '@/lib/userStats'
import { RequireAuthModal } from '@/components/RequireAuthModal'
import { PlayButton } from '@/components/player/PlayButton'
import { fetchFeaturedByAlbum, withFeat } from '@/lib/credits'

type TrackRow = { id: string; title: string; album_id: string; spotify_track_id: string | null }
type AlbumRow = { id: string; title: string; cover_url: string | null; artist_id: string }
type RatingRow = { track_id: string; user_id: string; score: number; created_at: string }

const TREND_DAYS = 7
const TREND_THRESHOLD = 0.05

type Trend =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'flat' }
  | { kind: 'up'; delta: number }
  | { kind: 'down'; delta: number }

function average(scores: number[]): number | null {
  return scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null
}

/**
 * Az átlag változása az elmúlt 7 napban: a mostani átlagot hasonlítjuk
 * ahhoz, ami 7 nappal ezelőtt volt (csak a régebbi értékelésekből).
 */
function computeTrend(ratings: RatingRow[]): Trend {
  if (ratings.length === 0) return { kind: 'none' }
  const cutoff = Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000
  const older = ratings.filter((r) => new Date(r.created_at).getTime() < cutoff)
  if (older.length === 0) return { kind: 'new' }

  const nowAvg = average(ratings.map((r) => Number(r.score)))!
  const prevAvg = average(older.map((r) => Number(r.score)))!
  const delta = nowAvg - prevAvg

  if (delta > TREND_THRESHOLD) return { kind: 'up', delta }
  if (delta < -TREND_THRESHOLD) return { kind: 'down', delta }
  return { kind: 'flat' }
}

function TrendChip({ trend, compact = false }: { trend: Trend; compact?: boolean }) {
  if (trend.kind === 'none') return null

  if (trend.kind === 'new') {
    return (
      <span className="rounded-full bg-[#FFF5F2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-[#FF5B37]">
        Új
      </span>
    )
  }

  if (trend.kind === 'flat') {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
        <Minus className="h-3 w-3" />
        {!compact && 'Stabil'}
      </span>
    )
  }

  const up = trend.kind === 'up'
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
        up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(trend.delta).toFixed(1)}
    </span>
  )
}

export default function TrackPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [track, setTrack] = useState<TrackRow | null>(null)
  const [album, setAlbum] = useState<AlbumRow | null>(null)
  const [artistName, setArtistName] = useState('Ismeretlen előadó')
  const [albumTracks, setAlbumTracks] = useState<TrackRow[]>([])
  const [ratings, setRatings] = useState<RatingRow[]>([])
  const [myScore, setMyScore] = useState(7.5)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setNotFound(false)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const { data: trackData } = await supabase
        .from('tracks')
        .select('id, title, album_id, spotify_track_id')
        .eq('id', params.id)
        .maybeSingle()

      if (!trackData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const t = trackData as TrackRow

      const { data: albumData } = await supabase
        .from('albums')
        .select('id, title, cover_url, artist_id')
        .eq('id', t.album_id)
        .maybeSingle()
      const a = albumData as AlbumRow | null

      let artist = 'Ismeretlen előadó'
      if (a) {
        const { data: artistData } = await supabase
          .from('artists')
          .select('name')
          .eq('id', a.artist_id)
          .maybeSingle()
        artist = (artistData as { name: string } | null)?.name ?? artist
        const featured = await fetchFeaturedByAlbum([a.id])
        artist = withFeat(artist, featured.get(a.id))
      }

      const { data: siblingsData } = await supabase
        .from('tracks')
        .select('id, title, album_id, spotify_track_id')
        .eq('album_id', t.album_id)
      const siblings = (siblingsData as TrackRow[] | null) ?? [t]

      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('track_id, user_id, score, created_at')
        .in('track_id', siblings.map((s) => s.id))
      const allRatings = (ratingsData as RatingRow[] | null) ?? []

      const mine = user ? allRatings.find((r) => r.track_id === t.id && r.user_id === user.id) : null

      setTrack(t)
      setAlbum(a)
      setArtistName(artist)
      setAlbumTracks(siblings)
      setRatings(allRatings)
      setMyScore(mine ? Number(mine.score) : 7.5)
      setLoading(false)
    }

    load()
  }, [params.id])

  // A mini lejátszóból adott értékelés itt is látszódjon
  useEffect(() => {
    function onRated(e: Event) {
      const { trackId, score } = (e as CustomEvent<{ trackId: string; score: number }>).detail
      if (trackId !== params.id || !userId) return
      setMyScore(score)
      setRatings((prev) => {
        const existing = prev.find((r) => r.track_id === trackId && r.user_id === userId)
        if (existing) return prev.map((r) => (r === existing ? { ...r, score } : r))
        return [...prev, { track_id: trackId, user_id: userId, score, created_at: new Date().toISOString() }]
      })
    }
    window.addEventListener('scale:rated', onRated)
    return () => window.removeEventListener('scale:rated', onRated)
  }, [params.id, userId])

  const trackRatings = useMemo(
    () => ratings.filter((r) => r.track_id === params.id),
    [ratings, params.id]
  )
  const avg = average(trackRatings.map((r) => Number(r.score)))
  const trend = useMemo(() => computeTrend(trackRatings), [trackRatings])
  const myExisting = userId
    ? trackRatings.find((r) => r.user_id === userId) ?? null
    : null

  async function handleSave() {
    if (!userId || !track) {
      setAuthOpen(true)
      return
    }

    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, track_id: track.id, score: myScore }, { onConflict: 'user_id,track_id' })

    if (error) {
      setSaveStatus('Hiba a mentéskor')
    } else {
      await updateUserStats(userId)
      window.dispatchEvent(new CustomEvent('scale:rated', { detail: { trackId: track.id, score: myScore } }))
      setRatings((prev) => {
        const existing = prev.find((r) => r.track_id === track.id && r.user_id === userId)
        if (existing) {
          return prev.map((r) => (r === existing ? { ...r, score: myScore } : r))
        }
        return [
          ...prev,
          { track_id: track.id, user_id: userId, score: myScore, created_at: new Date().toISOString() },
        ]
      })
      setSaveStatus('Mentve!')
    }
    setTimeout(() => setSaveStatus(null), 1500)
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  if (notFound || !track) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 px-6 text-center text-neutral-500">
        <Music className="h-8 w-8 text-neutral-300" />
        <p className="text-sm font-bold text-neutral-700">Ez a dal nem található</p>
        <Link href="/search" className="mt-2 rounded-full bg-[#FF5B37] px-4 py-2 text-xs font-bold text-white">
          Vissza a kereséshez
        </Link>
      </div>
    )
  }

  const pct = ((myScore - 1) / 9) * 100

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1 rounded-full py-1 pr-3 text-xs font-semibold text-neutral-500 transition hover:text-neutral-800"
      >
        <ChevronLeft className="h-4 w-4" />
        Vissza
      </button>

      <div className="relative aspect-square w-full overflow-hidden rounded-[24px] bg-neutral-900 shadow-sm">
        {album?.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.cover_url} alt={track.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <Disc3 className="h-16 w-16" />
          </div>
        )}
      </div>

      <header>
        <h1 className="text-2xl font-black leading-tight tracking-tight text-neutral-900">
          {track.title}
        </h1>
        <p className="mt-0.5 text-sm font-semibold text-[#FF5B37]">{artistName}</p>
        {album && <p className="font-mono text-[11px] text-neutral-400">{album.title}</p>}
      </header>

      <section className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#111214] p-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">Átlag</span>
          <span className="font-mono text-2xl font-black text-[#FF8F68]">
            {avg !== null ? avg.toFixed(1) : '–'}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200/80 bg-white p-3 text-center shadow-sm">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            <Users className="h-2.5 w-2.5" />
            Értékelő
          </span>
          <span className="font-mono text-2xl font-black text-neutral-900">{trackRatings.length}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-white p-3 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">
            {TREND_DAYS} nap
          </span>
          {trend.kind === 'none' ? (
            <span className="font-mono text-2xl font-black text-neutral-300">–</span>
          ) : (
            <TrendChip trend={trend} />
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-neutral-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {myExisting ? 'Saját értékelésed' : 'Értékeld a dalt'}
          </span>
          {saveStatus && <span className="text-xs font-medium text-[#FF5B37]">{saveStatus}</span>}
        </div>
        <div className="mt-3 flex items-center gap-3.5">
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={myScore}
            onChange={(e) => setMyScore(Number(e.target.value))}
            aria-label="Pontszám"
            style={{ background: `linear-gradient(90deg,#FF5B37 ${pct}%,#E6E3DF ${pct}%)` }}
            className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-[#FF5B37] [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-[#FF5B37] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
          />
          <output className="min-w-[3.4ch] text-right font-mono text-3xl font-extrabold tabular-nums text-neutral-900">
            {myScore.toFixed(1)}
          </output>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="mt-4 w-full rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98]"
        >
          {myExisting ? 'Értékelés frissítése' : 'Mentés'}
        </button>
      </section>

      <PlayButton
        variant="wide"
        track={{
          trackId: track.id,
          spotifyTrackId: track.spotify_track_id,
          spotifyAlbumId: null,
          title: track.title,
          artist: artistName,
          coverUrl: album?.cover_url ?? null,
        }}
      />

      {albumTracks.length > 1 && (
        <section className="flex flex-col gap-2 pt-1">
          <span className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Az album többi dala
          </span>
          {albumTracks.map((t) => {
            const rs = ratings.filter((r) => r.track_id === t.id)
            const a = average(rs.map((r) => Number(r.score)))
            const isCurrent = t.id === track.id
            return (
              <Link
                key={t.id}
                href={`/track/${t.id}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-2.5 shadow-sm transition-all active:scale-[0.98] ${
                  isCurrent
                    ? 'border-[#FF5B37]/40 bg-[#FFF5F2]'
                    : 'border-neutral-200/80 bg-white hover:bg-neutral-50'
                }`}
              >
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-neutral-900">{t.title}</h4>
                  <span className="text-[10px] font-medium text-neutral-400">
                    {rs.length} értékelő
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PlayButton
                    track={{
                      trackId: t.id,
                      spotifyTrackId: t.spotify_track_id,
                      spotifyAlbumId: null,
                      title: t.title,
                      artist: artistName,
                      coverUrl: album?.cover_url ?? null,
                    }}
                    className="h-8 w-8"
                  />
                  <TrendChip trend={computeTrend(rs)} compact />
                  <span className="font-mono text-sm font-black text-[#FF5B37]">
                    {a !== null ? a.toFixed(1) : '–'}
                  </span>
                </div>
              </Link>
            )
          })}
        </section>
      )}

      <RequireAuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        message="A dal értékeléséhez jelentkezz be, vagy hozz létre egy ingyenes Scale fiókot."
      />
    </div>
  )
}
