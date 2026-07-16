// sw.js — the service worker: a THIN impure shell over the pure decision core
// (SPEC-0047 §2.2, R-0047). Registered as a MODULE worker (main.js) so it can
// import src/pwa.js directly — same zero-dep ESM idiom as the app. Browsers
// without module-SW support simply never register; the app runs online exactly
// as before (R-0047's graceful floor). NOTE: pwa.js only ever changes together
// with a strategy change (which changes THIS file too, forcing the update
// check) — do not "optimize" the static import away; updateViaCache defaults
// apply to it.
//
// AC4 discipline: no console/logging on any request path — bypassed requests
// never even reach respondWith, and handled ones are same-origin GETs only.
//
// Strategies (decided by classify(), executed here):
//   bypass   → no respondWith: the request never touches the SW (model calls,
//              anything non-GET/cross-origin — the AC4 guarantee by absence).
//   navigate → network-first (NAV_TIMEOUT_MS budget); a fresh success REFRESHES
//              the canonical cached shell (architect BLOCKING-3: the offline
//              fallback is always the newest shell ever seen, never install-day
//              stale); failure falls back to that shell.
//   asset    → stale-while-revalidate: cached copy now, refresh in the
//              background — offline serves the cache, online never goes stale.
//
// The "warm" message (architect BLOCKING-1/2): the page posts the boot's
// same-origin resource URLs (+ the lazy KaTeX vendor set) right after
// registration, because those requests happened BEFORE this worker existed.
// One online load then yields a complete offline cache (R-0047 AC2).

import { CACHE_NAME, SHELL, PRECACHE, NAV_TIMEOUT_MS, classify, cacheable, isCode } from "./src/pwa.js";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "warm" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        event.data.urls.map(async (url) => {
          try {
            if (await cache.match(url)) return; // already cached (SWR or a prior warm)
            const res = await fetch(url);
            if (cacheable(res)) await cache.put(url, res);
          } catch {
            /* a single miss must not sink the warm pass (AC5) */
          }
        }),
      ),
    ),
  );
});

// Network-first with a time budget; a success refreshes the canonical shell.
async function navigate(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), NAV_TIMEOUT_MS);
    const fresh = await fetch(request, { signal: ctl.signal });
    clearTimeout(timer);
    if (cacheable(fresh)) await cache.put(SHELL, fresh.clone());
    return fresh;
  } catch {
    const shell = await cache.match(SHELL);
    if (shell) return shell;
    throw new Error("offline and never cached"); // AC5: the browser's plain offline page
  }
}

// Network-first for app CODE (JS/wasm), R-0062: online always yields the CURRENT
// deploy's module — never one skewed against a fresher shell (which fails the ES
// import graph and blacks out the app) — and the fetched copy refreshes the cache
// for offline. Offline falls back to the cache (the last consistent set); a miss
// propagates honestly, exactly like a stale-while-revalidate miss.
//
// BOUNDED like navigate() (NAV_TIMEOUT_MS): a stalled-but-alive network (captive
// portal, weak wifi, e-ink over flaky cellular) must not block boot long enough
// to trip the boot-guard into purging a still-good cache. On timeout/failure we
// serve the cached copy — the accepted offline set — so a slow link stays snappy
// (as under R-0047's SWR), while the fresh-match guarantee still holds whenever
// the network answers within the budget.
async function codeFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NAV_TIMEOUT_MS);
  try {
    const fresh = await fetch(request, { signal: ctl.signal });
    clearTimeout(timer);
    if (cacheable(fresh)) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    clearTimeout(timer);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline and never cached");
  }
}

// Stale-while-revalidate; a cache miss falls through to the network (which
// populates the cache), and a network failure on a miss propagates honestly.
async function asset(event, request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (cacheable(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(refresh); // background revalidate (AC3)
    return cached;
  }
  const res = await refresh;
  if (!res) throw new Error("offline and never cached");
  return res;
}

self.addEventListener("fetch", (event) => {
  const kind = classify(event.request, self.location.origin);
  if (kind === "bypass") return;
  if (kind === "navigate") return event.respondWith(navigate(event.request));
  // asset: code (JS/wasm) network-first so a fresh shell never pairs with a stale
  // module (R-0062); other assets (fonts/css/images) stay stale-while-revalidate.
  event.respondWith(isCode(event.request.url) ? codeFirst(event.request) : asset(event, event.request));
});
