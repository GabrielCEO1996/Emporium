// Emporium Service Worker v2
const CACHE_VERSION = 'v2'
const STATIC_CACHE  = `emporium-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `emporium-dynamic-${CACHE_VERSION}`
const OFFLINE_URL   = '/offline.html'

// Assets to precache immediately on install
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
]

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return

  // Skip Supabase and auth endpoints
  if (url.pathname.includes('supabase') || url.pathname.startsWith('/auth/')) return

  // ── 1. API calls → Network First (fresh data, cache fallback) ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, 3000))
    return
  }

  // ── 2. Next.js static assets → Cache First (immutable, hashed) ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image/')  ||
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── 3. Images / icons → Cache First ──
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|avif)$/) ||
      url.pathname.startsWith('/pwa-icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── 4. HTML pages → Network First with offline fallback ──
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  // ── 5. Everything else → Stale While Revalidate ──
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
})

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Asset not available offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName, timeoutMs = 5000) {
  const cache = await caches.open(cacheName)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached ?? new Response(JSON.stringify({ error: 'Sin conexión' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    // Fall back to offline page
    const offlinePage = await caches.match(OFFLINE_URL)
    return offlinePage ?? new Response('<h1>Sin conexión</h1>', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => null)
  return cached ?? await networkFetch ?? new Response('Not available', { status: 503 })
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Emporium', {
      body: data.body ?? '',
      icon: '/pwa-icons/192',
      badge: '/pwa-icons/72',
      tag: data.tag ?? 'emporium',
      data: { url: data.url ?? '/dashboard' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existingWindow = windowClients.find((w) => w.url.includes(url))
      if (existingWindow) return existingWindow.focus()
      return clients.openWindow(url)
    })
  )
})

// ── Background sync ───────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION })
  }
})
