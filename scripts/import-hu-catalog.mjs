// Scale — magyar előadók és kiadásaik tömeges betöltése a MusicBrainz-ből.
//
// Futtatás a projekt mappájából (Codespaces terminál):
//   node --env-file=.env.local scripts/import-hu-catalog.mjs
// Kell hozzá a .env.local-ban: NEXT_PUBLIC_SUPABASE_URL és SUPABASE_SERVICE_ROLE_KEY.
//
// Opciók:
//   --since=2016      az ennél korábbi kiadásokat kihagyja (alap: 2016)
//   --dry             nem ír az adatbázisba, csak kiírja, mit tenne
//   --max-artists=50  csak ennyi előadót dolgoz fel (kipróbáláshoz)
//
// Mit csinál:
//  1. Lekéri az összes magyar (country:HU) előadót a MusicBrainz-ből (.import-hu-artists.json cache).
//  2. Minden előadónál végignézi a kiadásait (album, EP, kislemez), és ami a --since évtől
//     újabb, azt betölti az artists / albums / tracks táblába. Ami már megvan, azt átugorja.
//  3. A kiadások Spotify nélkül, egy helyőrző dallal kerülnek be. A borítót és a valódi
//     dalokat a /api/sync-catalog Spotify-pótlása adja hozzá (futásonként 40 album).
//
// A MusicBrainz szabálya szerint legfeljebb 1 kérés/másodperc, ezért ez órákig tarthat.
// Megszakítható (Ctrl+C), és újraindítva ott folytatja, ahol abbahagyta (.import-hu-state.json).
// Háttérben futtatva: nohup node --env-file=.env.local scripts/import-hu-catalog.mjs > import.log 2>&1 &
// A két .import-hu-*.json és az import.log fájlt NE töltsd fel GitHubra.

import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'

const MB = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'ScaleApp/0.1 (matemajzik47@gmail.com)'
const GAP_MS = 1100
const ARTISTS_FILE = '.import-hu-artists.json'
const STATE_FILE = '.import-hu-state.json'
// Ezeket a másodlagos típusokat nem töltjük be (válogatás, élő, remix stb.)
const EXCLUDED_SECONDARY = new Set(['Compilation', 'Live', 'Remix', 'DJ-mix', 'Demo', 'Mixtape/Street', 'Interview', 'Spokenword', 'Audiobook'])

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : fallback
}
const SINCE_YEAR = Number(argValue('since', '2016'))
const MAX_ARTISTS = Number(argValue('max-artists', '0')) || Infinity
const DRY = args.includes('--dry')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastRequestAt = 0

