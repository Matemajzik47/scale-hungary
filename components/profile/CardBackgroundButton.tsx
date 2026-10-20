'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Kép átméretezése (max 1000 px széles) JPEG-gé, hogy gyors és kicsi legyen
async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1000 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.82)
  )
}

export function CardBackgroundButton({
  userId,
  hasImage,
  onChange,
}: {
  userId: string
  hasImage: boolean
  onChange: (url: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Csak képet tölthetsz fel.')
      return
    }
    setBusy(true)
    try {
      const blob = await resizeToJpeg(file)
      const path = `${userId}/card.jpg`
      const { error: upErr } = await supabase.storage
        .from('card-backgrounds')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const { data } = supabase.storage.from('card-backgrounds').getPublicUrl(path)
      const url = `${data.publicUrl}?v=${Date.now()}`
      const { error: dbErr } = await supabase.from('profiles').update({ card_bg_url: url }).eq('id', userId)
      if (dbErr) throw dbErr
      onChange(url)
    } catch {
      setError('Nem sikerült feltölteni a képet.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    const { error: dbErr } = await supabase.from('profiles').update({ card_bg_url: null }).eq('id', userId)
    if (dbErr) setError('Nem sikerült törölni.')
    else {
      await supabase.storage.from('card-backgrounds').remove([`${userId}/card.jpg`])
      onChange(null)
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {hasImage ? 'Kártyakép cseréje' : 'Kép a kártya hátuljára'}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRemove}
            aria-label="Kártyakép törlése"
            className="rounded-full border border-neutral-200 bg-white p-1.5 text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && <span className="text-[11px] font-medium text-red-500">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
