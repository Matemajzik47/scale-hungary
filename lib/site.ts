// A weboldal címe (megosztott linkekhez, QR-kódhoz). Saját domain esetén elég a
// NEXT_PUBLIC_SITE_URL környezeti változót beállítani a Vercelben.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://scale-hungary.vercel.app').replace(/\/$/, '')
