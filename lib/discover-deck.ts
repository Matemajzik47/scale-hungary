import { supabase } from '@/lib/supabase'
import type { DiscoverTrack } from '@/types/discover'
import { fetchFeaturedByAlbum, withFeat } from '@/lib/credits'

type DeckRow = {
  track_id: string
  title: string
  spotify_track_id: string | null
  album_id: string
  album_title: string
  cover_url: string | null
  spotify_album_id: string | null
  artist_id: string
  artist_name: string
  community_avg: number | string | null
  total_ratings: number | string
  layer: string
}

export const DECK_BATCH = 20

// A napi seed: felhasználónként és naponként más (helyi idő szerint), így mindenkinek a saját sorrendje van
export function deckSeed(userId: string | null): string {
  const now = new Date()
  const d = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  return `${userId ?? 'guest'}:${d}`
}

/**
 * A következő adag dal a szerverről (discover_deck): friss, közelmúlt, alig értékelt régebbi és
 * meglepetés dalok, albumonként/előadónként korlátozva. null, ha a függvény még nincs létrehozva.
 */
export async function fetchDeckBatch(
  exclude: string[],
  seed: string,
  limit: number = DECK_BATCH
): Promise<DiscoverTrack[] | null> {
  const { data, error } = await supabase.rpc('discover_deck', {
    p_limit: limit,
    p_exclude: exclude,
    p_seed: seed,
  })
  if (error || !data) return null

  const rows = data as DeckRow[]
  const featured = await fetchFeaturedByAlbum(rows.map((r) => r.album_id))

  return rows.map((r) => ({
    id: r.track_id,
    title: r.title,
    spotify_track_id: r.spotify_track_id,
    album: {
      id: r.album_id,
      title: r.album_title,
      cover_url: r.cover_url,
      spotify_album_id: r.spotify_album_id,
    },
    artist: { id: r.artist_id, name: withFeat(r.artist_name, featured.get(r.album_id)) },
    communityAverage: r.community_avg === null ? null : Number(r.community_avg),
    totalRatings: Number(r.total_ratings),
    userRating: null,
  }))
}

/**
 * Úgy rendezi át az adagot, hogy egymás után ne jöjjön ugyanarról az albumról (6 kártyán belül)
 * vagy ugyanattól az előadótól (3 kártyán belül) dal. A `tail` a sor már meglévő vége, amelyhez
 * az új adag csatlakozik.
 */
export function spaceOut(batch: DiscoverTrack[], tail: DiscoverTrack[] = []): DiscoverTrack[] {
  const out: DiscoverTrack[] = []
  const remaining = [...batch]
  const recent = [...tail]

  const clashes = (t: DiscoverTrack, history: DiscoverTrack[]) => {
    const albumWindow = history.slice(-6)
    const artistWindow = history.slice(-3)
    return albumWindow.some((h) => h.album.id === t.album.id) || artistWindow.some((h) => h.artist.id === t.artist.id)
  }

  while (remaining.length > 0) {
    const history = [...recent, ...out]
    let idx = remaining.findIndex((t) => !clashes(t, history))
    if (idx === -1) idx = 0
    out.push(remaining.splice(idx, 1)[0])
  }
  return out
}

// ---- kihagyott dalok (balra húzás): 24 órára nem jönnek vissza, frissítés után sem ----
const SKIP_KEY = 'scale:discover:skips:v1'
const SKIP_TTL_MS = 24 * 60 * 60 * 1000

function readSkips(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SKIP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    const now = Date.now()
    const fresh: Record<string, number> = {}
    for (const [id, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && now - ts < SKIP_TTL_MS) fresh[id] = ts
    }
    return fresh
  } catch {
    return {}
  }
}

function writeSkips(map: Record<string, number>) {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify(map))
  } catch {
    // a tárhely lehet tiltott (pl. privát ablak): ilyenkor csak az oldal élettartamáig számít
  }
}

export function getSkippedIds(): string[] {
  return Object.keys(readSkips())
}

export function addSkip(id: string) {
  const map = readSkips()
  map[id] = Date.now()
  writeSkips(map)
}

export function removeSkip(id: string) {
  const map = readSkips()
  delete map[id]
  writeSkips(map)
}

export function clearSkips() {
  writeSkips({})
}
