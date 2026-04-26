'use client'

/**
 * Nav — sticky glassmorphism nav (Fase 6).
 *
 * Visual fidelity to emporium-tienda-hero.html:
 *   - Pill flotante con backdrop-filter blur(20px) saturate(180%)
 *   - Logo SVG mini (pin teal + globo navy + continentes cream) + "EMPORIUM"
 *     en mayúsculas Inter Bold tracking 0.32em
 *   - 3 links Catálogo / Pedidos (badge teal con N pendientes) / Cuenta
 *   - Botón Carrito navy con dot teal-soft pulsante + badge count
 *
 * Active link detection by usePathname:
 *   - /tienda          → Catálogo activo
 *   - /tienda/mis-pedidos → Pedidos activo
 *   - /tienda/perfil      → Cuenta activo
 *
 * Underline activo usa Framer Motion layoutId, así al navegar el subrayado
 * se desliza horizontal entre links en lugar de teleportarse.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'

interface Props {
  cartCount: number
  /** Bumps every addToCart so the button can scale-pulse on demand. */
  cartPulse: number
  pedidosPendientes: number
  onOpenCart: () => void
}

const LINKS = [
  { key: 'catalogo', label: 'Catálogo', href: '/tienda#catalogo' },
  { key: 'pedidos',  label: 'Pedidos',  href: '/tienda/mis-pedidos' },
  { key: 'cuenta',   label: 'Cuenta',   href: '/tienda/perfil' },
] as const

function activeKeyFromPathname(pathname: string): typeof LINKS[number]['key'] {
  if (pathname.startsWith('/tienda/mis-pedidos')) return 'pedidos'
  if (pathname.startsWith('/tienda/perfil'))      return 'cuenta'
  // /tienda root, /tienda#catalogo, /tienda/checkout/* — todos quedan en Catálogo
  return 'catalogo'
}

export default function Nav({ cartCount, cartPulse, pedidosPendientes, onOpenCart }: Props) {
  const pathname = usePathname() ?? '/tienda'
  const activeKey = activeKeyFromPathname(pathname)

  return (
    <nav className="tienda-nav" aria-label="Navegación principal de la tienda">
      <Link href="/tienda" className="tienda-nav-mark" aria-label="Ir al inicio de la tienda">
        <svg
          viewBox="0 0 200 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M100 8 C143 8, 173 38, 173 82 C173 124, 143 164, 100 216 C95 222, 91 222, 86 216 C43 164, 13 124, 13 82 C13 38, 43 8, 86 8 Z"
            fill="#5EBFB6"
            stroke="#1E3A5F"
            strokeWidth="4"
          />
          <circle cx="93" cy="86" r="46" fill="#1E3A5F" />
          <path
            d="M75 60 Q72 58, 70 62 L68 68 Q66 72, 70 74 L74 78 L72 82 Q70 86, 74 86 L82 88 L80 92 L84 96 L88 92 L90 86 L94 90 L98 88 L100 92 L96 96 L94 100 L96 110 L102 108 L104 112 L106 120 L110 116 L116 110 L118 106 L116 100 L114 86 L116 78 L108 70 L98 64 L92 62 L80 58 Z"
            fill="#fafaf7"
          />
        </svg>
        <span className="tienda-nav-mark-text">EMPORIUM</span>
      </Link>

      <ul className="tienda-nav-links">
        {LINKS.map((link) => {
          const isActive = link.key === activeKey
          const showBadge = link.key === 'pedidos' && pedidosPendientes > 0
          return (
            <li key={link.key}>
              <Link
                href={link.href}
                className={`tienda-nav-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="tienda-nav-link-label">{link.label}</span>
                {showBadge && (
                  <span className="tienda-nav-badge" aria-label={`${pedidosPendientes} pedidos pendientes`}>
                    {pedidosPendientes > 9 ? '9+' : pedidosPendientes}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="tienda-nav-underline"
                    className="tienda-nav-underline"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      <motion.button
        key={`tienda-nav-cart-pulse-${cartPulse}`}
        initial={false}
        animate={cartPulse > 0 ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onClick={onOpenCart}
        className="tienda-nav-cta"
        aria-label="Abrir carrito"
      >
        <span className="tienda-nav-cta-dot" aria-hidden="true" />
        <ShoppingBag className="tienda-nav-cta-icon" aria-hidden="true" />
        <span className="tienda-nav-cta-label">Carrito</span>
        <AnimatePresence>
          {cartCount > 0 && (
            <motion.span
              key={`tienda-nav-count-${cartPulse}`}
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.2, 1] }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.3 }}
              className="tienda-nav-cta-count"
              aria-label={`${cartCount} ítems en el carrito`}
            >
              {cartCount > 9 ? '9+' : cartCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </nav>
  )
}
