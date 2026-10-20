'use client'

import { useEffect, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'
import { ScaleLogo } from '@/components/ScaleLogo'

// A profil megosztásánál használt QR-kód kicsiben, a kártyán
export function CardQr({ username, size = 72 }: { username: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const qr = new QRCodeStyling({
      width: size,
      height: size,
      type: 'svg',
      data: `${window.location.origin}/u/${username}`,
      margin: 0,
      qrOptions: { errorCorrectionLevel: 'H' },
      dotsOptions: { type: 'rounded', color: '#171717' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#171717' },
      cornersDotOptions: { type: 'dot', color: '#FF5B37' },
      backgroundOptions: { color: '#FFFFFF' },
    })
    el.innerHTML = ''
    qr.append(el)
  }, [username, size])

  return (
    <div
      className="relative shrink-0 rounded-[12px] bg-white p-[5px] shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
      style={{ width: size + 10, height: size + 10 }}
      aria-label={`QR kód @${username} profiljához`}
    >
      <div ref={ref} className="[&_svg]:block" />
      <ScaleLogo className="pointer-events-none absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 shadow" />
    </div>
  )
}
