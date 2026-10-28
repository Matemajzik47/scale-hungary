import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { fetchProgress } from '@/lib/progress'
import { getLevelInfo } from '@/lib/levels'

// A profil oldal kliensoldali, ezért a link-előnézethez szükséges címet és leírást itt, szerveroldalon adjuk meg
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username: raw } = await params
  const username = decodeURIComponent(raw)

  const { data: profile } = await supabase.from('profiles').select('id, username').eq('username', username).maybeSingle()
  if (!profile) return { title: 'Scale' }

  const [{ data: rows }, progress] = await Promise.all([
    supabase.from('ratings').select('score').eq('user_id', profile.id),
    fetchProgress(profile.id),
  ])
  const scores = ((rows as { score: number }[] | null) ?? []).map((r) => Number(r.score))
  const total = scores.length
  const avg = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : null
  const level = progress?.level ?? getLevelInfo(total * 10)

  const title = `@${profile.username} Music Taste ID-je a Scale-en`
  const description = `${level.title} · ${level.level}. szint${avg ? ` · átlag ${avg}` : ''} · ${total} értékelt dal. Mutasd meg te is, mit hallgatsz.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile', siteName: 'Scale', locale: 'hu_HU' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
