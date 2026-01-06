const CACHE_NAME = "pdv-cache-v1.3.0";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      const toDelete = keys.filter((k) => k !== CACHE_NAME);
      return Promise.all(toDelete.map((k) => caches.delete(k))).then(
        (results) => {
          // Si se eliminaron caches antiguos, avisar a los clientes que hay nueva versión
          const removedAny = results.some(Boolean);
          if (removedAny) {
            return self.clients.matchAll({ type: "window" }).then((clients) => {
              clients.forEach((client) => {
                try {
                  client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
                } catch (e) {
                  // ignore
                }
              });
            });
          }
          return Promise.resolve();
        }
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Avoid intercepting API calls or external CDNs
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Try cache first for precached resources, otherwise network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Optionally cache GET requests for same-origin static assets
          if (
            event.request.method === "GET" &&
            response &&
            response.status === 200
          ) {
            const contentType = response.headers.get("content-type") || "";
            if (
              contentType.includes("text/html") ||
              contentType.includes("application/javascript") ||
              contentType.includes("text/css") ||
              contentType.includes("image/")
            ) {
              const copy = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(event.request, copy));
            }
          }
          return response;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});
