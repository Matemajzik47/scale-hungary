import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * Fiók végleges törlése. A hívó a saját bejelentkezési tokenjét küldi
 * (Authorization: Bearer ...), ebből azonosítjuk — más fiókját nem lehet törölni.
 * Törlődik: a kártyaháttér-kép, az értékelések, a követések, a statisztika, a profil
 * és maga a belépési fiók is.
 */
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (userError || !uid) return NextResponse.json({ error: 'Érvénytelen munkamenet.' }, { status: 401 })

  try {
    // 1. Feltöltött kártyaháttér(ek)
    const { data: files } = await supabaseAdmin.storage.from('card-backgrounds').list(uid)
    if (files && files.length > 0) {
      await supabaseAdmin.storage.from('card-backgrounds').remove(files.map((f) => `${uid}/${f.name}`))
    }

    // 2. Adatok táblánként (a hiba esetén pontosan látszik, hol akadt el)
    const steps: [string, PromiseLike<{ error: { message: string } | null }>][] = [
      ['ratings', supabaseAdmin.from('ratings').delete().eq('user_id', uid)],
      ['follows (követő)', supabaseAdmin.from('follows').delete().eq('follower_id', uid)],
      ['follows (követett)', supabaseAdmin.from('follows').delete().eq('following_id', uid)],
      ['push_subscriptions', supabaseAdmin.from('push_subscriptions').delete().eq('user_id', uid)],
      ['user_stats', supabaseAdmin.from('user_stats').delete().eq('user_id', uid)],
      ['profiles', supabaseAdmin.from('profiles').delete().eq('id', uid)],
    ]
    for (const [name, op] of steps) {
      const { error } = await op
      if (error) throw new Error(`${name}: ${error.message}`)
    }

    // 3. A belépési fiók
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (authError) throw new Error(`auth: ${authError.message}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
