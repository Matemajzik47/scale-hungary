import path from 'node:path'
import { readFile } from 'node:fs/promises'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { fetchProgress } from '@/lib/progress'
import { getLevelInfo } from '@/lib/levels'
import { idNumberFor, waveFor } from '@/lib/taste-hash'
import { posFromProfile, type CardBgPos } from '@/components/profile/CardBgImage'
import { SITE_URL } from '@/lib/site'
import type { Profile, UserStats } from '@/types/database'

/**
 * A megosztható képek (Story és link-előnézet) közös része.
 * A kártya mindenkinél a saját háttérképével készül, pontosan úgy, ahogy a profilon beállította.
 */

const ORANGE = '#FF5B37'
const SOFT_ORANGE = '#FF8F68'

export type TasteImageData = {
  username: string
  levelTitle: string
  levelNumber: number
  curatorScore: number | null
  totalRatings: number
  streak: number
  bg: BgImage | null
  bgPos: CardBgPos
  qrDataUrl: string
  profileUrl: string
  idNumber: string
  wave: number[]
}

// ---- betűtípusok (az assets/fonts mappából; a next.config.ts gondoskodik róla, hogy a buildbe kerüljenek) ----
// Az ékezetes betűk (ő, ű) miatt a latin és a latin-ext részhalmaz egy fájlba van egyesítve.
const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts')
const readFont = (file: string) =>
  readFile(path.join(FONT_DIR, file)).then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)

export async function loadFonts() {
  const [sora700, sora800, manrope700] = await Promise.all([
    readFont('Sora-700.ttf'),
    readFont('Sora-800.ttf'),
    readFont('Manrope-700.ttf'),
  ])
  return [
    { name: 'Sora', data: sora700, weight: 700 as const, style: 'normal' as const },
    { name: 'Sora', data: sora800, weight: 800 as const, style: 'normal' as const },
    { name: 'Manrope', data: manrope700, weight: 700 as const, style: 'normal' as const },
  ]
}

// ---- adatok ----
type BgImage = { dataUrl: string; width: number; height: number }

// A kép méretét a fejlécből olvassuk ki (JPEG és PNG), hogy a kivágást pontosan magunk számolhassuk
function imageSize(buf: Buffer, type: string): { width: number; height: number } | null {
  try {
    if (type === 'image/png') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (type === 'image/jpeg') {
      let i = 2
      while (i < buf.length) {
        if (buf[i] !== 0xff) return null
        const marker = buf[i + 1]
        const len = buf.readUInt16BE(i + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
        }
        i += 2 + len
      }
    }
  } catch {
    return null
  }
  return null
}

async function loadBackground(url: string | null | undefined): Promise<BgImage | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0]
    if (type !== 'image/jpeg' && type !== 'image/png') return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 6 * 1024 * 1024) return null
    const size = imageSize(buf, type)
    if (!size || size.width < 1 || size.height < 1) return null
    return { dataUrl: `data:${type};base64,${buf.toString('base64')}`, ...size }
  } catch {
    return null
  }
}

async function qrFor(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#171717', light: '#FFFFFF' },
  })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export async function loadTasteImageData(username: string): Promise<TasteImageData | null> {
  const { data: profileData } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
  if (!profileData) return null
  const profile = profileData as Profile

  const [{ data: statsData }, { data: ratingRows }, progress, bgDataUrl] = await Promise.all([
    supabase.from('user_stats').select('*').eq('user_id', profile.id).maybeSingle(),
    supabase.from('ratings').select('score').eq('user_id', profile.id),
    fetchProgress(profile.id),
    loadBackground(profile.card_bg_url),
  ])

  const stats = (statsData as UserStats | null) ?? null
  const scores = ((ratingRows as { score: number }[] | null) ?? []).map((r) => Number(r.score))
  const total = scores.length
  const curatorScore = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : null
  const level = progress?.level ?? getLevelInfo(total * 10)

  const profileUrl = `${SITE_URL}/u/${profile.username}`
  return {
    username: profile.username,
    levelTitle: level.title,
    levelNumber: level.level,
    curatorScore,
    totalRatings: total,
    streak: stats?.current_streak ?? 0,
    bg: bgDataUrl,
    bgPos: posFromProfile(profile),
    qrDataUrl: await qrFor(profileUrl),
    profileUrl,
    idNumber: idNumberFor(profile.username),
    wave: waveFor(profile.username),
  }
}

