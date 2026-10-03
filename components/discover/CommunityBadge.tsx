'use client'

interface CommunityBadgeProps {
  score: number | null
  totalRatings: number
  onClick?: () => void
}

export function CommunityBadge({ score, totalRatings, onClick }: CommunityBadgeProps) {
  if (score === null || totalRatings === 0) {
    return (
      <div className="rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-medium text-neutral-500">
        Még nincs közösségi értékelés
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200"
    >
      <span className="font-bold text-[#FF5B37]">{score.toFixed(1)}</span>
      <span className="text-neutral-400">·</span>
      <span>{totalRatings} értékelés</span>
    </button>
  )
}
