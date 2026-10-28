'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Share2 } from 'lucide-react'

interface ShareStoryButtonProps {
  username: string
  // Változik, ha a kártya megjelenése vagy az adatai megváltoznak (új háttér, új értékelés), így friss képet kérünk
  version: string
}

/**
 * A saját Taste ID kártya megosztása Story-képként (1080x1920).
 * A kép szerveroldalon készül, a felhasználó saját háttérképével. Mobilon a rendszer megosztó
 * lapja nyílik (Instagram, Messenger stb.), máshol a kép letöltődik.
 * A képet előre betöltjük, hogy a megosztás a koppintás pillanatában azonnal indulhasson
 * (a böngészők csak közvetlenül a koppintás után engedik a megosztást).
 */
export function ShareStoryButton({ username, version }: ShareStoryButtonProps) {
  const imagePromise = useRef<Promise<Blob> | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const loadImage = useCallback((): Promise<Blob> => {
    const url = `/api/story/${encodeURIComponent(username)}?v=${encodeURIComponent(version)}`
    const p = fetch(url).then((res) => {
      if (!res.ok) throw new Error('story')
      return res.blob()
    })
    // Hibánál a következő kattintás újrapróbálja
    p.catch(() => {
      if (imagePromise.current === p) imagePromise.current = null
    })
    imagePromise.current = p
    return p
  }, [username, version])

  useEffect(() => {
    const t = setTimeout(() => {
      void loadImage().catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [loadImage])

  async function handleShare() {
    setBusy(true)
    setNote(null)
    try {
      const blob = await (imagePromise.current ?? loadImage())
      const file = new File([blob], `scale-taste-id-${username}.png`, { type: 'image/png' })

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Scale Music Taste ID',
          text: `Ez az én Music Taste ID-m a Scale-en: ${window.location.origin}/u/${username}`,
        })
      } else {
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(href), 4000)
        setNote('A kép elmentve. Töltsd fel Story-ként, és tedd ki a linket.')
      }
    } catch (e) {
      // A megosztó lap bezárása nem hiba
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setNote('Nem sikerült elkészíteni a képet. Próbáld újra egy kicsit később.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-[#FF5B37] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#f04d29] active:scale-95 disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        Megosztás Story-ban
      </button>
      {note && <span className="max-w-[280px] text-center text-[11px] font-medium text-neutral-500">{note}</span>}
    </div>
  )
}
