// GridMind Capital — Service Worker
// v3: Unregisters immediately on demand to prevent stale-chunk ChunkLoadErrors.
// /_next/ routes are NEVER cached. On any version message, self-destructs.

const CACHE_VERSION = 'gmc-v3'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  // Take control immediately — don't wait for old SW to idle out
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Allow the page to send 'UNREGISTER' to force the SW to remove itself
self.addEventListener('message', (event) => {
  if (event.data === 'UNREGISTER') {
    // Delete all caches then unregister
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => {
        // Notify all clients to reload so they get a fresh, SW-free page
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => client.postMessage('RELOAD'))
        })
      })
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // ── Next.js / Turbopack chunks — NEVER cache, always network-only ─────────
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request))
    return
  }

  // ── API routes — network only ─────────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // ── True static assets (icons, manifest) — cache-first ───────────────────
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    )
    return
  }

  // ── HTML navigation — network-first, cache only as offline fallback ───────
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})
