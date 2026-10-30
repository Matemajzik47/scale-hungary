import { supabase } from '@/lib/supabase'

// Vendég-közreműködések (feat.): az album_artists tábla (add-credits.sql) köti a vendég előadókat a kiadáshoz.
// Ha a tábla még nincs létrehozva vagy hiba van, egyszerűen nincs "feat." felirat (az oldal így is működik).

const CHUNK = 100

type CreditRow = { album_id: string; artists: { name: string } | null }

/** albumId -> "Előadó1, Előadó2" a vendég előadókból. */
export async function fetchFeaturedByAlbum(albumIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string[]>()
  const ids = Array.from(new Set(albumIds.filter(Boolean)))

  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('album_artists')
      .select('album_id, artists(name)')
      .in('album_id', ids.slice(i, i + CHUNK))
    if (error || !data) return new Map()
    for (const row of data as unknown as CreditRow[]) {
      if (!row.artists?.name) continue
      out.set(row.album_id, [...(out.get(row.album_id) ?? []), row.artists.name])
    }
  }

  return new Map(Array.from(out, ([album, names]) => [album, names.sort((a, b) => a.localeCompare(b, 'hu')).join(', ')]))
}

/** trackId -> vendég előadók (a dal albumán keresztül). */
export async function fetchFeaturedByTrack(trackIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = Array.from(new Set(trackIds.filter(Boolean)))
  const albumOfTrack = new Map<string, string>()

  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase.from('tracks').select('id, album_id').in('id', ids.slice(i, i + CHUNK))
    for (const t of (data ?? []) as { id: string; album_id: string }[]) albumOfTrack.set(t.id, t.album_id)
  }

  const byAlbum = await fetchFeaturedByAlbum(Array.from(albumOfTrack.values()))
  for (const [trackId, albumId] of albumOfTrack) {
    const feat = byAlbum.get(albumId)
    if (feat) out.set(trackId, feat)
  }
  return out
}

/** "Előadó feat. Vendég1, Vendég2" */
export function withFeat(name: string, featured?: string | null): string {
  return featured ? `${name} feat. ${featured}` : name
}
