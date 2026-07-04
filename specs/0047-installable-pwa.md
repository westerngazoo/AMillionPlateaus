# SPEC-0047 — Installable offline PWA (manifest + module SW over a pure core)

- **Status:** Accepted (architect: REQUEST-CHANGES 2026-07-04 — all three BLOCKING + two MAJOR findings folded below; re-review not required, fixes follow the review's own prescriptions)
- **Realizes:** R-0047
- **Author:** Claude (Opus 4.8)
- **Created:** 2026-07-04
- **Depends on:** SPEC-0012 (IndexedDB world — untouched by the SW), SPEC-0037 (mobile surface),
  the deploy-pages workflow (ships the new static files as-is), SPEC-0046 (its vendored Pyodide
  rides the same runtime cache on first use).
- **Module(s):** `apps/web/{manifest.webmanifest,sw.js,icons/*}`, `apps/web/src/pwa.js` (+ test),
  `apps/web/index.html` (manifest link + theme-color), `apps/web/src/main.js` (one registration
  line), `scripts/serve.py` (a `.webmanifest` MIME hint).

## 1. Motivation

R-0047: install to desktop/phone/Boox and run fully offline after one load, never stale, model
path untouched. The app is a zero-dep static ESM site on GitHub Pages, so the whole feature is
four static files plus one registration line — with the caching *decisions* extracted pure so they
are unit-tested like every other core module (cas.js / viewpipeline.js precedent).

## 2. Design

### 2.1 `src/pwa.js` — the pure decision core (unit-tested)

No `self`/`caches`/`fetch` reference. Exports:

- `CACHE_NAME = "mp-shell-v1"` — bumped only on *strategy* changes, never for content (SWR keeps
  content fresh; old caches are deleted on activate).
- `SHELL = "./index.html"` — ONE canonical shell key (architect NIT-7): both `./` and
  `./index.html` navigations fall back to, and refresh, this single entry.
- `PRECACHE = [SHELL, "./manifest.webmanifest"]` — the launchable shell, nothing that can drift.
- `VENDOR_WARM` — the vendored KaTeX set (katex.mjs, katex.min.css, the 20 woff2 fonts). KaTeX is
  imported LAZILY on the first math typeset (katex.js), so boot never requests it and neither SWR
  nor the boot warm pass would see it (architect BLOCKING-2) — without this list, offline reading
  degrades to raw TeX. Not the drifting src/* manifest R-0047 rejects: vendor files are pinned, and
  `pwa.test.mjs` asserts the list matches the vendor directory ON DISK, so it cannot silently drift.
- `warmList(perfEntries, origin)` — (architect BLOCKING-1) the SW registers AFTER boot, so the
  first load's ~40 module/wasm requests never pass through it; without a warm pass, offline works
  only after TWO loads (AC2 says one). This turns `performance.getEntriesByType("resource")` into
  the same-origin URL set to cache — deduped, cross-origin dropped (the model POST appears in the
  perf buffer and must never be re-fetched). main.js posts `[...warmList(...), ...VENDOR_WARM]` to
  the SW as a `{type:"warm"}` message; the SW fetch+puts each (skip-if-cached, per-URL failure
  tolerated — AC5).
- `shouldRegister({hostname, search})` — (architect MAJOR-5) NEVER register on
  localhost/127.0.0.1 unless `?sw=1`: scripts/serve.py's no-cache contract exists precisely to
  kill dev staleness, and an SWR cache would resurrect it (every dev reload one edit behind). The
  opt-in keeps the §6 manual preview possible.
- `classify(req, origin) → "bypass" | "navigate" | "asset"` over a plain `{method, url, mode}`
  shape (the SW passes the real `Request`; tests pass literals):
  - non-`GET` → `bypass`; different origin → `bypass` (model calls incl. localhost runtimes, relay
    websockets — R-0047 AC4);
  - `mode === "navigate"` → `navigate`; else `asset`.
- `NAV_TIMEOUT_MS = 4000` — the R-0047 §5 number: navigation tries the network this long, then
  falls back to the cached shell.
- `cacheable(res) → boolean` — only `res.ok && res.type === "basic"` responses are stored (no
  opaque/error entries poisoning the cache).

### 2.2 `sw.js` — the thin impure shell (module service worker)

`register("./sw.js", { type: "module" })` so it can `import` the pure core directly (same ESM
idiom as the app; Chromium/Firefox/Safari ≥ 16.4 — older browsers simply skip SW and work online
as today, which is R-0047's graceful floor):

- **install** — `caches.open(CACHE_NAME)` → `addAll(PRECACHE)` → `skipWaiting()`.
- **activate** — delete caches ≠ `CACHE_NAME` → `clients.claim()`.
- **fetch** — `classify()`:
  - `bypass` → do not call `respondWith` (the request proceeds untouched — AC4 by *absence*);
  - `navigate` → network-first with `NAV_TIMEOUT_MS` (AbortController); a SUCCESS also
    `cache.put(SHELL, fresh.clone())` (architect BLOCKING-3: without this, the install-day shell
    is the offline fallback forever, pairing an ancient index.html — which carries every feature's
    DOM — with fresh modules); on failure `caches.match(SHELL)`;
  - `asset` → **stale-while-revalidate**: serve `caches.match(req)` immediately when present, and
    in `waitUntil` fetch + `cache.put` when `cacheable()` (AC3's never-stale); cache miss → network
    (populating the cache), network failure → the miss propagates (AC5's honest failure).

One online load populates the cache via the **warm pass** (§2.1 `warmList` + `VENDOR_WARM` over
the `{type:"warm"}` message), NOT via the boot requests themselves — those predate the SW
(architect BLOCKING-1). Also a `message` listener in sw.js executes the warm.

**Coherence model (architect MAJOR-4, stated honestly):** freshness is per-FILE, not per-deploy.
Every launch serves what it has and revalidates in the background; the next launch runs the newer
files. One narrow window exists: a deploy that ADDS a module, followed by an online session (which
revalidates main.js) and then an OFFLINE launch, can cache-miss the new module and fail that boot;
it self-heals on the next online launch. This is the accepted price of R-0047's own
no-generated-manifest decision — recorded here so QA tests around it rather than discovering it.

### 2.3 Manifest, icons, registration

- `manifest.webmanifest`: `name` "A Million Plateaus", `short_name` "Plateaus", `start_url` `"./"`,
  `scope` `"./"`, `display` `"standalone"`, `background_color`/`theme_color` `"#11161d"` (the app
  ground), icons 192/512 + a 512 maskable. **All URLs relative** — subpath-safe under
  `/AMillionPlateaus/` and unchanged under a future custom domain (AC1).
- `icons/` — three committed PNGs (a generated fog-world motif: gold mastered disc + neighbours +
  bridge on the dark ground; a few KB each, R-0047 §5 allows later replacement).
- `index.html`: `<link rel="manifest" href="./manifest.webmanifest">` + `<meta name="theme-color"
  content="#11161d">` + apple-touch-icon.
- `main.js` (end of boot): gated on `shouldRegister(window.location)`; registers
  `./sw.js` `{type:"module"}`, awaits `serviceWorker.ready`, then posts the warm message
  (boot perf entries + `VENDOR_WARM`). Never blocking, silent on unsupported browsers.
- `scripts/serve.py`: map `.webmanifest → application/manifest+json` so dev matches Pages.

## 3. Code outline

```js
// src/pwa.js — PURE. Tested in pwa.test.mjs.
export const CACHE_NAME = "mp-shell-v1";
export const SHELL = "./index.html";
export const PRECACHE = [SHELL, "./manifest.webmanifest"];
export const NAV_TIMEOUT_MS = 4000;
export const VENDOR_WARM = ["./vendor/katex/katex.mjs", /* css + 20 woff2, disk-checked */];
export function classify(req, origin) { /* bypass | navigate | asset */ }
export function cacheable(res) { return !!res && res.ok === true && res.type === "basic"; }
export function warmList(entries, origin) { /* same-origin perf URLs, deduped */ }
export function shouldRegister({ hostname, search }) { /* prod yes; localhost only ?sw=1 */ }
```

## 4. Non-goals

Push, background CRDT sync, update toasts, precache manifests, store wrappers (R-0047 §4).

## 5. Open questions

— (the two R-0047 §5 questions are fixed above: 4000 ms; generated icon art v1).

## 6. Test strategy

- **`pwa.test.mjs` (node --test, pure):** `classify` — POST/PUT bypass; cross-origin GET bypass
  (api.anthropic.com, googleapis, localhost:11434/:1234 against the app origin); same-origin
  navigate → `navigate`; script/wasm/css → `asset`; malformed URL → bypass. `cacheable` — ok+basic
  true; 4xx/opaque/undefined false. One canonical `SHELL`; `PRECACHE` drift-proof; knobs pinned.
  `warmList` — keeps same-origin boot resources, DROPS the model URL from the perf buffer, dedups.
  `VENDOR_WARM` — checked against the vendor directory ON DISK (every listed file exists; every
  woff2 on disk is listed). `shouldRegister` — prod true; localhost false; `?sw=1` opt-in true.
- **Preview (impure, manual):** register on localhost WITH `?sw=1`, assert `serviceWorker.ready`,
  `caches.keys()` contains `CACHE_NAME`, the warm pass lands the module/wasm/KaTeX set in the
  cache, manifest fetches 200 with icons resolvable; post-merge on the live Pages deploy run the
  decisive scenario: first-load → offline → reload works (AC2).
