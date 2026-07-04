# R-0047 — Installable offline PWA: the world in your pocket, no network needed

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-04
- **Depends on:** R-0012 (IndexedDB world durability — the data half of offline this completes),
  R-0026/R-0030/R-0034 (the offline study floor that becomes fully reachable offline), R-0037
  (mobile web — the phone/e-ink surface this makes installable), the GitHub Pages deploy (the
  origin the app installs from). Complements R-0046 (its self-hosted runtime rides the same
  runtime-caching for free).
- **Realized by:** SPEC-0047
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The fog-world is an **installable Progressive Web App**: a visitor can install it from the browser
to their desktop, phone, or e-ink tablet (the owner's Boox), launch it from the home screen as a
standalone app, and — after one ordinary online load — **use it with no network at all**: the map,
the curricula, reading, mastery, CAS drills, and the offline digest all work. The world's *data*
already survives offline (IndexedDB, R-0012); this requirement makes the *application itself*
survive: shell, modules, wasm, and vendored assets are served from a same-origin cache when the
network is gone. Updates keep flowing: when online, the app quietly refreshes its cached files so
the next launch is current — installing never pins a visitor to a stale version.

## 2. Rationale

The owner asked "how will we bundle it, installable?" — and the honest answer for a zero-dependency
static ESM app is: no bundle, a **PWA**. This is the project's own ethos completed: an
offline-first, decentralized world that still needed a network to fetch its code was only half
offline. Install + cache closes that gap on every surface the owner actually studies on (desktop,
phone, Boox in a hammock), makes the home-screen entry as frictionless as a native app, and costs
zero dependencies — a manifest, a service worker, and icons, all static files riding the existing
Pages deploy.

## 3. Acceptance criteria

- **AC1 — Installable.** The deployed site presents a valid web app manifest (name, icons incl. a
  maskable one, standalone display, theme colours matching the app) such that Chromium-family
  browsers (desktop, Android, Boox) offer **Install**, and iOS Safari's Add-to-Home-Screen yields a
  standalone app. The install works from the Pages subpath today and from a future custom domain
  unchanged (all URLs relative).

- **AC2 — Offline after first load.** After one normal online visit (which boots the full app), a
  **network-off reload** — in the browser or the installed app — loads and runs: map, lenses,
  curricula, plateau reading (KaTeX included), progress, CAS "Solve it", and the offline digest.
  The visitor's world data is the same IndexedDB world as before (the SW never touches it).

- **AC3 — Never stale.** With the network available, a launch serves the app promptly and
  **refreshes its cached files in the background**, so a subsequent launch runs the newer deploy.
  No visitor action ("clear cache", reinstall) is ever required to receive updates.

- **AC4 — The model path is untouched.** The service worker never intercepts, caches, or logs
  cross-origin requests or non-GET requests — the visitor's model calls (and the key riding their
  headers, R-0007 AC5) flow exactly as today. P2P sync, relay websockets, and IndexedDB are
  likewise untouched.

- **AC5 — Honest failure.** A cold offline launch that was never cached shows the browser's plain
  offline page (nothing half-broken); an offline launch of a cached app that needs a never-cached
  asset degrades to that feature's existing offline behaviour, not a hang.

- **AC6 — Pure core, zero deps, additive.** No npm dependency, no build step, no framework. The
  caching *decisions* (what to handle, what to bypass, which strategy per request) live in a
  **pure, unit-tested** module; the service worker itself is a thin impure shell over it. Existing
  suites stay green; the deploy workflow needs no change beyond the files themselves.

## 4. Constraints & non-goals

- **Static files only** — a manifest, one service worker, icons, a registration line. No bundler,
  no workbox, no generated precache manifests (they drift; runtime caching doesn't).
- **Non-goals (follow-ups):** push notifications; background sync of the CRDT while closed; an
  in-app "update available" toast; offline install of the R-0046 Pyodide runtime *before first
  compute use* (it caches on first use like everything else); native app-store wrappers.

## 5. Open questions

- **Navigation strategy timeout.** Network-first navigations need a fallback timeout (slow hotel
  wifi shouldn't stall launch) — SPEC-0047 fixes the number.
- **Icon art.** v1 ships a simple generated fog-world motif (discs + bridge on the app's dark
  ground); a designed icon can replace the PNGs later without code change.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-04 | PWA, not Electron/Tauri/store wrappers | Zero deps, zero build, every platform incl. Boox; the app is already a static ESM site — installability is additive |
| 2026-07-04 | Runtime caching (stale-while-revalidate), not a generated precache list | A precache manifest of src/* would drift with every PR; runtime caching can't drift, and the app's boot imports every module anyway — one online load fully populates the cache |
| 2026-07-04 | Minimal static precache: shell only (`./`, `index.html`, manifest) | Guarantees the installed app *launches* offline even if a navigation was never separately cached |

## Changelog

- 2026-07-04 created (Accepted) — installable + offline-after-first-load PWA: manifest + module
  service worker over a pure decision core; never-stale via background revalidation; model path
  and IndexedDB explicitly untouched. Owner said "yeah PWA lets do that".
