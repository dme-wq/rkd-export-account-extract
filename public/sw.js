// RKD Gmail Extractor - Service Worker (Always Network-First to prevent old theme caching)

const CACHE_VERSION = 'rkd-v2-' + Date.now();

self.addEventListener('install', (event) => {
  // Immediately take control
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear ALL previous caches to force the latest theme and code
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch fresh from network for page navigations and API
  if (
    event.request.mode === 'navigate' ||
    event.request.url.includes('/api/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-First strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});
