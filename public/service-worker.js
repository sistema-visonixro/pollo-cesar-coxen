const CACHE_NAME = 'pdv-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  // Avoid intercepting API calls or external CDNs
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Try cache first for precached resources, otherwise network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Optionally cache GET requests for same-origin static assets
        if (event.request.method === 'GET' && response && response.status === 200) {
          const contentType = response.headers.get('content-type') || '';
          if (
            contentType.includes('text/html') ||
            contentType.includes('application/javascript') ||
            contentType.includes('text/css') ||
            contentType.includes('image/')
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
