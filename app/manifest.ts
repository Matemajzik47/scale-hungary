import type { MetadataRoute } from 'next'

// Telepíthető webapp (PWA) leírója: ettől lehet a telefon főképernyőjére tenni
// az oldalt, és ettől fut teljes képernyős, böngésző-sáv nélkül.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Scale',
    short_name: 'Scale',
    description: 'Magyar zenei értékelő oldal: rate-eld a dalokat, és építsd fel a saját Taste ID-d.',
    start_url: '/discover',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#111214',
    lang: 'hu',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
