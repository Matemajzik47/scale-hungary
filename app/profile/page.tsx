'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Share2, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { loadProfileDataByUserId, type ProfileData } from '@/lib/profileData'
import { ProfileDisplay } from '@/components/profile/ProfileDisplay'
import { QrCodeShareModal } from '@/components/profile/QrCodeShareModal'
import { RequireAuthModal } from '@/components/RequireAuthModal'

export default function ProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)

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

      const profileData = await loadProfileDataByUserId(user.id)
      setData(profileData)
      setLoading(false)
    }

    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

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
        message="A profilod megtekintéséhez jelentkezz be, vagy hozz létre egy Scale fiókot."
      />
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 px-4 py-4">
      <ProfileDisplay data={data} />

      <div className="pb-1 pt-1">
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF5B37] px-5 py-3 text-xs font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(255,91,55,0.3)] transition-all hover:bg-[#F44B26] active:scale-[0.98]"
        >
          <QrCode className="h-4 w-4" />
          <span>Profil megosztása</span>
          <Share2 className="h-3.5 w-3.5 opacity-80" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        Kijelentkezés
      </button>

      <QrCodeShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        username={data.profile.username}
      />
    </div>
  )
}
