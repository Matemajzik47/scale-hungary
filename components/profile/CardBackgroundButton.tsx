'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Trash2, Loader2, Move } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CardBgImage, DEFAULT_BG_POS, type CardBgPos } from '@/components/profile/CardBgImage'
import type { Profile } from '@/types/database'

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

type Props = {
  userId: string
  currentUrl: string | null
  currentPos: CardBgPos
  onChange: (patch: Partial<Profile>) => void
}

export function CardBackgroundButton({ userId, currentUrl, currentPos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Szerkesztő: új kép (blob) vagy a meglévő igazítása
  const [editing, setEditing] = useState(false)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pos, setPos] = useState<CardBgPos>(DEFAULT_BG_POS)

  function closeEditor() {
    if (previewUrl && pendingBlob) URL.revokeObjectURL(previewUrl)
    setEditing(false)
    setPendingBlob(null)
    setPreviewUrl(null)
  }

  async function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Csak képet tölthetsz fel.')
      return
    }
    try {
      const blob = await resizeToJpeg(file)
      setPendingBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setPos(DEFAULT_BG_POS)
      setEditing(true)
    } catch {
      setError('Ezt a képet nem tudtam megnyitni.')
    }
  }

  function openAdjust() {
    setPendingBlob(null)
    setPreviewUrl(currentUrl)
    setPos(currentPos)
    setEditing(true)
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      let url = currentUrl
      if (pendingBlob) {
        const path = `${userId}/card.jpg`
        const { error: upErr } = await supabase.storage
          .from('card-backgrounds')
          .upload(path, pendingBlob, { upsert: true, contentType: 'image/jpeg' })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('card-backgrounds').getPublicUrl(path)
        url = `${data.publicUrl}?v=${Date.now()}`
      }
      const patch = { card_bg_url: url, card_bg_x: pos.x, card_bg_y: pos.y, card_bg_zoom: pos.zoom }
      const { error: dbErr } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (dbErr) throw dbErr
      onChange(patch)
      closeEditor()
    } catch {
      setError('Nem sikerült menteni. Lefuttattad a két SQL fájlt?')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ card_bg_url: null, card_bg_x: 50, card_bg_y: 50, card_bg_zoom: 1 })
      .eq('id', userId)
    if (dbErr) setError('Nem sikerült törölni.')
    else {
      await supabase.storage.from('card-backgrounds').remove([`${userId}/card.jpg`])
      onChange({ card_bg_url: null, card_bg_x: 50, card_bg_y: 50, card_bg_zoom: 1 })
    }
    setBusy(false)
  }

  // Húzással tolható a kép a keretben
  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY }
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const last = dragRef.current
    const rect = frameRef.current?.getBoundingClientRect()
    if (!last || !rect) return
    const dx = ((e.clientX - last.x) / rect.width) * 100
    const dy = ((e.clientY - last.y) / rect.height) * 100
    dragRef.current = { x: e.clientX, y: e.clientY }
    setPos((p) => ({
      ...p,
      x: Math.min(100, Math.max(0, p.x - dx / Math.max(1, p.zoom - 0.5))),
      y: Math.min(100, Math.max(0, p.y - dy / Math.max(1, p.zoom - 0.5))),
    }))
  }
  function onUp() {
    dragRef.current = null
  }

  const hasImage = Boolean(currentUrl)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {hasImage ? 'Kép cseréje' : 'Kép a kártya hátuljára'}
        </button>
        {hasImage && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={openAdjust}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              <Move className="h-3.5 w-3.5" />
              Igazítás
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              aria-label="Kártyakép törlése"
              className="rounded-full border border-neutral-200 bg-white p-1.5 text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
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

      {editing && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeEditor} />
          <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-3 rounded-[24px] bg-white p-4 shadow-2xl">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-900">Kép igazítása</h3>
              <p className="text-xs text-neutral-500">Húzd a képet, és nagyítsd, amíg a jó rész látszik.</p>
            </div>

            <div
              ref={frameRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="relative h-[236px] w-full cursor-grab touch-none overflow-hidden rounded-[20px] bg-[#101114] active:cursor-grabbing"
            >
              <CardBgImage url={previewUrl} pos={pos} className="opacity-90" />
              <div className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-white/20" />
            </div>

            <label className="flex items-center gap-3 text-xs font-semibold text-neutral-600">
              Nagyítás
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={pos.zoom}
                onChange={(e) => setPos((p) => ({ ...p, zoom: Number(e.target.value) }))}
                className="h-2 flex-1 accent-[#FF5B37]"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="flex-1 rounded-full border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-600"
              >
                Mégse
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FF5B37] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
