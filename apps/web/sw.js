// A Million Plateaus — service worker (D6, PWA offline shell).
//
// Deliberately conservative: it gives the app an installable offline shell
// without fighting the dev no-cache flow (scripts/serve.py). Registration is
// guarded to non-localhost secure origins (see index.html), so this file never
// runs during local dev and cannot serve a stale module after a rebuild.
//
// Strategy:
//   * install  — precache the minimal shell (page, manifest, icon).
//   * activate — drop old caches so a new deploy takes over cleanly.
//   * fetch    — network-first for navigations (fresh app, offline fallback to
//                the cached shell); cache-first with background refresh for
//                other same-origin GETs. Never touches non-GET or the dev PUT
//                sync endpoints (/dev/*).

const CACHE = "amp-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs; leave the dev PUT sync endpoints alone.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/dev/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("./index.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
