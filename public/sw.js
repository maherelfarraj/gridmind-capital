// GridMind Capital — Service Worker tombstone
// The SW has been intentionally removed. This file exists only to
// unregister any previously installed SW and purge all caches so
// that stale Turbopack chunks can never be served from cache again.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
  )
})
self.addEventListener('fetch', () => {})
