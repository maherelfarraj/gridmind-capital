// GridMind Capital — Service Worker
// Cache-first for static assets, network-first for API/pages.

const CACHE_VERSION = 'gmc-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Network-first for Next.js RSC / API routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for static files (icons, manifest)
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    )
    return
  }

  // Network-first for pages — fall back to cached index on offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone))
        return res
      })
      .catch(() => caches.match(request) ?? caches.match('/dashboard'))
  )
})
