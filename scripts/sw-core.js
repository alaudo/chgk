/* scripts/sw-core.js - Offline cache logic for CHGK tools.

   Note: The actual service worker entry file must be at the site root
   (see sw.js) to control the whole app.
*/

(() => {
  const CACHE_VERSION = "chgk-tools-v3";

  const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./peremeshki.html",
    "./chgk.html",
    "./timer.html",
    "./styles.css",

    "./pwa/manifest-index.json",
    "./pwa/manifest-peremeshki.json",
    "./pwa/manifest-chgk.json",
    "./pwa/manifest-timer.json",

    "./img/pwa-icon.svg",
    "./img/chgk.png",
    "./img/peremeshki.png",
    "./img/timer.png",

    "./scripts/pwa.js",
    "./scripts/footer.js",
    "./scripts/imageViewer.js",
    "./scripts/timer.js",
    "./scripts/chgk.js",
    "./scripts/storage.js",
    "./scripts/algorithms.js",
    "./scripts/app.js",
    "./scripts/ui.js",
    "./scripts/sw-core.js",
  ];

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(CACHE_VERSION)
        .then((cache) => cache.addAll(PRECACHE_URLS))
        .then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        );
        await self.clients.claim();
      })()
    );
  });

  self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Navigation: network-first (to pick up updates), then cache fallback.
    if (request.mode === "navigate") {
      event.respondWith(
        (async () => {
          try {
            const networkResponse = await fetch(request);
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          } catch {
            const cached = await caches.match(request);
            return cached || caches.match("./index.html");
          }
        })()
      );
      return;
    }

    // Assets: cache-first.
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(request, response.clone());
        return response;
      })()
    );
  });
})();
