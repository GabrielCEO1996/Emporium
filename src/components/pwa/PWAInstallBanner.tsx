'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

type Platform = 'ios' | 'android' | null

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isInStandaloneMode =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  if (isInStandaloneMode) return null // Already installed
  if (isIOS) return 'ios'
  // Android / Chrome
  return null // Will be set via beforeinstallprompt
}

export default function PWAInstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed this session
    if (localStorage.getItem('pwa-banner-dismissed')) return

    const p = detectPlatform()
    if (p === 'ios') setPlatform('ios')

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-banner-dismissed', '1')
  }

  const installAndroid = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDismissed(true)
    }
    setDeferredPrompt(null)
  }

  if (dismissed || !platform) return null

  // ── Android install button (compact header chip) ─────────────────────────
  if (platform === 'android') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl px-4 py-3 max-w-sm w-[calc(100%-2rem)]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-lg leading-none">E</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">Instalar Emporium</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Acceso rápido desde tu pantalla</p>
        </div>
        <button
          onClick={installAndroid}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors touch-manipulation"
          style={{ minHeight: 36 }}
        >
          <Download size={14} />
          Instalar
        </button>
        <button
          onClick={dismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0 touch-manipulation"
          aria-label="Cerrar"
          style={{ minHeight: 36, minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  // ── iOS instructions ──────────────────────────────────────────────────────
  return (
    <>
      {/* Chip trigger */}
      {!iosOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl px-4 py-3 max-w-sm w-[calc(100%-2rem)]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-lg leading-none">E</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">Instalar en iPhone</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Agrega Emporium a tu inicio</p>
          </div>
          <button
            onClick={() => setIosOpen(true)}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors touch-manipulation"
            style={{ minHeight: 36 }}
          >
            Cómo
          </button>
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0 touch-manipulation"
            aria-label="Cerrar"
            style={{ minHeight: 36, minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* iOS instructions modal */}
      {iosOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-md p-6 pb-10 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Instalar en iPhone / iPad</h2>
              <button
                onClick={dismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 touch-manipulation"
                style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <ol className="space-y-4">
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Abre en Safari</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">La instalación solo funciona desde Safari en iOS.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-sm font-bold">2</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    Toca el botón Compartir
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700">
                      <Share size={14} className="text-slate-600 dark:text-slate-300" />
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Está en la barra inferior de Safari (ícono de caja con flecha).</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-sm font-bold">3</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    Selecciona &ldquo;Agregar a inicio&rdquo;
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700">
                      <Plus size={14} className="text-slate-600 dark:text-slate-300" />
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Desplázate en el menú hasta encontrar &ldquo;Agregar a pantalla de inicio&rdquo;.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Toca &ldquo;Agregar&rdquo;</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Emporium aparecerá en tu pantalla como una app nativa.</p>
                </div>
              </li>
            </ol>

            <button
              onClick={dismiss}
              className="mt-6 w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors touch-manipulation"
              style={{ minHeight: 50 }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
