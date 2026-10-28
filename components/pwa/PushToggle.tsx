'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type State = 'loading' | 'hidden' | 'ios-install' | 'denied' | 'off' | 'on'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function authHeader(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
}

// Reggeli (8:00) értesítés be- és kikapcsolása. Naponta legfeljebb egy üzenet megy,
// és csak akkor, ha van új, még nem értékelt megjelenés.
export function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!PUBLIC_KEY) return 'hidden'
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      // iPhone-on csak a kezdőképernyőre tett alkalmazás kaphat értesítést
      if (!supported) return isIos ? 'ios-install' : 'hidden'
      if (Notification.permission === 'denied') return 'denied'
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ])
        if (!reg) return 'hidden' // fejlesztői módban nincs service worker
        const sub = await reg.pushManager.getSubscription()
        return sub && Notification.permission === 'granted' ? 'on' : 'off'
      } catch {
        return 'hidden'
      }
    }
    init().then((s) => {
      if (!cancelled) setState(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!),
        }))
      const json = sub.toJSON()
      const headers = await authHeader()
      if (!headers) throw new Error('A munkamenet lejárt, jelentkezz be újra.')
      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'A mentés nem sikerült.')
      setState('on')
      reg.showNotification('Scale', {
        body: 'Rendben! Minden reggel 8-kor szólunk, ha új megjelenés vár az értékelésedre.',
        icon: '/icons/icon-192.png',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nem sikerült bekapcsolni.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const headers = await authHeader()
        if (headers) {
          await fetch('/api/push-subscribe', { method: 'DELETE', headers, body: JSON.stringify({ endpoint: sub.endpoint }) })
        }
        await sub.unsubscribe()
      }
      setState('off')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nem sikerült kikapcsolni.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'hidden') return null

  if (state === 'ios-install') {
    return (
      <div className="rounded-2xl border border-neutral-200 px-4 py-3 text-xs text-neutral-500">
        <div className="flex items-center gap-2 font-semibold text-neutral-700">
          <Bell className="h-3.5 w-3.5" /> Reggeli értesítés
        </div>
        <p className="mt-1">
          iPhone-on előbb add hozzá az oldalt a kezdőképernyődhöz (Megosztás → Főképernyőhöz adás), és onnan megnyitva itt
          bekapcsolhatod.
        </p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl border border-neutral-200 px-4 py-3 text-xs text-neutral-500">
        <div className="flex items-center gap-2 font-semibold text-neutral-700">
          <BellOff className="h-3.5 w-3.5" /> Az értesítések le vannak tiltva
        </div>
        <p className="mt-1">A böngésző beállításaiban engedélyezd az értesítéseket ehhez az oldalhoz, utána itt bekapcsolhatod.</p>
      </div>
    )
  }

  const on = state === 'on'
  return (
    <div>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        className={`flex w-full items-center justify-between gap-3 rounded-full border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-60 ${
          on ? 'border-[#FF5B37]/40 bg-[#FFF5F2] text-[#FF5B37]' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
        }`}
      >
        <span className="flex items-center gap-2">
          {on ? <Bell className="h-3.5 w-3.5 fill-current" /> : <BellOff className="h-3.5 w-3.5" />}
          Reggeli értesítés (8:00)
        </span>
        <span>{busy ? '...' : on ? 'Bekapcsolva' : 'Bekapcsolás'}</span>
      </button>
      {error && <p className="mt-1.5 px-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  )
}
