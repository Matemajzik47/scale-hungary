'use client'

import Link from 'next/link'
import { LogIn, UserPlus, X } from 'lucide-react'

interface RequireAuthModalProps {
  isOpen: boolean
  onClose?: () => void
  message?: string
}

/**
 * Kötelező bejelentkezés popup — ott jelenik meg, ahol az adott funkció
 * (rate-elés, profil megtekintése, stb.) bejelentkezést igényel, de a
 * böngészés/keresés/dalok megtekintése anélkül is elérhető marad.
 */
export function RequireAuthModal({ isOpen, onClose, message }: RequireAuthModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex select-none items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div className="relative z-10 flex w-full max-w-[320px] flex-col items-center gap-4 rounded-[28px] border border-neutral-100 bg-white p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Bezárás"
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF5B37]/10 text-[#FF5B37]">
          <LogIn className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-neutral-900">Bejelentkezés szükséges</h3>
          <p className="mt-1 text-xs text-neutral-500">
            {message ?? 'A folytatáshoz jelentkezz be, vagy hozz létre egy Scale fiókot.'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF5B37] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#F44B26]"
          >
            <LogIn className="h-3.5 w-3.5" />
            Bejelentkezés
          </Link>
          <Link
            href="/register"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Regisztráció
          </Link>
        </div>
      </div>
    </div>
  )
}
