'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        // Check for updates every 60 seconds when app is visible
        const checkUpdate = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {})
          }
        }
        document.addEventListener('visibilitychange', checkUpdate)

        // When a new SW is waiting, prompt the user to reload
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — post message to skip waiting
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // Reload on controller change (new SW activated)
        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true
            window.location.reload()
          }
        })

        return () => document.removeEventListener('visibilitychange', checkUpdate)
      } catch (err) {
        console.warn('[SW] Registration failed:', err)
      }
    }

    // Register after page load to not block rendering
    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW, { once: true })
    }
  }, [])

  return null
}
