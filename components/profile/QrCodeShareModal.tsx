'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Copy, Check } from 'lucide-react'
import QRCodeStyling from 'qr-code-styling'

interface QrCodeShareModalProps {
  isOpen: boolean
  onClose: () => void
  username: string
}

export function QrCodeShareModal({ isOpen, onClose, username }: QrCodeShareModalProps) {
  const [copied, setCopied] = useState(false)
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const qrInstanceRef = useRef<QRCodeStyling | null>(null)

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${username}` : ''

  // Valódi, beolvasható QR-kód generálása a profil linkből — lekerekített
  // pontokkal és Scale-narancs akcentussal, a mockup stílusát követve
  useEffect(() => {
    if (!isOpen || !profileUrl || !qrContainerRef.current) return

    if (!qrInstanceRef.current) {
      qrInstanceRef.current = new QRCodeStyling({
        width: 184,
        height: 184,
        type: 'svg',
        data: profileUrl,
        margin: 4,
        qrOptions: { errorCorrectionLevel: 'H' },
        dotsOptions: { type: 'rounded', color: '#171717' },
        cornersSquareOptions: { type: 'extra-rounded', color: '#171717' },
        cornersDotOptions: { type: 'dot', color: '#FF5B37' },
        backgroundOptions: { color: '#FFFFFF' },
        imageOptions: { imageSize: 0.32, margin: 4, crossOrigin: 'anonymous' },
      })
      qrContainerRef.current.innerHTML = ''
      qrInstanceRef.current.append(qrContainerRef.current)
    } else {
      qrInstanceRef.current.update({ data: profileUrl })
    }
  }, [isOpen, profileUrl])

  function handleCopy() {
    navigator.clipboard?.writeText(profileUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex select-none items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-10 flex w-full max-w-[320px] flex-col items-center gap-4 rounded-[28px] border border-neutral-100 bg-white p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FF5B37]" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Scale Music Taste ID
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Bezárás"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative flex h-[184px] w-[184px] items-center justify-center rounded-[22px] border border-neutral-200/70 bg-[#FAFAFA] shadow-inner">
              <div ref={qrContainerRef} aria-label={`QR kód @${username} profiljához`} />
              <div className="pointer-events-none absolute flex h-9 w-9 items-center justify-center gap-[2.5px] rounded-[10px] bg-[#171717] shadow-md">
                <span className="h-2 w-[2.5px] rounded-full bg-[#FF5B37]" />
                <span className="h-4 w-[2.5px] rounded-full bg-white" />
                <span className="h-3 w-[2.5px] rounded-full bg-[#FF8F68]" />
                <span className="h-[18px] w-[2.5px] rounded-full bg-white" />
                <span className="h-2.5 w-[2.5px] rounded-full bg-[#FF5B37]" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-extrabold tracking-tight text-neutral-900">
                @{username}
              </span>
              <p className="text-xs font-medium text-neutral-500">
                Olvasd be a zenei ízlésem megtekintéséhez
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all ${
                copied
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 active:scale-[0.98]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Profil link másolva!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Link másolása</span>
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
