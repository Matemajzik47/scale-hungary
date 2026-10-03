'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { UserX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { loadProfileDataByUsername, type ProfileData } from '@/lib/profileData'
import { ProfileDisplay } from '@/components/profile/ProfileDisplay'
import { RequireAuthModal } from '@/components/RequireAuthModal'

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>()
  const [data, setData] = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }

      const profileData = await loadProfileDataByUsername(params.username)
      if (!profileData) {
        setNotFound(true)
      } else {
        setData(profileData)
      }
      setLoading(false)
    }

    load()
  }, [params.username])

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-neutral-400">
        Betöltés...
      </div>
    )
  }

  if (needsAuth) {
    return (
      <RequireAuthModal
        isOpen
        message="Ehhez a profilhoz bejelentkezés szükséges. Jelentkezz be, vagy hozz létre egy Scale fiókot."
      />
    )
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 px-6 text-center text-neutral-500">
        <UserX className="h-8 w-8 text-neutral-300" />
        <p className="text-sm font-bold text-neutral-700">Ez a profil nem található</p>
        <p className="text-xs text-neutral-400">
          Ellenőrizd a linket, vagy hogy jól írtad-e be a felhasználónevet.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      <ProfileDisplay data={data} />
    </div>
  )
}
