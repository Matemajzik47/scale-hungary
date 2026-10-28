import { ImageResponse } from 'next/og'
import { loadFonts, loadTasteImageData, StoryImage, STORY_SIZE } from '@/lib/taste-image'

export const runtime = 'nodejs'

// A megosztható Story-kép (1080x1920 PNG) a felhasználó saját kártyájával és háttérképével
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const data = await loadTasteImageData(decodeURIComponent(username))
  if (!data) return new Response('Nincs ilyen felhasználó', { status: 404 })

  const fonts = await loadFonts()
  return new ImageResponse(<StoryImage d={data} />, {
    ...STORY_SIZE,
    fonts,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
  })
}
