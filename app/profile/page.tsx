'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile, UserStats } from '@/types/database'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: statsData } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setProfile(profileData)
      setStats(
        statsData ?? {
          user_id: user.id,
          total_ratings: 0,
          current_streak: 0,
          last_rated_week: null,
        }
      )
      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center">Betöltés...</div>
  }

  if (!profile) {
    return null
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">{profile.username}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Csatlakozott: {new Date(profile.created_at).toLocaleDateString('hu-HU')}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <p className="text-2xl font-semibold">{stats?.total_ratings ?? 0}</p>
            <p className="text-sm text-gray-500">rate-elés</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <p className="text-2xl font-semibold">{stats?.current_streak ?? 0}</p>
            <p className="text-sm text-gray-500">heti sorozat</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="mt-8 w-full rounded-xl border border-gray-300 px-4 py-2 transition hover:bg-gray-50"
        >
          Kijelentkezés
        </button>
      </div>
    </div>
  )
}