// ---- rajzolás (satori: minden többgyermekes elemnek flex kell) ----
function Logo({ size }: { size: number }) {
  const bars = [
    { h: 8, c: ORANGE },
    { h: 16, c: '#FFFFFF' },
    { h: 12, c: SOFT_ORANGE },
    { h: 18, c: '#FFFFFF' },
    { h: 10, c: ORANGE },
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <rect x="0.5" y="0.5" width="35" height="35" rx="9.5" fill="#171717" stroke="rgba(255,255,255,0.22)" />
      {bars.map((b, i) => (
        <rect key={i} x={6.75 + i * 5} y={18 - b.h / 2} width="2.5" height={b.h} rx="1.25" fill={b.c} />
      ))}
    </svg>
  )
}

// Ugyanaz, mint a profilon: object-fit: cover, majd a beállított pozíció és nagyítás.
// A méreteket itt számoljuk ki, hogy a kép pontosan oda kerüljön.
function Bg({ img, pos, w, h, opacity }: { img: BgImage; pos: CardBgPos; w: number; h: number; opacity: number }) {
  const px = pos.x / 100
  const py = pos.y / 100
  const cover = Math.max(w / img.width, h / img.height)
  const baseW = img.width * cover
  const baseH = img.height * cover
  const left0 = (w - baseW) * px
  const top0 = (h - baseH) * py
  const ox = px * w
  const oy = py * h
  const z = pos.zoom
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, display: 'flex', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={img.dataUrl}
        width={Math.round(baseW * z)}
        height={Math.round(baseH * z)}
        style={{
          position: 'absolute',
          left: Math.round(ox + (left0 - ox) * z),
          top: Math.round(oy + (top0 - oy) * z),
          width: Math.round(baseW * z),
          height: Math.round(baseH * z),
          opacity,
        }}
      />
    </div>
  )
}

function Fill({ w, h, background }: { w: number; h: number; background: string }) {
  return <div style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, display: 'flex', background }} />
}

function Wave({ wave, height, barWidth, gap }: { wave: number[]; height: number; barWidth: number; gap: number }) {
  const max = Math.max(...wave)
  return (
    <div style={{ display: 'flex', alignItems: 'center', height, gap }}>
      {wave.map((v, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            height: Math.max(6, Math.round((v / max) * height)),
            borderRadius: barWidth,
            background: i % 6 === 3 ? '#FFFFFF' : i % 2 === 0 ? ORANGE : SOFT_ORANGE,
            display: 'flex',
          }}
        />
      ))}
    </div>
  )
}

function usernameSize(name: string, base: number) {
  if (name.length <= 10) return base
  if (name.length <= 14) return Math.round(base * 0.8)
  if (name.length <= 18) return Math.round(base * 0.64)
  return Math.round(base * 0.5)
}

function Stat({ label, value, size, color = '#FFFFFF' }: { label: string; value: string; size: number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(size * 0.12) }}>
      <div
        style={{
          display: 'flex',
          fontFamily: 'Manrope',
          fontWeight: 700,
          fontSize: Math.round(size * 0.36),
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: size, color }}>{value}</div>
    </div>
  )
}

function LevelPill({ d, size }: { d: TasteImageData; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `${Math.round(size * 0.5)}px ${Math.round(size * 0.9)}px`,
        borderRadius: 999,
        border: '2px solid rgba(255,255,255,0.28)',
        background: 'rgba(255,255,255,0.12)',
        fontFamily: 'Manrope',
        fontWeight: 700,
        fontSize: size,
        color: '#FFFFFF',
      }}
    >
      {`${d.levelTitle} · ${d.levelNumber}. szint`}
    </div>
  )
}

function scoreText(d: TasteImageData) {
  return d.curatorScore === null ? '–' : d.curatorScore.toFixed(1)
}

// ---- 1080x1920: Story ----
export const STORY_SIZE = { width: 1080, height: 1920 }

