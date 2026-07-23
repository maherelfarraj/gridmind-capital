/**
 * GridMind Capital — Service Worker
 * ─────────────────────────────────────────────────────────────
 * Offline-tolerant, install-ready PWA service worker.
 *
 * Design constraints (IMPORTANT):
 *  - We NEVER cache `/_next/` build chunks. In the Turbopack dev
 *    environment these are not stably hashed, and serving a stale
 *    chunk from cache breaks the app. Build chunks always go to the
 *    network. (This is why the previous SW was a cache-purging
 *    tombstone — we keep that guarantee here.)
 *  - Navigations are network-first, with the last successful HTML
 *    response cached so the last-viewed pages are available
 *    read-only when offline.
 *  - Static public assets (icons, manifest) are stale-while-revalidate.
 *  - A Web Push `push`/`notificationclick` listener stub is included
 *    so Web Push can be enabled later WITHOUT changing registration.
 *
 * ── TEST CHECKLIST ───────────────────────────────────────────
 *  [ ] Android Chrome: visit site → menu shows "Install app" /
 *      the in-app install prompt appears → installs to home screen.
 *  [ ] iOS Safari: Share → "Add to Home Screen" → launches
 *      standalone (InstallPrompt shows iOS instructions since iOS
 *      has no beforeinstallprompt event).
 *  [ ] Offline approve: go offline (DevTools → Network → Offline),
 *      Approve an item → toast "Queued offline" → go back online →
 *      queue flushes → "Synced" toast. (see lib/pwa/offline-queue.ts)
 *  [ ] Offline navigation: visit a project page online, go offline,
 *      reload → cached read-only page (or /offline.html if uncached).
 *  [ ] Camera upload at 375px: NCR detail / inspection deliverable →
 *      "Add photo" → device camera → compressed → uploaded.
 * ─────────────────────────────────────────────────────────────
 */

const VERSION = 'v1'
const APP_SHELL_CACHE = `gmc-shell-${VERSION}`
const RUNTIME_CACHE = `gmc-runtime-${VERSION}`

// Minimal app shell — safe, static, versioned assets only.
const APP_SHELL_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ── Install: precache the app shell ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

// ── Activate: drop stale cache versions ──────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ── Helpers ──────────────────────────────────────────────────
function isNextBuildAsset(url) {
  // Never cache Next.js build output — always network.
  return url.pathname.startsWith('/_next/')
}

function isStaticPublicAsset(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname)
  )
}

// Network-first: try network, cache the fresh copy, fall back to cache.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok && request.method === 'GET') {
      cache.put(request, fresh.clone())
    }
    return fresh
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

// Stale-while-revalidate: serve cache immediately, refresh in background.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)
  return cached || network || fetch(request)
}

// ── Fetch strategy router ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests. Everything else (POST,
  // Supabase, cross-origin, server actions) goes straight to network.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  // Never intercept Next.js build chunks — avoids stale-chunk bugs.
  if (isNextBuildAsset(url)) {
    return
  }

  // App-shell navigations: network-first, cache last-viewed pages,
  // fall back to the offline page when both network + cache miss.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, RUNTIME_CACHE).catch(async () => {
        const shell = await caches.open(APP_SHELL_CACHE)
        return (
          (await shell.match('/offline.html')) ||
          new Response('Offline', { status: 503, statusText: 'Offline' })
        )
      }),
    )
    return
  }

  // Static public assets: stale-while-revalidate.
  if (isStaticPublicAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, APP_SHELL_CACHE))
    return
  }

  // Default: network-first with runtime cache fallback (covers data
  // routes and RSC payloads that are safe to reuse read-only offline).
  event.respondWith(
    networkFirst(request, RUNTIME_CACHE).catch(
      () => new Response('Offline', { status: 503, statusText: 'Offline' }),
    ),
  )
})

// ── Message channel: allow the app to trigger skipWaiting ────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// ── Web Push STUB (not yet enabled) ──────────────────────────
// Structure is in place so Web Push can be added later without
// re-registering the service worker. When you wire push:
//   1. Generate VAPID keys, subscribe via pushManager.subscribe()
//   2. Store the subscription server-side
//   3. Send pushes — this listener will render them.
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'GridMind Capital', body: event.data.text() }
  }
  const title = payload.title || 'GridMind Capital'
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/dashboard' },
    tag: payload.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
