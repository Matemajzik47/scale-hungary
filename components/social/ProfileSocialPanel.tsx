'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  computeMatch,
  getFollowCounts,
  isFollowing,
  type TasteMatch,
} from '@/lib/social'
import { FollowButton } from '@/components/social/FollowButton'
import { TasteMatchCard } from '@/components/social/TasteMatchCard'

interface ProfileSocialPanelProps {
  profileUserId: string
  profileUsername: string
}

// A profil "közösségi" sávja: követők / követettek, követés gomb és ízlés-egyezés.
// Saját profilon az ismerősök oldalára vezet, más profilján követhető a felhasználó.
export function ProfileSocialPanel({ profileUserId, profileUsername }: ProfileSocialPanelProps) {
  const [myId, setMyId] = useState<string | null>(null)
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [match, setMatch] = useState<TasteMatch | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const me = user?.id ?? null
      const own = me === profileUserId

      const [countsResult, followingResult, matchResult] = await Promise.all([
        getFollowCounts(profileUserId),
        me && !own ? isFollowing(me, profileUserId) : Promise.resolve(false),
        me && !own ? computeMatch(me, profileUserId) : Promise.resolve(null),
      ])

      if (cancelled) return
      setMyId(me)
      setCounts(countsResult)
      setFollowing(followingResult)
      setMatch(matchResult)
      setReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profileUserId])

  if (!ready) return null

  const isOwn = myId === profileUserId

  function handleFollowChange(next: boolean) {
    setFollowing(next)
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (next ? 1 : -1)) }))
  }

  return (
    <>
      <section className="flex items-center justify-between gap-3 rounded-[22px] border border-neutral-200/80 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-4 pl-1">
          <div className="flex flex-col">
            <span className="font-mono text-base font-black text-neutral-900">{counts.followers}</span>
            <span className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">
              Követő
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-base font-black text-neutral-900">{counts.following}</span>
            <span className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">
              Követett
            </span>
          </div>
        </div>

        {isOwn ? (
          <Link
            href="/profile/network"
            className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 active:scale-95"
          >
            <Users className="h-3.5 w-3.5" />
            Ismerőseim
          </Link>
        ) : (
          myId && (
            <FollowButton
              myId={myId}
              targetId={profileUserId}
              following={following}
              onChange={handleFollowChange}
            />
          )
        )}
      </section>

      {!isOwn && match && <TasteMatchCard match={match} username={profileUsername} />}
    </>
  )
}
