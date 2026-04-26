'use client'

/**
 * Nav — sticky glassmorphism nav (Fase 6, patched).
 *
 * Pill flotante centrado top:24px con backdrop-filter blur(20px)
 * saturate(180%). Composición:
 *   [Logo] | [Catálogo] [Pedidos+badge] [Cuenta]   [user] [Carrito] [☰]
 *                                                    ↑desktop only ↑mobile only
 *
 * - User pill (desktop): mini-dropdown con nombre + Mi cuenta + Cerrar sesión.
 * - Hamburger (mobile): abre drawer slide-in desde la derecha con los 3
 *   links + user info + cerrar sesión.
 * - Active link: solo si la URL coincide exactamente con la sección. Sobre
 *   /tienda/checkout/* no se activa ningún link (no son catálogo ni pedidos).
 *
 * Active underline animado vía Framer Motion layoutId — al navegar entre
 * links el subrayado se desliza horizontalmente en lugar de teleportarse.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Menu, X, ClipboardList, User as UserIcon, LogOut } from 'lucide-react'

interface Props {
  cartCount: number
  /** Bumps every addToCart so the button can scale-pulse on demand. */
  cartPulse: number
  pedidosPendientes: number
  onOpenCart: () => void

  /** Profile bits used by the user pill + mobile drawer. */
  profileName?: string | null
  profileEmail?: string | null
  /** Async signout — TiendaClient owns the actual supabase.auth.signOut(). */
  onSignOut: () => void | Promise<void>
}

const LINKS = [
  { key: 'catalogo', label: 'Catálogo', href: '/tienda#catalogo' },
  { key: 'pedidos',  label: 'Pedidos',  href: '/tienda/mis-pedidos' },
  { key: 'cuenta',   label: 'Cuenta',   href: '/tienda/perfil' },
] as const

type ActiveKey = typeof LINKS[number]['key'] | 'none'

function activeKeyFromPathname(pathname: string): ActiveKey {
  if (pathname.startsWith('/tienda/checkout')) return 'none'
  if (pathname.startsWith('/tienda/mis-pedidos')) return 'pedidos'
  if (pathname.startsWith('/tienda/perfil'))      return 'cuenta'
  if (pathname === '/tienda' || pathname === '/tienda/') return 'catalogo'
  // /tienda/* unknown subpaths: don't highlight any link
  return 'none'
}

function firstNameOf(profileName?: string | null, email?: string | null): string {
  const n = (profileName ?? '').trim().split(/\s+/)[0]
  if (n && n.length >= 2) return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
  const local = (email ?? '').split('@')[0]?.replace(/[._\d-]+/g, ' ').trim().split(/\s+/)[0]
  if (local && local.length >= 2) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
  return 'amig@'
}

// ─── User pill (desktop) ──────────────────────────────────────────────────
function UserPill({
  profileName,
  profileEmail,
  onSignOut,
}: {
  profileName?: string | null
  profileEmail?: string | null
  onSignOut: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click + on Escape
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const firstName = firstNameOf(profileName, profileEmail)

  return (
    <div ref={ref} className="tienda-nav-user">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tienda-nav-user-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${firstName}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="tienda-nav-user-menu"
          >
            <div className="tienda-nav-user-menu-header">
              <p className="tienda-nav-user-menu-name">{profileName || firstName}</p>
              {profileEmail && (
                <p className="tienda-nav-user-menu-email">{profileEmail}</p>
              )}
            </div>
            <Link
              href="/tienda/perfil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="tienda-nav-user-menu-item"
            >
              <UserIcon className="tienda-nav-user-menu-icon" aria-hidden="true" />
              Mi cuenta
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void onSignOut()
              }}
              className="tienda-nav-user-menu-item is-danger"
            >
              <LogOut className="tienda-nav-user-menu-icon" aria-hidden="true" />
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────
function MobileDrawer({
  open,
  onClose,
  pedidosPendientes,
  profileName,
  profileEmail,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  pedidosPendientes: number
  profileName?: string | null
  profileEmail?: string | null
  onSignOut: () => void | Promise<void>
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="tienda-nav-drawer-overlay"
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-label="Menú principal"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="tienda-nav-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tienda-nav-drawer-header">
              <span className="tienda-nav-drawer-title">EMPORIUM</span>
              <button
                type="button"
                onClick={onClose}
                className="tienda-nav-drawer-close"
                aria-label="Cerrar menú"
              >
                <X className="tienda-nav-drawer-close-icon" aria-hidden="true" />
              </button>
            </div>

            <nav className="tienda-nav-drawer-links" aria-label="Secciones">
              {LINKS.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={onClose}
                  className="tienda-nav-drawer-link"
                >
                  <span>{link.label}</span>
                  {link.key === 'pedidos' && pedidosPendientes > 0 && (
                    <span className="tienda-nav-badge" aria-label={`${pedidosPendientes} pedidos pendientes`}>
                      {pedidosPendientes > 9 ? '9+' : pedidosPendientes}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            <div className="tienda-nav-drawer-user">
              <p className="tienda-nav-drawer-user-name">
                {profileName || firstNameOf(profileName, profileEmail)}
              </p>
              {profileEmail && (
                <p className="tienda-nav-drawer-user-email">{profileEmail}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose()
                void onSignOut()
              }}
              className="tienda-nav-drawer-signout"
            >
              <LogOut className="tienda-nav-drawer-signout-icon" aria-hidden="true" />
              Cerrar sesión
            </button>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Public Nav ───────────────────────────────────────────────────────────
export default function Nav({
  cartCount,
  cartPulse,
  pedidosPendientes,
  onOpenCart,
  profileName,
  profileEmail,
  onSignOut,
}: Props) {
  const pathname = usePathname() ?? '/tienda'
  const activeKey = activeKeyFromPathname(pathname)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
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

        {/* User pill — desktop only via CSS */}
        <UserPill
          profileName={profileName}
          profileEmail={profileEmail}
          onSignOut={onSignOut}
        />

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

        {/* Hamburger — mobile only via CSS */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="tienda-nav-hamburger"
          aria-label="Abrir menú"
        >
          <Menu className="tienda-nav-hamburger-icon" aria-hidden="true" />
          {pedidosPendientes > 0 && (
            <span className="tienda-nav-hamburger-dot" aria-hidden="true" />
          )}
        </button>
      </nav>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pedidosPendientes={pedidosPendientes}
        profileName={profileName}
        profileEmail={profileEmail}
        onSignOut={onSignOut}
      />
    </>
  )
}
