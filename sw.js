/**
 * VAULT — SERVICE WORKER  (Phase 10)
 *
 * Strategy: Cache-first for static assets, network-first for API calls.
 * On new version: posts a message to all clients so the UI can show
 * a "New version available — refresh" banner.
 *
 * Version bump here triggers the update notification flow.
 */

const CACHE_VERSION = 'vault-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: pre-cache static shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Do NOT skipWaiting here — we want to notify the user first
});

// ── Activate: clean old caches, notify clients of update ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => {
      // Tell every open tab there's a new version
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) =>
          client.postMessage({ type: 'VAULT_UPDATE_AVAILABLE' })
        );
      });
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache-first with network fallback ─────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Don't intercept non-http requests (chrome-extension etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) =>
              cache.put(event.request, clone)
            );
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// ── Message handler: force skip-waiting from UI ──────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'VAULT_SKIP_WAITING') {
    self.skipWaiting();
  }
});
