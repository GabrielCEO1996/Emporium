'use client'

import { motion } from 'framer-motion'

interface Props {
  children: React.ReactNode
  className?: string
}

export default function AnimatedPage({ children, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
