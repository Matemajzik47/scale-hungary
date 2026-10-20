'use client'

import { useEffect } from 'react'

// Regisztrálja a service workert, hogy az oldal telepíthető legyen.
// Fejlesztés közben (npm run dev) nem fut, hogy ne zavarja a hot reloadot.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A telepíthetőség nem kritikus funkció, hiba esetén nem zavarjuk a felhasználót
    })
  }, [])

  return null
}
