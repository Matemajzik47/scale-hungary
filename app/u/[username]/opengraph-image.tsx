import { ImageResponse } from 'next/og'
import { loadFonts, loadTasteImageData, BrandOgImage, OgImage, OG_SIZE } from '@/lib/taste-image'

export const runtime = 'nodejs'
export const revalidate = 300
export const alt = 'Scale Music Taste ID'
export const size = OG_SIZE
export const contentType = 'image/png'

// Link-előnézet (Messenger, Instagram, Discord stb.): a felhasználó saját kártyaképével
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const [data, fonts] = await Promise.all([loadTasteImageData(decodeURIComponent(username)), loadFonts()])
  return new ImageResponse(data ? <OgImage d={data} /> : <BrandOgImage />, { ...OG_SIZE, fonts })
}
