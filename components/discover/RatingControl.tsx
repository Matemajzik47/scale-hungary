'use client'

interface RatingControlProps {
  rating: number
  onChange: (val: number) => void
}

const ACCENT = '#FF5B37'

function getRatingLabel(score: number) {
  if (score >= 9.0) return 'Korszakos mestermű'
  if (score >= 8.0) return 'Kiemelkedő élmény'
  if (score >= 7.0) return 'Nagyon jó megjelenés'
  if (score >= 6.0) return 'Ígéretes dal'
  if (score >= 5.0) return 'Átlagos zenei munka'
  return 'Nem nekem való'
}

export function RatingControl({ rating, onChange }: RatingControlProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Saját értékelésed
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          {rating.toFixed(1)}
        </span>
      </div>

      <input
        type="range"
        min="1"
        max="10"
        step="0.1"
        value={rating}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label="Pontszám"
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#FF5B37] focus:outline-none"
        style={{
          background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT} ${
            ((rating - 1) / 9) * 100
          }%, #E5E7EB ${((rating - 1) / 9) * 100}%, #E5E7EB 100%)`,
        }}
      />

      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-700">{getRatingLabel(rating)}</span>
        <span className="text-[10px] text-neutral-400">Húzd jobbra a mentéshez</span>
      </div>
    </div>
  )
}
