const CACHE_NAME = "judan-v0.2.1";
const APP_SHELL = [
  "./",
  "index.html",
  "style.css?v=0.2.1",
  "src/data.js?v=0.2.1",
  "src/game.js?v=0.2.1",
  "manifest.webmanifest",
  "assets/sprites/boar-idle.png",
  "assets/sprites/boar-combat-idle.png",
  "assets/sprites/boar-combat-up.png",
  "assets/sprites/boar-combat-down.png",
  "assets/sprites/boar-combat-left.png",
  "assets/sprites/boar-combat-right.png",
  "assets/sprites/boar-combat-focus.png",
  "assets/sprites/player-shot.png",
  "assets/ui/icon-192.png",
  "assets/ui/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./"))),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    })),
  );
});
