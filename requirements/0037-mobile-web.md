# R-0037 — Mobile web: the fog-world works on a phone (responsive + touch)

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-22
- **Depends on:** R-0005 (the web fog-world / canvas), R-0024 (pan/zoom + `zoomAt`), R-0023 (the study drawer), R-0019 (onboarding/wayfinding) — all of which are desktop-laid-out today
- **Realized by:** SPEC-0037 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The 2D web app is the mature product (study, mastery, proofs, CAS, companion, sync,
offline) but it is **desktop-shaped**: there are **no responsive breakpoints**, the
detail drawer is a fixed right-side panel that occludes most of a phone screen, and the
map zooms only by **mouse wheel** (no touch). This requirement makes the existing app
**usable on a phone** — a **responsive + touch** pass over what already exists, not new
features and not a native app. The GA/CRDT core and the desktop experience are untouched;
this is **CSS + JS in `apps/web` only**.

## 2. Rationale

The owner chose to focus **mobile + web** over pushing the Godot/VR track to a second
client. The learning value already lives in the web app; the highest-leverage next step
is reaching the devices people actually learn on — phones. A responsive/touch pass
extends the entire existing feature set to mobile at low risk, reusing the core and the
`zoomAt`/`centerOn`/`pickBridge` navigation verbatim. (The viewport meta tag is already
present; what's missing is the responsive layout and touch gestures.)

## 3. Acceptance criteria

- **AC1 — Responsive layout.** At narrow widths (a phone, ~≤640px) the app is usable
  with nothing clipped or unreachable: the **detail drawer becomes a bottom-sheet**
  (full-width, slides up, dismissable) rather than a right panel that buries the map;
  the **HUD / control bar wraps or scrolls** and stays reachable; the **persona creator**
  and **companion** fit the viewport. At desktop widths the layout is **unchanged**
  (the right-side drawer, the inline HUD).

- **AC2 — Touch navigation.** On a touch screen: **one-finger drag pans** the map;
  **two-finger pinch zooms** (anchored at the pinch midpoint via the existing `zoomAt`),
  since wheel-zoom is desktop-only; a **tap still opens** a plateau / bridge (a tap is
  not a pan — the existing drag-threshold guard holds, so panning never opens a topic).

- **AC3 — Finger-friendly.** Primary interactive controls have a comfortable touch
  target (~≥40px hit height) on small screens, and text inputs do **not** trigger the
  iOS focus-zoom (≥16px effective font / viewport handling). Tap targets don't overlap.

- **AC4 — No desktop regression.** Mouse pan, wheel zoom, click-to-open, the right-side
  drawer at wide widths, and every existing interaction behave exactly as before; all
  existing suites stay green.

- **AC5 — Additive, web-only, safe.** CSS + JS in `apps/web` only — **no Rust / wasm /
  CRDT / core change**, no new dependency. Reuses `zoomAt`/`centerOn`/`pickBridge` and
  the existing render path; any new pure logic (e.g. a pinch-gesture reducer) is unit-
  tested.

- **AC6 — Green + browser-verified.** All suites green; in the browser at a **mobile
  viewport** (e.g. 375×812): the map one-finger-pans and pinch-zooms, a plateau opens in
  a bottom-sheet that's fully usable (study / mastery / resources reachable), the
  controls are reachable, and **at a desktop viewport** everything is as before — no
  uncaught console errors at either size.

## 4. Constraints & non-goals

- **Responsive web, not native.** No app-store build, no Cordova/Capacitor; the
  deliverable is the existing PWA-style web app made responsive + touch-capable.
- **Re-style + add gestures, don't redesign.** Keep the visual language; this is layout
  breakpoints + touch handlers, not a new UI.
- **Non-goals:** offline install/PWA manifest polish (separate), mobile-specific
  features, landscape-vs-portrait special-casing beyond reasonable reflow, gesture
  niceties beyond pan + pinch (double-tap-zoom optional), and any Godot/native work.

## 5. Open questions

- **Breakpoint.** A single `max-width` breakpoint (~640px) vs. a couple. Lean: one
  primary phone breakpoint; spec fixes it.
- **Drawer dismissal on mobile.** A close button + tap-outside/swipe-down. Lean: the
  existing close button + tap-the-backdrop; swipe-to-dismiss optional.
- **Pinch math location.** A pure gesture reducer (two pointers → `zoomAt` args) in a
  small tested module vs. inline in `main.js`. Lean: a small pure helper so it's
  unit-tested (AC5).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-22 | Pivot to **mobile + web**; park the Godot/VR track at its proof milestone | Owner decision — the learning value + reach is the web app on the devices people use; Godot to parity is large/headset-gated (R-0025 is Phase 11, parallel/later) |
| 2026-06-22 | A **responsive + touch** pass (CSS breakpoints + pinch/pan), not a redesign or native app | Lowest-risk way to extend the whole existing feature set to phones; reuses the core + `zoomAt` |
| 2026-06-22 | Detail drawer → **bottom-sheet** on narrow screens | A right full-height panel buries the map on a phone; a bottom-sheet is the mobile-native pattern and keeps the map visible |

## Changelog

- 2026-06-22 created (Accepted) — make the mature 2D web app usable on a phone:
  responsive layout (bottom-sheet drawer, wrapping HUD), touch pan + pinch-zoom, and
  finger-friendly targets; CSS+JS only, desktop + core untouched. Pending SPEC-0037 +
  architect review.
