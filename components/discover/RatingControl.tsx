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
    <div className="flex w-full flex-col gap-2.5 pt-1">
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

      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min="1"
          max="10"
          step="0.1"
          value={rating}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#FF5B37] focus:outline-none"
          style={{
            background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT} ${
              ((rating - 1) / 9) * 100
            }%, #E5E7EB ${((rating - 1) / 9) * 100}%, #E5E7EB 100%)`,
          }}
        />
        <div className="flex justify-between px-0.5 font-mono text-[10px] font-medium text-neutral-400">
          <span>1.0</span>
          <span>3.0</span>
          <span>5.0</span>
          <span>7.0</span>
          <span>9.0</span>
          <span>10.0</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-0.5 text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-700">{getRatingLabel(rating)}</span>
        <span className="text-[10px] text-neutral-400">Húzd jobbra a mentéshez</span>
      </div>
    </div>
  )
}
