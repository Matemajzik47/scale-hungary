// Böngészős push: támogatás ellenőrzése, bekapcsolás és kikapcsolás.
// A Profil-kapcsoló és az első értékelés utáni felugró kérdés is ezt használja.
import { supabase } from '@/lib/supabase'

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function getPushState(): Promise<PushState> {
  if (!PUBLIC_KEY || typeof window === 'undefined') return 'unsupported'
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  // iPhone-on csak a kezdőképernyőre tett alkalmazás kaphat értesítést
  if (!supported) return isIos ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ])
    if (!reg) return 'unsupported' // fejlesztői módban nincs service worker
    const sub = await reg.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'unsupported'
  }
}

/** Engedélyt kér, feliratkozik, és elmenti a feliratkozást a fiókhoz. Hibánál kivételt dob. */
export async function enablePush(): Promise<'on' | 'denied' | 'off'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!),
    }))
  const json = sub.toJSON()

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('A munkamenet lejárt, jelentkezz be újra.')

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'A mentés nem sikerült.')

  reg.showNotification('Scale', {
    body: 'Rendben! Reggelente szólunk az új megjelenésekről, és ha veszélyben a szériád.',
    icon: '/icons/icon-192.png',
  })
  return 'on'
}
