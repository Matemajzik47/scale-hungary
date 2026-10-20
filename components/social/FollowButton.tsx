'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { followUser, unfollowUser } from '@/lib/social'

interface FollowButtonProps {
  myId: string
  targetId: string
  following: boolean
  onChange: (following: boolean) => void
}

export function FollowButton({ myId, targetId, following, onChange }: FollowButtonProps) {
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    const ok = following ? await unfollowUser(myId, targetId) : await followUser(myId, targetId)
    if (ok) onChange(!following)
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-60 ${
        following
          ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
          : 'bg-[#FF5B37] text-white shadow-[0_4px_14px_rgba(255,91,55,0.3)] hover:bg-[#F44B26]'
      }`}
    >
      {following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {following ? 'Követed' : 'Követés'}
    </button>
  )
}
