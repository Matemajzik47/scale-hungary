import Link from 'next/link'
import { Bricolage_Grotesque } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { IdCardPreview } from '@/components/landing/IdCardPreview'
import { TryCard, type TryTrack } from '@/components/landing/TryCard'
import { StatsGrid } from '@/components/landing/StatsGrid'
import { TIERS } from '@/lib/tiers'

const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
  variable: '--font-display',
})

// A számok és a borítók percenként frissülnek (a cron 30 percenként bővíti a katalógust)
export const revalidate = 60

type AlbumRow = {
  id: string
  title: string
  cover_url: string | null
  artists: { name: string } | null
  tracks: { id: string; title: string }[] | null
}

async function countRows(table: 'artists' | 'albums' | 'tracks' | 'ratings'): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return error ? null : count ?? 0
}

async function getLandingData() {
  const [artists, albums, tracks, ratings] = await Promise.all([
    countRows('artists'),
    countRows('albums'),
    countRows('tracks'),
    countRows('ratings'),
  ])

  const { data: albumRows } = await supabase
    .from('albums')
    .select('id, title, cover_url, artists(name), tracks(id, title)')
    .not('cover_url', 'is', null)
    .order('release_date', { ascending: false })
    .limit(24)

  const rows = ((albumRows ?? []) as unknown as AlbumRow[]).filter((a) => a.cover_url)
  const covers = rows.map((a) => a.cover_url as string)

  // Kipróbálható kártya: egy véletlen dal a legfrissebb borítós albumokról
  let tryTrack: TryTrack | null = null
  const withTracks = rows.filter((a) => (a.tracks ?? []).length > 0)
  if (withTracks.length > 0) {
    const album = withTracks[Math.floor(Math.random() * withTracks.length)]
    const tracksList = album.tracks ?? []
    const track = tracksList[Math.floor(Math.random() * tracksList.length)]

    const { data: scoreRows } = await supabase.from('ratings').select('score').eq('track_id', track.id)
    const scores = (scoreRows ?? []).map((r) => Number(r.score))

    tryTrack = {
      title: track.title,
      artist: album.artists?.name ?? 'Ismeretlen előadó',
      coverUrl: album.cover_url,
      communityAverage: scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
      totalRatings: scores.length,
    }
  }

  return { counts: { artists, albums, tracks, ratings }, covers, tryTrack }
}

const PLACEHOLDER_BG = ['#FF5B37', '#111214', '#F6F4F1', '#2A2B30', '#FF8F68', '#111214']

// Egy sornyi borító: legalább 12 elemre feltöltve, majd megkettőzve, hogy a ciklus zökkenőmentes legyen
function CoverRow({ covers, reverse }: { covers: string[]; reverse?: boolean }) {
  const base: (string | null)[] = []
  for (let i = 0; base.length < 12; i++) {
    base.push(covers.length > 0 ? covers[i % covers.length] : null)
  }
  const items = [...base, ...base]

  return (
    <div className={`marquee-track ${reverse ? 'marquee-track-reverse' : ''}`}>
      {items.map((src, i) =>
        src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            loading="lazy"
            className="aspect-square w-[132px] flex-none rounded-2xl object-cover"
          />
        ) : (
          <div
            key={i}
            style={{ background: PLACEHOLDER_BG[i % PLACEHOLDER_BG.length] }}
            className="aspect-square w-[132px] flex-none rounded-2xl"
          />
        )
      )}
    </div>
  )
}

