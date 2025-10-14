self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('pdv-cache-v1').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index-zesdiDHD.js',
        '/assets/index-Co-FamBZ.css'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
