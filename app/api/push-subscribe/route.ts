import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type SubscriptionBody = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

async function authenticate(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return error ? null : data.user?.id ?? null
}

/** Feliratkozás a reggeli értesítésre (a böngésző push-végpontját mentjük a fiókhoz). */
export async function POST(request: Request) {
  const uid = await authenticate(request)
  if (!uid) return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as SubscriptionBody
  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Hiányos feliratkozás.' }, { status: 400 })
  }

  // Ha ugyanezen a böngészőn másik fiók volt feliratkozva, a végpont átkerül ehhez a fiókhoz
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      user_id: uid,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Leiratkozás. */
export async function DELETE(request: Request) {
  const uid = await authenticate(request)
  if (!uid) return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as SubscriptionBody
  if (!body.endpoint) return NextResponse.json({ error: 'Hiányzó végpont.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
