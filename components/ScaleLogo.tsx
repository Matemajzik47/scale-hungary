// A Scale logó: sötét lekerekített négyzet öt hanghullám-oszloppal.
// Ugyanez van a profil-megosztó QR-kód közepén is.

const BARS = [
  { h: 8, c: '#FF5B37' },
  { h: 16, c: '#FFFFFF' },
  { h: 12, c: '#FF8F68' },
  { h: 18, c: '#FFFFFF' },
  { h: 10, c: '#FF5B37' },
]

export function ScaleLogo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`shrink-0 rounded-[10px] ring-1 ring-white/15 ${className}`}
    >
      <rect width="36" height="36" rx="10" fill="#171717" />
      {BARS.map((b, i) => (
        <rect key={i} x={6.75 + i * 5} y={18 - b.h / 2} width="2.5" height={b.h} rx="1.25" fill={b.c} />
      ))}
    </svg>
  )
}
