'use client'

import { motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Minden oldalváltáskor finom beúszás (fade + kis emelkedés). A főoldalnak saját
// beúszásai vannak, ott nem duplázzuk.
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  if (pathname === '/' || reduce) return <>{children}</>

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
