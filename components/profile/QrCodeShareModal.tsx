'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Copy, Check } from 'lucide-react'

interface QrCodeShareModalProps {
  isOpen: boolean
  onClose: () => void
  username: string
}

export function QrCodeShareModal({ isOpen, onClose, username }: QrCodeShareModalProps) {
  const [copied, setCopied] = useState(false)

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${username}` : ''

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
                  Scale Music ID
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

            <div className="relative rounded-[22px] border border-neutral-200/70 bg-[#FAFAFA] p-3.5 shadow-inner">
              <svg viewBox="0 0 200 200" className="h-44 w-44 drop-shadow-sm" fill="none">
                <rect width="200" height="200" rx="16" fill="white" />
                <rect x="18" y="18" width="50" height="50" rx="14" stroke="#1A1A1A" strokeWidth="6" />
                <rect x="31" y="31" width="24" height="24" rx="8" fill="#FF5B37" />
                <rect x="132" y="18" width="50" height="50" rx="14" stroke="#1A1A1A" strokeWidth="6" />
                <rect x="145" y="31" width="24" height="24" rx="8" fill="#FF5B37" />
                <rect x="18" y="132" width="50" height="50" rx="14" stroke="#1A1A1A" strokeWidth="6" />
                <rect x="31" y="145" width="24" height="24" rx="8" fill="#FF5B37" />
                <rect x="82" y="82" width="36" height="36" rx="10" fill="#171717" />
                <rect x="89" y="93" width="3" height="14" rx="1.5" fill="#FF5B37" />
                <rect x="95" y="88" width="3" height="24" rx="1.5" fill="#FFFFFF" />
                <rect x="101" y="91" width="3" height="18" rx="1.5" fill="#FF8F68" />
                <rect x="107" y="96" width="3" height="8" rx="1.5" fill="#FFFFFF" />
              </svg>
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
