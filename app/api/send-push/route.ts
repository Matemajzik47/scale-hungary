import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Reggeli push értesítés: napi legfeljebb 1 üzenet, és csak akkor, ha van mondanivaló:
 *   1) veszélyben a napi széria (legalább 2 napos, és tegnap volt az utolsó értékelés), vagy
 *   2) van olyan új megjelenés (az elmúlt ~36 órában került a katalógusba), amit a felhasználó még nem értékelt.
 * A külső cron (cron-job.org) hívja naponta 8:00-kor (Europe/Budapest időzónával).
 *
 * Paraméterek (csak tesztelésre):
 *   ?dry=1            nem küld, csak megmutatja, kinek mennének üzenetek
 *   ?testUser=<név>   egy próbaüzenetet küld a megadott felhasználónak (az újdonság-ellenőrzés nélkül)
 */

const MAX_WINDOW_MS = 36 * 60 * 60 * 1000 // legfeljebb ennyivel korábbi újdonságot említünk
const MIN_GAP_MS = 20 * 60 * 60 * 1000 // két üzenet között legalább ennyi idő
const FRESH_RELEASE_DAYS = 14 // csak ennél frissebb megjelenésű album számít újnak (az archív feltöltés nem)
const BATCH = 10

// Magyar határozott névelő a szám kiejtése szerint: "az 1", "az 5", "az 50–59", "az 500–599", "az 1000–1999", egyébként "a"
function articleFor(n: number): 'a' | 'az' {
  if (n === 1 || n === 5) return 'az'
  if (n >= 50 && n <= 59) return 'az'
  if (n >= 500 && n <= 599) return 'az'
  if (n >= 1000 && n <= 1999) return 'az'
  return 'a'
}

function streakTitle(streak: number): string {
  return `Ne szakadjon meg ${articleFor(streak)} ${streak} napos szériád! 🔥`
}

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; last_sent_at: string | null }

type NewAlbum = {
  id: string
  title: string
  created_at: string
  artists: { name: string } | null
  tracks: { id: string }[] | null
}

