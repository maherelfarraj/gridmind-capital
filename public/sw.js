// GridMind Capital — Service Worker
// v2: Never cache Turbopack/Next.js chunks — always network-only to prevent
// ChunkLoadError caused by stale chunk hashes after a deployment/sync.

const CACHE_VERSION = 'gmc-v2'
const STATIC_ASSETS = [
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

  // Skip non-GET and cross-origin requests entirely
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // ── Next.js / Turbopack build output ─────────────────────────────────────
  // NEVER cache these. Chunk hashes change on every build/sync and a stale
  // cached chunk will cause ChunkLoadError. Go straight to the network.
  // On network failure, force a full page reload so the browser fetches a
  // fresh HTML document (with the correct new chunk URLs).
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Signal the page to hard-reload to pick up the new chunk manifest
        return new Response(
          `<script>window.location.reload(true)</script>`,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-store',
            },
          }
        )
      })
    )
    return
  }

  // ── API routes — network-first, no cache fallback ────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // ── True static assets (icons, manifest) — cache-first ──────────────────
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    )
    return
  }

  // ── HTML pages — network-first, cache as fallback for offline ────────────
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache successful, non-partial responses
        if (res.ok && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})
