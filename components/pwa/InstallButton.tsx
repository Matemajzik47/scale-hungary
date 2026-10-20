'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

// A böngésző telepítési eseménye (nem része a TypeScript alap típusainak)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Mode = 'hidden' | 'prompt' | 'ios'

// "Telepítés a telefonra" gomb. Androidon / asztali Chrome-ban a böngésző saját
// telepítő ablakát hívja meg, iPhone-on (ahol nincs ilyen) leírja a lépéseket.
export function InstallButton() {
  const [mode, setMode] = useState<Mode>('hidden')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHelpOpen, setIosHelpOpen] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIos) {
      // Aszinkron beállítás, hogy ne a render alatt változzon az állapot
      const t = setTimeout(() => setMode('ios'), 0)
      return () => clearTimeout(t)
    }

    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('prompt')
    }
    function onInstalled() {
      setMode('hidden')
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (mode === 'hidden') return null

  async function handleClick() {
    if (mode === 'ios') {
      setIosHelpOpen(true)
      return
    }
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setMode('hidden')
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-800 active:scale-[0.98]"
      >
        <Download className="h-3.5 w-3.5" />
        Telepítés a telefonra
      </button>

      {iosHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            onClick={() => setIosHelpOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-[340px] rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              onClick={() => setIosHelpOpen(false)}
              aria-label="Bezárás"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <h3 className="text-sm font-bold text-neutral-900">Scale az iPhone főképernyőjére</h3>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-xs text-neutral-600">
              <li>
                Nyisd meg az oldalt <b>Safariban</b>.
              </li>
              <li className="flex items-center gap-1">
                Koppints a <Share className="inline h-3.5 w-3.5" /> <b>Megosztás</b> gombra.
              </li>
              <li>
                Válaszd a <b>Főképernyőhöz adás</b> lehetőséget, majd a <b>Hozzáadás</b> gombot.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
