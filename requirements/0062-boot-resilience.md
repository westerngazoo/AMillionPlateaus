# R-0062 — Boot resilience: never wedge on a skewed service-worker cache

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-15
- **Depends on:** R-0047 (the installable PWA + service worker this hardens).
- **Realized by:** direct implementation — an inline boot-guard in `index.html`, a boot-success
  signal in `main.js`, and a network-first-for-code strategy in `sw.js` / `pwa.js`.
- **Source:** the owner reported the live app came up **"all black … it does not work."** The deploy
  was healthy for a fresh visitor, so the failure was a returning-user / installed-PWA cache problem.

## 1. Statement

The app must **never get permanently stuck on a black screen** because of a stale or version-skewed
service-worker cache. Two independent guarantees:

1. **Prevent the skew.** Same-origin **code (JS modules + the wasm binary) is served network-first**
   (with cache fallback for offline). An online launch therefore always gets the modules that match
   the freshly-served HTML shell — a fresh `index.html` can never pair with a stale cached module.
   Non-code assets (fonts, CSS, images) stay stale-while-revalidate. The cache version is bumped
   (`mp-shell-v1` → `mp-shell-v2`) so any already-skewed cache is purged on the new worker's activate.

2. **Self-heal if it happens anyway** (offline skew, a half-updated cache, a broken deploy). An
   **inline boot-guard** — a classic `<script>` that runs even when the ES-module graph fails to
   load — watches for a boot that never completes and recovers: it clears the caches, unregisters the
   worker, and reloads **once**; a second failure shows a **manual recovery panel** ("Couldn't load
   the world — Reload / Reset cached app"). `main.js` fires an `mp:booted` signal on a successful
   boot, which cancels the watchdog.

User data (localStorage / IndexedDB — the world, personas, mastery, notes) is **never touched** by
recovery.

## 2. Rationale

R-0047's service worker served every JS module **stale-while-revalidate** and only bumped the cache
name on a strategy change — never on content deploys. Stale-while-revalidate revalidates each module
independently and lazily, so after a deploy the cache can briefly hold a **mix of old and new
modules**. A new `main.js` that imports an export an old cached module doesn't have makes the browser
throw `"does not provide an export named …"`; the whole ES-module graph fails, `main.js` never runs,
and — because `index.html` is a single `<script type="module">` with no error boundary — the page
stays **silently black**. In an **installed PWA** the user can't hard-refresh, so it stays wedged.

Network-first-for-code removes the skew at the source for the common (online) case; the boot-guard is
the belt-and-suspenders that rescues an already-wedged client (its fresh, network-first `index.html`
carries the guard) and turns any future boot failure into a visible, one-tap recovery instead of a
dead black screen.

## 3. Acceptance criteria

- **AC1 — No version skew online.** With the worker active, a same-origin `*.js` / `*.wasm` request is
  served network-first: the current deploy's bytes, with the cache refreshed as a side effect. A
  fresh HTML shell never executes against a stale cached module. Offline still serves the last cached
  (consistent) set. `pwa.js`'s `isCode()` classifies code vs. non-code and is unit-tested.
- **AC2 — Skewed cache purged on upgrade.** `CACHE_NAME` is bumped, so the new worker's `activate`
  deletes the prior cache — an existing skewed cache cannot survive the update.
- **AC3 — Self-heal a failed boot.** If boot does not signal success within a budget (or an
  unambiguous module-load error fires), the guard clears caches + unregisters the worker + reloads
  once. A returning wedged client recovers on its next launch without any manual step.
- **AC4 — Visible recovery, no black screen, no loop.** A second consecutive failure shows a manual
  panel (Reload; "Reset cached app" which purges then reloads) instead of a black screen or an
  infinite reload loop (guarded by a per-session counter).
- **AC5 — No false positives.** A healthy boot never triggers recovery — the guard keys off an
  explicit `mp:booted` signal, and its fast-path matches only **precise** ES-module-failure phrasings
  (`does not provide an export named`, `… dynamically imported module`, `importing a module script
  failed`, …). A benign background fetch failure (relay/model offline → "Failed to fetch") must NOT
  trigger a heal.
- **AC6 — Data safety.** Recovery clears only the SW caches + registration; localStorage and
  IndexedDB are never cleared automatically. "Reset cached app" is explicitly labelled "keeps your
  data".
- **AC7 — Additive + tested.** `apps/web` only; no core/Rust/wasm change; no new dependency; the pure
  `pwa.js` core (incl. `isCode`) stays `node --test`-green (SPEC-0047 §6). The guard is a
  dependency-free classic script; the SW strategy is verified live (clean boot + injected
  export-mismatch → recovery panel).

## 4. Constraints & non-goals

- **Offline-first is preserved, not abandoned.** Code is network-first only for the *fresh-match*
  guarantee; the cache is still populated on every fetch and is the offline fallback, so R-0047 AC2
  (one online load → launches offline) still holds. Non-code assets keep SWR.
- **Recovery is cache-only.** It never deletes the user's graph/identity/notes. A corrupt *persisted
  graph* is a different failure mode (out of scope here) — the panel's manual "Reset cached app" is
  the escape hatch, and a data-level reset stays user-initiated.
- **Non-goals:** content-hashed filenames / a build-step cache-busting pipeline (the app ships as
  static files with no bundler); a general in-app error-reporting surface.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-15 | Serve code (JS/wasm) network-first; keep SWR for fonts/css/images | Only cross-file *code* has an export contract that a version skew can break into a black screen; assets without that contract keep the offline-snappy SWR. |
| 2026-07-15 | Bump `CACHE_NAME` v1→v2 | It's a genuine strategy change (the bump-discipline's purpose); it also purges any already-skewed v1 cache on activate. |
| 2026-07-15 | An inline classic-script boot-guard, not an error boundary in main.js | A module-graph failure happens *before* `main.js` runs, so only a non-module script that's already on the page can catch it — essential for installed PWAs that can't hard-refresh. |
| 2026-07-15 | Watchdog keys off an explicit `mp:booted` signal + precise error phrases only | A timeout + narrow module-error match can't false-fire on a healthy-but-offline app; a broad "Failed to fetch"/"module" match would wrongly nuke a working app (found and fixed in testing). |
| 2026-07-15 | Heal once, then a manual panel | Auto-recovery fixes the common transient; a per-session cap prevents a reload loop and hands control to the user if the problem persists. Data is never auto-wiped. |

## Changelog

- 2026-07-15 created (Accepted) + implemented — network-first for code (`isCode` + `codeFirst`),
  `CACHE_NAME` → `mp-shell-v2`, an inline boot-guard (self-heal once → manual "Couldn't load the
  world" panel) and an `mp:booted` signal from `main.js`. Live-verified: a clean boot never triggers
  the guard (fresh origin, SW active on v2); an injected module export-mismatch surfaces the recovery
  panel (not a black screen); a clean reload with persisted state boots normally; the guard leaves
  IndexedDB intact. `pwa.test.mjs` 10/10, full web suite 470/470.
