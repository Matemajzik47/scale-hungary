// A kártya háttere: dőlt albumborító-mozaik, mint egy ízlés-kollázs.
export function CoverMosaic({ covers }: { covers: string[] }) {
  if (covers.length === 0) return null
  const tiles = Array.from({ length: 15 }, (_, i) => covers[i % covers.length])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-55">
      <div className="absolute -inset-[18%] grid -rotate-[8deg] grid-cols-5 gap-1.5">
        {tiles.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className="aspect-square w-full rounded-md object-cover saturate-[0.8]"
          />
        ))}
      </div>
    </div>
  )
}
