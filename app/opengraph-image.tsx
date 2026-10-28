import { ImageResponse } from 'next/og'
import { loadFonts, BrandOgImage, OG_SIZE } from '@/lib/taste-image'

export const runtime = 'nodejs'
export const alt = 'Scale – magyar zenék értékelése'
export const size = OG_SIZE
export const contentType = 'image/png'

// A főoldal (és minden más oldal) alap link-előnézete
export default async function Image() {
  const fonts = await loadFonts()
  return new ImageResponse(<BrandOgImage />, { ...OG_SIZE, fonts })
}