export function StoryImage({ d }: { d: TasteImageData }) {
  const W = STORY_SIZE.width
  const H = STORY_SIZE.height
  const CW = 920
  const CH = 1060
  return (
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#0B0B0D', fontFamily: 'Manrope' }}>
      {d.bg ? (
        <>
          <Bg img={d.bg} pos={d.bgPos} w={W} h={H} opacity={0.5} />
          <Fill w={W} h={H} background="linear-gradient(180deg, rgba(8,8,10,0.55) 0%, rgba(8,8,10,0.88) 100%)" />
        </>
      ) : (
        <Fill w={W} h={H} background="radial-gradient(circle at 20% 8%, rgba(255,91,55,0.40), rgba(11,11,13,0) 55%)" />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: W, height: H }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 130 }}>
        <Logo size={84} />
        <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: 62, color: '#FFFFFF' }}>Scale</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          width: CW,
          height: CH,
          marginTop: 120,
          borderRadius: 64,
          border: '2px solid rgba(255,255,255,0.2)',
          background: '#101114',
          padding: 60,
        }}
      >
        {d.bg && <Bg img={d.bg} pos={d.bgPos} w={CW} h={CH} opacity={0.85} />}
        <Fill w={CW} h={CH} background="linear-gradient(135deg, rgba(30,31,36,0.55) 0%, rgba(20,21,26,0.4) 50%, rgba(11,11,13,0.78) 100%)" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Logo size={64} />
            <div style={{ display: 'flex', fontFamily: 'Manrope', fontWeight: 700, fontSize: 28, letterSpacing: 6, color: '#E5E5E5' }}>
              TASTE ID
            </div>
          </div>
          <LevelPill d={d} size={30} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Sora',
              fontWeight: 800,
              fontSize: usernameSize(d.username, 112),
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
            }}
          >
            {`@${d.username}`}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Manrope', fontWeight: 700, fontSize: 28, letterSpacing: 4, color: 'rgba(255,255,255,0.6)' }}>
            {`ID · ${d.idNumber}`}
          </div>
          <div style={{ display: 'flex', marginTop: 24 }}>
            <Wave wave={d.wave} height={150} barWidth={14} gap={16} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            <Stat label="Saját átlag" value={scoreText(d)} size={116} color={SOFT_ORANGE} />
            <div style={{ display: 'flex', gap: 64 }}>
              <Stat label="Dal" value={String(d.totalRatings)} size={52} />
              <Stat label="Széria" value={`${d.streak} nap`} size={52} color={SOFT_ORANGE} />
            </div>
          </div>
          <div style={{ display: 'flex', padding: 14, background: '#FFFFFF', borderRadius: 36 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={d.qrDataUrl} width={270} height={270} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 96, gap: 22 }}>
        <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: 68, color: '#FFFFFF' }}>Mutasd meg, mit hallgatsz!</div>
        <div style={{ display: 'flex', fontFamily: 'Manrope', fontWeight: 700, fontSize: 36, color: ORANGE }}>
          {d.profileUrl.replace(/^https?:\/\//, '')}
        </div>
      </div>
      </div>
    </div>
  )
}

// ---- 1200x630: link-előnézet ----
export const OG_SIZE = { width: 1200, height: 630 }

export function OgImage({ d }: { d: TasteImageData }) {
  const W = OG_SIZE.width
  const H = OG_SIZE.height
  return (
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#0B0B0D', fontFamily: 'Manrope' }}>
      {d.bg ? (
        <>
          <Bg img={d.bg} pos={d.bgPos} w={W} h={H} opacity={0.9} />
          <Fill w={W} h={H} background="linear-gradient(100deg, rgba(8,8,10,0.92) 0%, rgba(8,8,10,0.72) 55%, rgba(8,8,10,0.35) 100%)" />
        </>
      ) : (
        <Fill w={W} h={H} background="radial-gradient(circle at 15% 15%, rgba(255,91,55,0.38), rgba(11,11,13,0) 60%)" />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', width: W, height: H, padding: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Logo size={56} />
            <div style={{ display: 'flex', fontFamily: 'Manrope', fontWeight: 700, fontSize: 24, letterSpacing: 5, color: '#E5E5E5' }}>
              SCALE MUSIC TASTE ID
            </div>
          </div>
          <LevelPill d={d} size={24} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Sora',
                fontWeight: 800,
                fontSize: usernameSize(d.username, 92),
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}
            >
              {`@${d.username}`}
            </div>
            <div style={{ display: 'flex', gap: 56 }}>
              <Stat label="Saját átlag" value={scoreText(d)} size={64} color={SOFT_ORANGE} />
              <Stat label="Dal" value={String(d.totalRatings)} size={64} />
              <Stat label="Széria" value={`${d.streak} nap`} size={64} color={SOFT_ORANGE} />
            </div>
          </div>
          <div style={{ display: 'flex', padding: 12, background: '#FFFFFF', borderRadius: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={d.qrDataUrl} width={200} height={200} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- a főoldal alap előnézete (nincs felhasználó) ----
export function BrandOgImage() {
  const W = OG_SIZE.width
  const H = OG_SIZE.height
  return (
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#0B0B0D', fontFamily: 'Manrope' }}>
      <Fill w={W} h={H} background="radial-gradient(circle at 18% 12%, rgba(255,91,55,0.45), rgba(11,11,13,0) 60%)" />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', width: W, height: H, padding: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Logo size={80} />
          <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: 58, color: '#FFFFFF' }}>Scale</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: '#FFFFFF' }}>
            Mutasd meg, mit hallgatsz!
          </div>
          <div style={{ display: 'flex', fontFamily: 'Manrope', fontWeight: 700, fontSize: 38, color: SOFT_ORANGE }}>
            Értékeld a magyar zenéket, és építsd fel a saját Music Taste ID-det.
          </div>
        </div>
      </div>
    </div>
  )
}