async function mbGet(path) {
  let lastError = ''
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = lastRequestAt + GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    try {
      const res = await fetch(`${MB}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
      if (res.ok) return await res.json()
      lastError = `${res.status} ${res.statusText}`
      if (res.status !== 503 && res.status !== 429 && res.status < 500) break
      await sleep(3000 * attempt)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      await sleep(3000 * attempt)
    }
  }
  throw new Error(`MusicBrainz hiba (${path}): ${lastError}`)
}

const norm = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ')

function normalizeDate(value) {
  if (!value) return null
  if (/^\d{4}$/.test(value)) return `${value}-01-01`
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return null
}

// Ugyanaz, mint a lib/week.ts: "2026-W40"
function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayNum = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

// --- 1. magyar előadók listája (cache-elve) ---
async function loadHungarianArtists() {
  const cached = await readJson(ARTISTS_FILE, null)
  if (cached?.complete) return cached.artists

  const artists = cached?.artists ?? []
  let offset = artists.length
  console.log(`Magyar előadók lekérése a MusicBrainz-ből (eddig ${offset})...`)
  for (;;) {
    const data = await mbGet(`/artist/?query=${encodeURIComponent('country:HU')}&fmt=json&limit=100&offset=${offset}`)
    const page = data.artists ?? []
    for (const a of page) artists.push({ id: a.id, name: a.name })
    offset += page.length
    const total = data.count ?? offset
    console.log(`  ${offset}/${total}`)
    const done = page.length === 0 || offset >= total
    await writeFile(ARTISTS_FILE, JSON.stringify({ complete: done, artists }))
    if (done) break
  }
  return artists
}

// --- 2. adatbázis ---
function makeDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Hiányzik a NEXT_PUBLIC_SUPABASE_URL vagy a SUPABASE_SERVICE_ROLE_KEY.')
    console.error('Futtasd így: node --env-file=.env.local scripts/import-hu-catalog.mjs')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function fetchAll(db, table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

async function main() {
  const db = makeDb()
  const hungarian = await loadHungarianArtists()
  console.log(`Magyar előadó a MusicBrainz-ben: ${hungarian.length}`)

  // Meglévő adatok memóriában, hogy ne kelljen előadónként rákérdezni
  const [dbArtists, dbAlbums, skippedRows] = await Promise.all([
    fetchAll(db, 'artists', 'id, name, mb_artist_id'),
    fetchAll(db, 'albums', 'artist_id, title'),
    fetchAll(db, 'skipped_artists', 'mb_artist_id'),
  ])
  const artistByMb = new Map(dbArtists.filter((a) => a.mb_artist_id).map((a) => [a.mb_artist_id, a]))
  const artistByName = new Map(dbArtists.map((a) => [norm(a.name), a]))
  const skipped = new Set(skippedRows.map((s) => s.mb_artist_id))
  const albumKeys = new Set(dbAlbums.map((a) => `${a.artist_id}|${norm(a.title)}`))

  const state = await readJson(STATE_FILE, { done: [] })
  const done = new Set(state.done)
  const stats = { artistsChecked: 0, newArtists: 0, newAlbums: 0, skippedExisting: 0, errors: 0 }
  let processedThisRun = 0

  for (const [index, artist] of hungarian.entries()) {
    if (done.has(artist.id) || skipped.has(artist.id)) continue
    if (processedThisRun >= MAX_ARTISTS) break
    processedThisRun++

    try {
      // Az előadó kiadásai (album, EP, kislemez), lapozva
      const groups = []
      for (let offset = 0; ; offset += 100) {
        const data = await mbGet(
          `/release-group?artist=${artist.id}&type=album|ep|single&fmt=json&limit=100&offset=${offset}`
        )
        const page = data['release-groups'] ?? []
        groups.push(...page)
        if (page.length < 100 || offset + page.length >= (data['release-group-count'] ?? 0)) break
      }

      const wanted = []
      for (const g of groups) {
        const date = normalizeDate(g['first-release-date'])
        if (!date || Number(date.slice(0, 4)) < SINCE_YEAR) continue
        if ((g['secondary-types'] ?? []).some((t) => EXCLUDED_SECONDARY.has(t))) continue
        wanted.push({ title: g.title, date })
      }

      if (wanted.length > 0) {
        // Előadó megkeresése vagy létrehozása
        let dbArtist = artistByMb.get(artist.id) ?? artistByName.get(norm(artist.name))
        const fresh = wanted.filter((w) => !dbArtist || !albumKeys.has(`${dbArtist.id}|${norm(w.title)}`))
        stats.skippedExisting += wanted.length - fresh.length

        if (fresh.length > 0) {
          if (!dbArtist) {
            if (DRY) {
              dbArtist = { id: `dry-${artist.id}`, name: artist.name, mb_artist_id: artist.id }
            } else {
              const { data, error } = await db
                .from('artists')
                .insert({ name: artist.name, country: 'HU', mb_artist_id: artist.id, origin_checked_at: new Date().toISOString() })
                .select('id, name, mb_artist_id')
                .single()
              if (error) throw error
              dbArtist = data
            }
            artistByMb.set(artist.id, dbArtist)
            artistByName.set(norm(artist.name), dbArtist)
            stats.newArtists++
          } else if (!dbArtist.mb_artist_id && !DRY) {
            // A meglévő előadó kapja meg az azonosítót, hogy a figyelés is kezelje
            const { error } = await db
              .from('artists')
              .update({ mb_artist_id: artist.id, origin_checked_at: new Date().toISOString() })
              .eq('id', dbArtist.id)
            if (!error) {
              dbArtist.mb_artist_id = artist.id
              artistByMb.set(artist.id, dbArtist)
            }
          }

          // Egy előadón belül azonos című kiadás csak egyszer
          const seen = new Set()
          const uniqueFresh = fresh.filter((w) => {
            const k = norm(w.title)
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })

          if (!DRY) {
            const { data: albums, error: albumError } = await db
              .from('albums')
              .insert(
                uniqueFresh.map((w) => ({
                  artist_id: dbArtist.id,
                  title: w.title,
                  release_date: w.date,
                  release_week: isoWeek(w.date),
                }))
              )
              .select('id, title')
            if (albumError) throw albumError

            const { error: trackError } = await db
              .from('tracks')
              .insert(albums.map((a) => ({ album_id: a.id, title: a.title, spotify_track_id: null })))
            if (trackError) throw trackError
          }
          for (const w of uniqueFresh) albumKeys.add(`${dbArtist.id}|${norm(w.title)}`)
          stats.newAlbums += uniqueFresh.length
        }
      }

      stats.artistsChecked++
      done.add(artist.id)
    } catch (err) {
      stats.errors++
      console.error(`Hiba (${artist.name}): ${err instanceof Error ? err.message : JSON.stringify(err)}`)
    }

    if (processedThisRun % 25 === 0) {
      if (!DRY) await writeFile(STATE_FILE, JSON.stringify({ done: [...done] }))
      console.log(
        `[${index + 1}/${hungarian.length}] ellenőrzött: ${stats.artistsChecked}, új előadó: ${stats.newArtists}, új album: ${stats.newAlbums}, hiba: ${stats.errors}`
      )
    }
  }

  if (!DRY) await writeFile(STATE_FILE, JSON.stringify({ done: [...done] }))
  console.log('Kész.', JSON.stringify(stats))
}

await main()
