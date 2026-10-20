// A kártya háttérképe. A szerkesztő és a kártya ugyanezt rajzolja, így
// pontosan az látszik a kártyán, amit az igazításnál beállítottál.
export type CardBgPos = { x: number; y: number; zoom: number }

export const DEFAULT_BG_POS: CardBgPos = { x: 50, y: 50, zoom: 1 }

export function posFromProfile(p: {
  card_bg_x?: number | null
  card_bg_y?: number | null
  card_bg_zoom?: number | null
}): CardBgPos {
  return { x: p.card_bg_x ?? 50, y: p.card_bg_y ?? 50, zoom: p.card_bg_zoom ?? 1 }
}

export function CardBgImage({
  url,
  pos,
  className = '',
}: {
  url: string
  pos: CardBgPos
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      draggable={false}
      className={`pointer-events-none absolute inset-0 h-full w-full select-none object-cover ${className}`}
      style={{
        objectPosition: `${pos.x}% ${pos.y}%`,
        transform: `scale(${pos.zoom})`,
        transformOrigin: `${pos.x}% ${pos.y}%`,
      }}
    />
  )
}
