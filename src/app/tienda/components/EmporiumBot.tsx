'use client'

/**
 * EmporiumBot — botón flotante decorativo (Fase 7).
 *
 * Visualmente idéntico al HTML de referencia:
 *   - Botón circular navy 56x56px en bottom-right
 *   - Halo teal pulsante constante (anillo expandido infinito)
 *   - Status dot teal teal-soft top-right (online indicator)
 *   - Tooltip "Hola {nombre}, ¿necesitas ayuda?" a los 5s, autodismiss a los 9s
 *
 * Click → modal "Próximamente":
 *   - Título: "EmporiumBot · IA"
 *   - Copy: "Estamos entrenando a EmporiumBot..."
 *   - Botón primario "Abrir WhatsApp" → wa.me link (placeholder hasta que
 *     pongas el número real)
 *   - Botón secundario "Cerrar"
 *
 * El chat real con Anthropic API se construirá en una fase separada — esta
 * pieza es solo presencia visual + handoff a WhatsApp.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* 🔴 PENDIENTE: reemplazar el placeholder por el número real de WhatsApp.
 *  Formato wa.me requiere solo dígitos, sin "+", sin espacios, sin guiones.
 *  Ej. para un número de Estados Unidos +1 (555) 123-4567:
 *      const WHATSAPP_NUMBER = '15551234567'
 *  Cuando esté configurado, el modal pasa a abrir un link real. Mientras
 *  tanto el botón "Abrir WhatsApp" del modal está deshabilitado y el copy
 *  cambia para no romper la confianza del cliente. */
const WHATSAPP_NUMBER = '<NUMERO_PENDIENTE>'
const WHATSAPP_CONFIGURED = !WHATSAPP_NUMBER.includes('PENDIENTE')

interface Props {
  /** Full profile name (e.g. "María Luisa Pérez"). The component pulls
   *  out just the first word for a friendlier tooltip ("Hola María"). */
  profileName?: string | null
}

function firstNameOf(profileName?: string | null): string {
  const n = (profileName ?? '').trim().split(/\s+/)[0] ?? ''
  if (n.length >= 2) return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
  return 'amig@'
}

export default function EmporiumBot({ profileName }: Props) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Tooltip lifecycle: appear at 5s, auto-dismiss at 9s. Doesn't reappear
  // — once the user has been pinged we stay quiet. Cleared if the user
  // opens the modal mid-tooltip.
  useEffect(() => {
    const tIn  = window.setTimeout(() => setTooltipOpen(true), 5000)
    const tOut = window.setTimeout(() => setTooltipOpen(false), 9000)
    return () => {
      window.clearTimeout(tIn)
      window.clearTimeout(tOut)
    }
  }, [])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!modalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [modalOpen])

  const greetingName = firstNameOf(profileName)

  return (
    <>
      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            key="emporiumbot-tooltip"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="tienda-bot-tooltip"
            role="status"
            aria-live="polite"
          >
            <span className="tienda-bot-tooltip-name">EmporiumBot · IA</span>
            Hola {greetingName}, ¿necesitas ayuda?
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          setTooltipOpen(false)
          setModalOpen(true)
        }}
        className="tienda-bot-fab"
        aria-label="Abrir EmporiumBot"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="10" r="0.8" fill="currentColor" />
          <circle cx="12" cy="10" r="0.8" fill="currentColor" />
          <circle cx="15" cy="10" r="0.8" fill="currentColor" />
        </svg>
        <span className="tienda-bot-fab-status" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            key="emporiumbot-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="tienda-bot-modal-overlay"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tienda-bot-modal-title"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="tienda-bot-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="tienda-bot-modal-eyebrow">EmporiumBot · IA</p>
              <h2 id="tienda-bot-modal-title" className="tienda-bot-modal-title">
                <em>Próximamente</em>
              </h2>
              <p className="tienda-bot-modal-copy">
                Estamos entrenando a EmporiumBot para ayudarte con tus pedidos.
                Mientras tanto, escríbenos por WhatsApp y te respondemos al
                momento.
              </p>

              <div className="tienda-bot-modal-actions">
                {WHATSAPP_CONFIGURED ? (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tienda-bot-modal-cta-primary"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Abrir WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="tienda-bot-modal-cta-primary is-disabled"
                    title="WhatsApp pendiente de configurar"
                  >
                    Próximamente · WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="tienda-bot-modal-cta-secondary"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
