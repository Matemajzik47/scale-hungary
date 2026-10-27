// Spotify beágyazott lejátszó iFrame API-ja (böngészős oldal): egyetlen, folyamatosan élő
// lejátszót vezérlünk vele, hogy a zene oldalváltáskor se szakadjon meg.

export interface SpotifyPlaybackEvent {
  data?: { isPaused?: boolean }
}

export interface SpotifyController {
  loadUri(uri: string): void
  play(): void
  pause(): void
  togglePlay(): void
  destroy(): void
  addListener(event: string, callback: (e: SpotifyPlaybackEvent) => void): void
}

export interface SpotifyIFrameApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyController) => void
  ): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void
  }
}

let apiPromise: Promise<SpotifyIFrameApi> | null = null

/** A Spotify iFrame API egyszeri betöltése. */
export function loadSpotifyApi(): Promise<SpotifyIFrameApi> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise<SpotifyIFrameApi>((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api)
    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error('A Spotify lejátszó nem tölthető be'))
    }
    document.body.appendChild(script)
  })
  return apiPromise
}