function errorStatus(err: unknown): number | null {
  const code = (err as { statusCode?: number } | null)?.statusCode
  return typeof code === 'number' ? code : null
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:matemajzik47@gmail.com'
  if (!publicKey || !privateKey) {
    return NextResponse.json({ success: false, error: 'Hiányzó VAPID kulcsok (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).' }, { status: 500 })
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const dry = request.nextUrl.searchParams.get('dry') === '1'
  const testUser = request.nextUrl.searchParams.get('testUser')
  const summary = { subscriptions: 0, notified: 0, noNews: 0, tooSoon: 0, removed: 0, dry, errors: [] as string[] }

  async function send(sub: Sub, payload: { title: string; body: string; url: string }) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 60 * 60 }
      )
      return true
    } catch (err) {
      const status = errorStatus(err)
      if (status === 404 || status === 410) {
        // a feliratkozás megszűnt (kikapcsolták / törölték a böngészőben)
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        summary.removed++
      } else {
        summary.errors.push(`${sub.endpoint.slice(0, 40)}…: ${err instanceof Error ? err.message : String(err)}`)
      }
      return false
    }
  }

  // --- Próbaüzenet egy felhasználónak ---
  if (testUser) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('username', testUser).maybeSingle()
    if (!profile) return NextResponse.json({ success: false, error: 'Nincs ilyen felhasználó.' }, { status: 404 })
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, last_sent_at')
      .eq('user_id', profile.id)
    summary.subscriptions = subs?.length ?? 0
    if (!dry) {
      for (const sub of (subs ?? []) as Sub[]) {
        const ok = await send(sub, { title: 'Scale · próbaüzenet 🔥', body: 'Ez egy teszt értesítés. A reggeli üzenet így fog kinézni.', url: '/discover' })
        if (ok) summary.notified++
      }
    }
    return NextResponse.json({ success: true, summary })
  }

  // --- Napi üzenet ---
  const { data: subsData, error: subsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, last_sent_at')
    .limit(5000)
  if (subsError) return NextResponse.json({ success: false, error: subsError.message }, { status: 500 })
  const subs = (subsData ?? []) as Sub[]
  summary.subscriptions = subs.length
  if (subs.length === 0) return NextResponse.json({ success: true, summary })

  const now = Date.now()
  const sinceOf = (s: Sub) => Math.max(s.last_sent_at ? new Date(s.last_sent_at).getTime() : 0, now - MAX_WINDOW_MS)
  const earliest = Math.min(...subs.map(sinceOf))

  const today = new Date().toISOString().slice(0, 10)
  const freshFrom = new Date(now - FRESH_RELEASE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // A széria napjait helyi (magyar) idő szerint számoljuk, mint ahogy az alkalmazás is
  const budapestDay = (ms: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date(ms))
  const yesterdayHu = budapestDay(now - 24 * 60 * 60 * 1000)

  const { data: albumsData, error: albumsError } = await supabaseAdmin
    .from('albums')
    .select('id, title, created_at, artists(name), tracks(id)')
    .gt('created_at', new Date(earliest).toISOString())
    .gte('release_date', freshFrom)
    .lte('release_date', today)
    .order('created_at', { ascending: false })
    .limit(300)
  if (albumsError) return NextResponse.json({ success: false, error: albumsError.message }, { status: 500 })
  const albums = ((albumsData ?? []) as unknown as NewAlbum[]).filter((a) => (a.tracks?.length ?? 0) > 0)

  // Az új dalokra adott értékelések (az új dalokból kevés van, ezért egyben lekérhető)
  const trackIds = albums.flatMap((a) => (a.tracks ?? []).map((t) => t.id))
  const ratedBy = new Map<string, Set<string>>() // felhasználó -> értékelt dalok
  for (let i = 0; i < trackIds.length; i += 100) {
    const { data } = await supabaseAdmin
      .from('ratings')
      .select('user_id, track_id')
      .in('track_id', trackIds.slice(i, i + 100))
    for (const r of data ?? []) {
      const set = ratedBy.get(r.user_id) ?? new Set<string>()
      set.add(r.track_id)
      ratedBy.set(r.user_id, set)
    }
  }

  // Napi széria: kinek van veszélyben (tegnap értékelt utoljára, legalább 2 napos a sorozat)
  const streakAtRisk = new Map<string, number>() // felhasználó -> széria hossza
  const userIds = Array.from(new Set(subs.map((s) => s.user_id)))
  for (let i = 0; i < userIds.length; i += 100) {
    const { data } = await supabaseAdmin
      .from('user_stats')
      .select('user_id, current_streak, last_rated_week')
      .in('user_id', userIds.slice(i, i + 100))
    for (const st of data ?? []) {
      if (st.last_rated_week === yesterdayHu && (st.current_streak ?? 0) >= 2) {
        streakAtRisk.set(st.user_id, st.current_streak)
      }
    }
  }

  type Job = { sub: Sub; payload: { title: string; body: string; url: string } }
  const jobs: Job[] = []

  for (const sub of subs) {
    if (sub.last_sent_at && now - new Date(sub.last_sent_at).getTime() < MIN_GAP_MS) {
      summary.tooSoon++
      continue
    }
    const since = sinceOf(sub)
    const rated = ratedBy.get(sub.user_id) ?? new Set<string>()
    const open = albums.filter(
      (a) => new Date(a.created_at).getTime() > since && (a.tracks ?? []).some((t) => !rated.has(t.id))
    )
    const streak = streakAtRisk.get(sub.user_id)

    if (open.length === 0 && streak === undefined) {
      summary.noNews++
      continue
    }

    let title: string
    let body: string
    if (open.length > 0) {
      const top = open[0]
      const name = top.artists?.name ? `${top.artists.name} – ${top.title}` : top.title
      const news =
        open.length > 1 ? `${name} és még ${open.length - 1} új kiadás vár az értékelésedre.` : `${name} vár az értékelésedre.`
      if (streak !== undefined) {
        title = streakTitle(streak)
        body = news
      } else {
        title = 'Új magyar megjelenések 🔥'
        body = news
      }
    } else {
      title = streakTitle(streak as number)
      body = 'Nézd meg az új megjelenéseket, vagy értékelj régi kiadásokat, és tartsd életben a szériádat.'
    }
    jobs.push({ sub, payload: { title, body, url: '/discover' } })
  }

  if (dry) {
    return NextResponse.json({ success: true, summary: { ...summary, notified: jobs.length }, preview: jobs.slice(0, 5).map((j) => j.payload) })
  }

  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(async ({ sub, payload }) => {
        if (await send(sub, payload)) {
          summary.notified++
          await supabaseAdmin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id)
        }
      })
    )
  }

  return NextResponse.json({ success: true, summary })
}
