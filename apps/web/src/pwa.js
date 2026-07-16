// pwa.js — the PURE decision core of the service worker (SPEC-0047 §2.1,
// R-0047 AC6). No `self`, no `caches`, no `fetch` anywhere in this file: it
// answers only "which requests do we handle, with which strategy, which
// responses may we store, what do we warm, and where do we register" over
// plain data — unit-tested in pwa.test.mjs the same way cas.js is. sw.js is
// the thin impure shell; main.js holds the one registration line.

// Bumped only when the CACHING STRATEGY changes (activate deletes older caches).
// Never bumped for app-content updates: network-first code + SWR assets + the
// navigate shell refresh keep content fresh without version bookkeeping.
// v2 (R-0062): code (JS/wasm) went network-first, so any v1 cache — which may
// hold a version-SKEWED module set — is purged on activate. This is the strategy
// change the bump-discipline exists for.
export const CACHE_NAME = "mp-shell-v2";

// ONE canonical shell key (architect NIT-7): both "./" and "./index.html"
// navigations fall back to — and refresh — this single entry, so the offline
// shell can never skew from itself.
export const SHELL = "./index.html";

// The drift-proof install-time precache: just enough that an installed app
// LAUNCHES offline (R-0047 decision log). Modules/wasm arrive via the warm
// pass below + runtime SWR.
export const PRECACHE = [SHELL, "./manifest.webmanifest"];

// Navigation network-first budget: how long a launch waits for the network
// before serving the cached shell (R-0047 §5 → fixed here).
export const NAV_TIMEOUT_MS = 4000;

// Vendored assets that boot does NOT load (KaTeX is imported lazily on the
// first math typeset, katex.js) — so the warm pass must fetch them explicitly
// or offline reading would degrade to raw TeX (architect BLOCKING-2). This is
// NOT the drifting src/* manifest R-0047's decision log rejects: vendor files
// are pinned and change only on re-vendoring; pwa.test.mjs asserts this list
// matches the vendor directory on disk, so it CANNOT silently drift.
export const VENDOR_WARM = [
  "./vendor/katex/katex.mjs",
  "./vendor/katex/katex.min.css",
  "./vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "./vendor/katex/fonts/KaTeX_Math-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Script-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
];

/**
 * Route a request: `"bypass"` (don't touch — the browser handles it),
 * `"navigate"` (network-first with shell fallback), or `"asset"`
 * (stale-while-revalidate).
 *
 * The bypass rules ARE the R-0047 AC4 guarantee: non-GET and cross-origin
 * requests — every model call (hosted APIs and localhost runtimes alike, all
 * cross-origin from the app), and anything carrying the visitor's key — are
 * never intercepted, cached, or observed. WebSockets (relay, P2P signaling)
 * never dispatch fetch events at all; IndexedDB is a different storage system.
 *
 * @param req    `{ method, url, mode }` — a real `Request` or a plain literal.
 * @param origin the service worker's own origin (`self.location.origin`).
 */
export function classify(req, origin) {
  if (req.method !== "GET") return "bypass";
  let u;
  try {
    u = new URL(req.url);
  } catch {
    return "bypass";
  }
  if (u.origin !== origin) return "bypass";
  return req.mode === "navigate" ? "navigate" : "asset";
}

// Only healthy same-origin responses enter the cache — no opaque, error, or
// partial entries poisoning offline behaviour (R-0047 AC5).
export function cacheable(res) {
  return !!res && res.ok === true && res.type === "basic";
}

/**
 * Is this URL app CODE (an ES module or the wasm binary)? Code is served
 * NETWORK-FIRST by sw.js (R-0062) so a freshly-served HTML shell can never pair
 * with a STALE cached module: with stale-while-revalidate the cache could hold a
 * mix of old + new modules after a deploy, and a new `main.js` importing an
 * export the old cached module lacks fails the whole ES-module graph ("does not
 * provide an export named …") — main.js never runs and the app blacks out. Fonts,
 * CSS and images carry no cross-file export contract, so they stay
 * stale-while-revalidate (offline-snappy). Pure; unit-tested in pwa.test.mjs.
 */
export function isCode(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return /\.(?:m?js|wasm)$/i.test(u.pathname);
}

/**
 * The warm list (architect BLOCKING-1): the SW registers AFTER boot, so the
 * first load's ~40 module/wasm requests never passed through it — without a
 * warm pass, offline would only work after TWO online loads (R-0047 AC2 says
 * one). main.js reads `performance.getEntriesByType("resource")` after
 * registration and this turns those entries into the same-origin URL set the
 * SW should cache, deduped, cross-origin dropped (the model POST shows up in
 * the perf buffer — it must never be fetched again or cached). Pure: entries
 * are plain `{ name }` shapes.
 */
export function warmList(entries, origin) {
  const urls = new Set();
  for (const e of entries ?? []) {
    let u;
    try {
      u = new URL(e.name);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    urls.add(u.href);
  }
  return [...urls];
}

/**
 * Where registration is allowed (architect MAJOR-5): NEVER on localhost by
 * default — scripts/serve.py exists precisely to kill dev-reload staleness,
 * and an SWR cache would resurrect it (every reload one edit behind). The
 * explicit `?sw=1` opt-in keeps the SPEC-0047 §6 manual preview possible.
 */
export function shouldRegister({ hostname, search }) {
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (!local) return true;
  return /[?&]sw=1(&|$)/.test(search ?? "");
}