export default async function Home() {
  const { counts, covers, tryTrack } = await getLandingData()

  const half = Math.ceil(covers.length / 2)
  const rowA = covers.slice(0, half)
  const rowB = covers.slice(half)

  const stats = [
    { label: 'Album', value: counts.albums },
    { label: 'Dal', value: counts.tracks },
    { label: 'Előadó', value: counts.artists },
    { label: 'Értékelés', value: counts.ratings },
  ]

  return (
    <main
      className={`${display.variable} flex-1 overflow-x-clip bg-white px-4 text-[#111214]`}
    >
      <div className="mx-auto w-full max-w-[1120px]">
        {/* Hero */}
        <header className="grid items-center gap-10 py-9 md:grid-cols-[1.15fr_0.85fr] md:py-16">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#FF5B37]">
              Magyar zene · dalonként értékelve
            </div>
            <h1 className="mt-3.5 font-[family-name:var(--font-display)] text-[clamp(44px,9vw,92px)] font-extrabold leading-[0.95] tracking-[-0.02em] [text-wrap:balance]">
              Személyi az{' '}
              <em className="box-decoration-clone rounded-[0.12em] bg-[#FF5B37] px-[0.12em] not-italic text-white">
                ízlésednek.
              </em>
            </h1>
            <p className="my-6 max-w-[48ch] text-lg text-[#5F6064]">
              Rate-eld a magyar zenéket, és építsd fel a saját Taste ID-dat! Fedezd fel
              ismerőseid ízlését és osztozzatok együtt a zene örömében!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-[#FF5B37] px-[22px] py-3 text-sm font-bold text-white transition hover:bg-[#F04A26] active:scale-[0.97]"
              >
                Készítsd el az ID-det
              </Link>
              <a
                href="#proba"
                className="inline-flex items-center justify-center rounded-full border-[1.5px] border-[#111214] px-[22px] py-3 text-sm font-bold text-[#111214] transition hover:bg-[#111214] hover:text-white active:scale-[0.97]"
              >
                Próbáld ki regisztráció nélkül
              </a>
            </div>
          </div>
          <div className="grid place-items-center p-2">
            <IdCardPreview />
          </div>
        </header>

        {/* Élő számok */}
        <StatsGrid stats={stats} />

        {/* Kipróbálható kártya */}
        <section id="proba" className="grid items-center gap-8 py-[72px] md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#FF5B37]">
              Próbáld ki
            </div>
            <h2 className="mt-3.5 font-[family-name:var(--font-display)] text-[clamp(32px,5vw,52px)] font-extrabold leading-none tracking-[-0.02em] [text-wrap:balance]">
              Hallgass bele, húzd a csúszkát. Mentéshez elég belépni.
            </h2>
            <p className="mt-4 max-w-[42ch] text-[#5F6064]">
              A felfedezőt fiók nélkül is kipróbálhatod. Amikor értékelnél, kérünk egy gyors
              bejelentkezést, hogy a pontszámod a te ID-dhez kerüljön.
            </p>
          </div>
          <TryCard track={tryTrack} />
        </section>

        {/* Borítósáv */}
        {covers.length > 0 && (
          <section aria-hidden="true" className="-mx-4 overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <CoverRow covers={rowA.length > 0 ? rowA : covers} />
            <div className="mt-3.5">
              <CoverRow covers={rowB.length > 0 ? rowB : covers} reverse />
            </div>
          </section>
        )}

        {/* Lépések */}
        <section className="pb-[72px] pt-20">
          <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#FF5B37]">
            Így megy
          </div>
          <h2 className="mt-3.5 max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(30px,5vw,48px)] font-extrabold leading-none tracking-[-0.02em] [text-wrap:balance]">
            Három mozdulat az ID-dig.
          </h2>
          <div className="mt-8 grid gap-3.5 md:grid-cols-3">
            {[
              {
                n: '1',
                t: 'Húzd',
                d: 'Végigpörgeted a friss magyar kiadásokat, és belehallgatsz a dalokba.',
              },
              {
                n: '2',
                t: 'Rate-eld',
                d: 'Pontozol 1.0 és 10.0 között, fél pontos lépésekkel. Minden dalnak külön pontszáma van.',
              },
              {
                n: '3',
                t: 'Oszd meg',
                d: 'A profilod QR-kódja bárkit odavisz az ízlésedhez, rangsorral és szériával.',
              },
            ].map((s) => (
              <div key={s.n} className="border-t-[1.5px] border-[#111214] pt-4">
                <div className="font-mono text-xs font-bold tracking-[0.1em] text-[#FF5B37]">{s.n}</div>
                <h3 className="my-2 font-[family-name:var(--font-display)] text-[26px] font-extrabold tracking-[-0.02em]">
                  {s.t}
                </h3>
                <p className="max-w-[34ch] text-[#5F6064]">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Napi visszatérés és szintek */}
        <section className="pb-[72px]">
          <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#FF5B37]">
            Maradj velünk
          </div>
          <h2 className="mt-3.5 max-w-[20ch] font-[family-name:var(--font-display)] text-[clamp(30px,5vw,48px)] font-extrabold leading-none tracking-[-0.02em] [text-wrap:balance]">
            Gyere vissza minden nap, lépj szintet, váltsd be a pontjaidat.
          </h2>
          <div className="mt-8 grid gap-3.5 md:grid-cols-3">
            {[
              {
                t: 'Napi széria',
                d: 'Minden nap, amikor értékelsz egy dalt, nő a szériád. Ha kihagysz egy napot, újraindul.',
              },
              {
                t: 'Szintlépés',
                d: 'Minél több dalt értékelsz, annál följebb jutsz, és annál többet mond rólad az ID-d.',
              },
              {
                t: 'Pontok beváltása',
                d: 'A szintekhez jutalmak és creditek tartoznak majd. Hamarosan itt találod őket.',
              },
            ].map((x) => (
              <div key={x.t} className="rounded-3xl bg-[#F6F4F1] p-6">
                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-extrabold tracking-[-0.02em]">
                  {x.t}
                </h3>
                <p className="mt-2 text-[#5F6064]">{x.d}</p>
              </div>
            ))}
          </div>

          {/* Szint-létra: a jutalom helye egyelőre üres, később töltjük fel */}
          <div className="mt-8">
            <div className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#5F6064]">
              Szintek és jutalmak
            </div>
            <ol className="grid gap-3 md:grid-cols-5">
              {TIERS.map((tier, i) => {
                const isTop = i === TIERS.length - 1
                return (
                  <li
                    key={tier.label}
                    className={`flex min-w-0 flex-col gap-3 rounded-3xl p-5 ${
                      isTop ? 'bg-[#111214] text-white' : 'border-[1.5px] border-[#111214] bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#FF5B37]">
                        {tier.minRatings === 0 ? 'Induló szint' : `${tier.minRatings} értékeléstől`}
                      </div>
                      <h4 className="mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.02em]">
                        {tier.label}
                      </h4>
                    </div>
                    <div
                      className={`mt-auto rounded-2xl border border-dashed px-3 py-3 text-xs ${
                        isTop ? 'border-white/30 text-neutral-400' : 'border-neutral-300 text-[#5F6064]'
                      }`}
                    >
                      Jutalom helye
                      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] opacity-70">
                        hamarosan
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* Záró CTA */}
        <section className="mb-10 grid items-center justify-items-start gap-5 rounded-[32px] bg-[#111214] px-7 py-12 text-white md:grid-cols-[1.3fr_auto] md:p-16">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,5.5vw,56px)] font-extrabold leading-none tracking-[-0.02em] [text-wrap:balance]">
            Mutasd meg, mit hallgatsz.
          </h2>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-[#FF5B37] px-7 py-4 text-[15px] font-bold text-white transition hover:bg-[#F04A26] active:scale-[0.97]"
          >
            Regisztráció, 1 perc
          </Link>
        </section>

        <footer className="flex flex-wrap justify-between gap-3 pb-8 font-mono text-xs text-[#5F6064]">
          <span>Scale · ID for your taste</span>
          <span>Magyar zene, közösségi pontszámokkal</span>
        </footer>
      </div>
    </main>
  )
}
