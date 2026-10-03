import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRecentHungarianReleases } from '@/lib/musicbrainz'
import { searchSpotifyAlbum } from '@/lib/spotify-server'
import { getIsoWeekString } from '@/lib/week'

/**
 * Katalógus-szinkronizáció: lekéri a friss magyar kiadásokat a MusicBrainz-ből,
 * összeköti őket a Spotify adataival (borító, track-lista), és beírja
 * az artists / albums / tracks táblákba.
 *
 * Kézzel hívható: GET /api/sync-catalog
 * Később: ütemezett job hívja automatikusan.
 */
export async function GET() {
  const summary = {
    processed: 0,
    newArtists: 0,
    newAlbums: 0,
    newTracks: 0,
    skipped: 0,
    errors: [] as string[],
  }

  try {
    const releases = await fetchRecentHungarianReleases(180, 25)

    for (const release of releases) {
      try {
        // 1. Előadó megkeresése vagy létrehozása
        let { data: artist } = await supabaseAdmin
          .from('artists')
          .select('id')
          .eq('name', release.artistName)
          .maybeSingle()

        if (!artist) {
          const { data: newArtist, error: artistError } = await supabaseAdmin
            .from('artists')
            .insert({ name: release.artistName, country: 'HU' })
            .select('id')
            .single()

          if (artistError) throw artistError
          artist = newArtist
          summary.newArtists++
        }

        // 2. Már létezik-e ez az album? (cím + előadó alapján)
        const { data: existingAlbum } = await supabaseAdmin
          .from('albums')
          .select('id')
          .eq('artist_id', artist.id)
          .eq('title', release.title)
          .maybeSingle()

        if (existingAlbum) {
          summary.skipped++
          continue
        }

        // 3. Spotify-megfelelő keresése (borító, track-lista)
        const spotifyMatch = await searchSpotifyAlbum(release.artistName, release.title)

        const releaseDate = release.date ? new Date(release.date) : new Date()
        const releaseWeek = getIsoWeekString(releaseDate)

        // 4. Album beírása
        const { data: newAlbum, error: albumError } = await supabaseAdmin
          .from('albums')
          .insert({
            artist_id: artist.id,
            title: release.title,
            release_date: release.date ?? null,
            cover_url: spotifyMatch?.coverUrl ?? null,
            spotify_album_id: spotifyMatch?.spotifyAlbumId ?? null,
            release_week: releaseWeek,
          })
          .select('id')
          .single()

        if (albumError) throw albumError
        summary.newAlbums++

        // 5. Track-ek beírása, ha volt Spotify-találat
        if (spotifyMatch && spotifyMatch.trackIds.length > 0) {
          const tracksToInsert = spotifyMatch.trackIds.map((t) => ({
            album_id: newAlbum.id,
            title: t.title,
            spotify_track_id: t.id,
          }))

          const { error: tracksError } = await supabaseAdmin
            .from('tracks')
            .insert(tracksToInsert)

          if (tracksError) throw tracksError
          summary.newTracks += tracksToInsert.length
        }

        summary.processed++
      } catch (err) {
        summary.errors.push(
          `${release.artistName} - ${release.title}: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    }

    return NextResponse.json({ success: true, summary })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        summary,
      },
      { status: 500 }
    )
  }
}
