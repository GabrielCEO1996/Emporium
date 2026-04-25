'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Imperative API ────────────────────────────────────────────────────────
// Mirror Sonner's toast pattern: any client component can call
// `await showConfirm({ title, message })` and get a Promise<boolean>. We
// hold a single live host reference; if no host is mounted yet (first paint)
// we degrade to window.confirm so user actions never silently break.

type ConfirmOptions = {
  /** Bold heading; ~50 chars max for layout. */
  title: string
  /** Body copy. Plain text only — no JSX/HTML. */
  message: string
  /** Button label for the affirmative action. */
  confirmLabel?: string
  /** Button label for the negative action. */
  cancelLabel?: string
  /** Marks this as a destructive operation — uses red styling. */
  danger?: boolean
}

type Resolver = (ok: boolean) => void

let liveHost: ((opts: ConfirmOptions, resolve: Resolver) => void) | null = null

export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (liveHost) {
      liveHost(opts, resolve)
      return
    }
    // Degraded fallback for first-paint or SSR-only edge cases. Prefix the
    // title onto the message so the user still gets full context.
    if (typeof window !== 'undefined') {
      const text = opts.title + (opts.message ? `\n\n${opts.message}` : '')
      // eslint-disable-next-line no-alert
      resolve(window.confirm(text))
    } else {
      resolve(false)
    }
  })
}

// ─── Host component ────────────────────────────────────────────────────────
// Mount once at the root of the (dashboard) layout. There can only be one
// host at a time — mounting a second one replaces the registration but
// doesn't break any inflight calls.

export default function ConfirmDialogHost() {
  const [state, setState] = useState<
    | { open: false }
    | { open: true; opts: ConfirmOptions; resolve: Resolver }
  >({ open: false })

  useEffect(() => {
    liveHost = (opts, resolve) => setState({ open: true, opts, resolve })
    return () => {
      // Don't reach into other host's state; just unregister.
      if (liveHost) liveHost = null
    }
  }, [])

  // ESC closes (treats it as cancel).
  useEffect(() => {
    if (!state.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state.resolve(false)
        setState({ open: false })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  if (!state.open) return null
  const { opts, resolve } = state

  const close = (ok: boolean) => {
    resolve(ok)
    setState({ open: false })
  }

  const danger = opts.danger ?? false

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        // Click outside the panel = cancel.
        if (e.target === e.currentTarget) close(false)
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
              danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-slate-900"
            >
              {opts.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              {opts.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close(false)}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50">
          <button
            type="button"
            onClick={() => close(false)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors min-h-[40px]"
          >
            {opts.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className={cn(
              'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors min-h-[40px]',
              danger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                : 'bg-teal-600 hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2'
            )}
          >
            {opts.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
