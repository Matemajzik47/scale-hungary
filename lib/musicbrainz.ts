// MusicBrainz API kapcsolat — nyílt, nem igényel API-kulcsot,
// de a MusicBrainz szabályai szerint kötelező egy azonosító User-Agent fejléc.

const MB_BASE_URL = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'ScaleApp/0.1 (matemajzik47@gmail.com)'

export interface MbRelease {
  id: string
  title: string
  date?: string
  artistName: string
}

/**
 * Lekéri a legutóbbi, Magyarországon kiadott zenei release-eket.
 * A "country:HU" a release kiadási országára szűr (ez egy ésszerű proxy
 * a "magyar kiadás" fogalmára induláskor).
 */
export async function fetchRecentHungarianReleases(
  daysBack = 180,
  limit = 25
): Promise<MbRelease[]> {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - daysBack)
  const sinceStr = sinceDate.toISOString().split('T')[0]

  const query = `country:HU AND date:[${sinceStr} TO *] AND primarytype:Album`
  const url = `${MB_BASE_URL}/release/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=${limit}`

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    throw new Error(`MusicBrainz hiba: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  return (data.releases ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    artistName: r['artist-credit']?.[0]?.name ?? 'Ismeretlen előadó',
  }))
}
