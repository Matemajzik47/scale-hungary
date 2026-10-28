// A felhasználónévből képzett, mindig ugyanolyan "ízlés-hullámforma" és ID szám.
// A kártya és a megosztható képek ugyanezt használják.
export function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function waveFor(username: string): number[] {
  let seed = hashOf(username) || 1
  const out: number[] = []
  for (let i = 0; i < 24; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    out.push(6 + (seed % 100) * 0.26)
  }
  return out
}

export function idNumberFor(username: string): string {
  return String(hashOf(username) % 1000000).padStart(6, '0')
}
