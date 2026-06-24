# SPEC-0037 — Mobile web: responsive layout + touch pan/pinch (CSS + JS only)

- **Status:** Implemented
- **Realizes:** R-0037
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-22
- **Depends on:** SPEC-0024 (`zoomAt` cursor-anchored zoom + the pan/pointer handlers), SPEC-0023 (the `#plateau-detail` drawer), SPEC-0005 (the canvas/`VIEW`)
- **Module(s):** `apps/web/src/gestures.js` (NEW, + `gestures.test.mjs`) — a pure two-pointer **pinch reducer**; `apps/web/src/main.js` — multi-pointer tracking → pan (1 finger) / pinch-zoom (2 fingers); `apps/web/index.html` — a `@media` mobile breakpoint (bottom-sheet drawer, wrapping HUD, finger targets) + `touch-action: none` on the canvas. **No Rust/wasm/CRDT/core change; desktop unchanged.**

## 1. Motivation

R-0037: make the mature 2D app usable on a phone — a responsive + touch pass, not a
redesign. The viewport meta is already present; the gaps are (a) **no responsive
breakpoint** (the drawer is a right panel that buries the map; the HUD doesn't reflow)
and (b) **wheel-only zoom** (no touch pinch). Both are CSS/JS in `apps/web`, reusing
`zoomAt`/`centerOn`/`pickBridge` and the render path verbatim.

## 2. Design

### 2.1 Touch: multi-pointer pan + pinch (`gestures.js` pure + `main.js` wiring)

Today `main.js` tracks a single pointer (pan) + `wheel` (zoom). Generalise to a
**pointer map** so two fingers pinch-zoom:

```js
// gestures.js — pure, deterministic, no DOM. Two-pointer pinch → zoomAt() args.
// `a`/`b` are {x, y} canvas-relative points; returns the scale factor between two
// frames and the (anchor) midpoint to zoom about. dist 0 ⇒ factor 1 (no-op, safe).
export function pinch(prev, cur) {
  const d0 = Math.hypot(prev.a.x - prev.b.x, prev.a.y - prev.b.y);
  const d1 = Math.hypot(cur.a.x - cur.b.x, cur.a.y - cur.b.y);
  let factor = d0 > 0 ? d1 / d0 : 1;
  if (!Number.isFinite(factor) || factor <= 0) factor = 1; // never pollute zoomAt (NaN/∞/0-guard)
  return { factor, cx: (cur.a.x + cur.b.x) / 2, cy: (cur.a.y + cur.b.y) / 2 };
}
```

**Coordinate space (BLOCKING fix — architect finding 1).** The canvas is `800×600`
intrinsic and today is **not** CSS-scaled, so `client px == canvas px` 1:1 and pan/wheel/
click all assume that. Making the map fill a phone width means CSS-scaling the canvas,
which breaks the 1:1 everywhere. So this slice adds a **single** conversion used by *all*
pointer maths (pan, wheel, click hit-test, pinch) — which also retires the pre-existing
latent bug that the `click` hit-test is wrong for any scaled canvas:

```js
function clientToCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) * (canvas.width / r.width), y: (clientY - r.top) * (canvas.height / r.height) };
}
```

All pointer points (pan origin/move, wheel anchor, the click `mx,my`, and each pinch
pointer) are built via `clientToCanvas`; pan deltas are then taken in **canvas space**
(`panStart` stored as the canvas-space point + `VIEW.cx/cy`). On desktop `r.width == 800`
⇒ scale 1 ⇒ byte-identical to today (no regression); on a phone the canvas scales down
and the conversion keeps the anchor/hit-test correct.

`main.js` (replacing the single-pointer block, behaviour-preserving for one pointer):
- `const pointers = new Map()` — `pointerId → {x, y}` (canvas-relative).
- **pointerdown** → add; capture; reset `moved`. If now 2 pointers, snapshot `pinchPrev`.
- **pointermove** → update the moved pointer.
  - **2 pointers** → pinch: `const g = pinch(pinchPrev, cur); VIEW = zoomAt(VIEW, g.factor, g.cx, g.cy); pinchPrev = cur; moved = true;` (so the gesture never opens a topic) — `draw()`.
  - **1 pointer** → pan exactly as today (drag-threshold guard unchanged).
- **pointerup/pointercancel** → delete the pointer; if it drops below 2, clear `pinchPrev` and re-seat the pan origin from the remaining pointer (no jump).
- Tap-to-open is unchanged: the `moved` guard at `click` already suppresses open after a pan, and pinch sets `moved = true`.

CSS: `#world` **already has `touch-action: none`** (added by R-0024 — so the browser
doesn't steal touch for page scroll/zoom); no change needed there. The canvas CSS change
this slice *does* need is making it **responsive** so it fills the phone width — see §2.2.
`wheel` zoom stays for desktop.

### 2.2 Responsive layout (`index.html` — one `@media (max-width: 640px)` block)

No existing `@media`; add one phone breakpoint. Desktop rules are untouched (the
breakpoint only *overrides* at narrow widths):

- **`#plateau-detail` → bottom-sheet:** `top: auto; left: 0; right: 0; bottom: 0;
  width: 100%; max-width: 100%; height: 80vh; border-radius: 14px 14px 0 0;` — slides up
  over the map instead of a full-height right panel, keeping the map visible above it.
  (Its bridge-mode hide-list and contents are unchanged.)
- **HUD / control bar:** `flex-wrap: wrap` + a slightly larger gap so the buttons reflow
  onto multiple rows and stay reachable (horizontal scroll as a fallback).
- **Persona creator:** cards go full-width (`width: 100%`/wrap), the panel scrolls.
- **Companion:** full-width, height-capped (e.g. `width: 100%; height: 70vh`) so it
  doesn't exceed the viewport.
- **Responsive canvas:** `#world { width: 100%; height: auto; max-width: 800px; }` so the
  map fills the phone width (scaling the intrinsic 800×600 down; on desktop it stays
  ≤800 = native, scale 1). This is the CSS half of the §2.1 coordinate fix — the
  `clientToCanvas` scale conversion is what keeps pan/zoom/tap correct once it scales.
- **Finger targets / iOS zoom:** at the breakpoint, buttons (incl. **`#detail-close`** —
  the bottom-sheet's dismissal control) get `min-height: 40px`, and a blanket
  `input, textarea, select { font-size: 16px; }` (≥16px stops iOS focus-zoom — covers the
  12–13px inputs: `#relay-url`, `.field`/`.author-field`/`.companion-form` inputs, setup
  fields, `#proof-input`/`#solve-input`).

### 2.3 Tap vs. pan vs. pinch

The existing `DRAG_THRESHOLD` guard (a small move ⇒ not a click) already separates tap
from pan. Pinch additionally forces `moved = true`, so a two-finger gesture never opens a
plateau. One-finger tap → open (unchanged); one-finger drag → pan; two-finger → zoom.

## 3. Code outline

- `gestures.js`: `pinch(prev, cur) → { factor, cx, cy }` (pure).
- `gestures.test.mjs`: spreading fingers ⇒ factor > 1; pinching in ⇒ factor < 1; the
  midpoint is the anchor; coincident points ⇒ factor 1 (no NaN); deterministic.
- `main.js`: the `pointers` Map + pinch branch; `pinchPrev` seat/clear on up/down;
  one-pointer pan behaviour byte-preserved.
- `index.html`: `#world { touch-action: none; }` + the `@media (max-width: 640px)` block
  (bottom-sheet drawer, wrapping HUD, full-width creator/companion, 40px targets, 16px
  inputs).

## 4. Non-goals

Per R-0037 §4: responsive web only (no native build); re-style + gestures, not a
redesign; no PWA-manifest polish, no landscape special-casing, no double-tap-zoom
(optional), no Godot/core work.

## 5. Open questions (resolved here)

- **Breakpoint** = a single `max-width: 640px`. §2.2.
- **Pinch math** = a pure `gestures.js` reducer (unit-tested), `zoomAt` does the actual
  transform (reused). §2.1.
- **Dismissal** = the existing **close button only** (there is no backdrop element today,
  and the CSS-only sheet adds none). As a bottom-sheet the close button sits at the
  sheet's top edge — reachable, not buried — and gets a 40px target. Tap-backdrop /
  swipe-to-dismiss are non-goals this phase.

## 6. Acceptance criteria

Maps to R-0037 AC:

- [x] AC1 — narrow-width layout: bottom-sheet drawer, wrapping HUD, fitted creator/
      companion; desktop layout unchanged. *(browser @ mobile + desktop presets)*
- [x] AC2 — one-finger pan, two-finger pinch-zoom (anchored), tap still opens. *(pinch unit tests + browser)*
- [x] AC3 — ~≥40px touch targets; 16px inputs (no iOS focus-zoom). *(markup/CSS + browser)*
- [x] AC4 — no desktop regression (mouse pan, wheel zoom, click, right drawer); suites green. *(browser + suites)*
- [x] AC5 — CSS+JS only; no Rust/wasm/CRDT/core change; pinch reducer pure + tested. *(diff + node --test)*
- [x] AC6 — green; browser @ 375×812 (pan/pinch/bottom-sheet usable) and desktop (unchanged); console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-22 | Pure `pinch` reducer + reuse `zoomAt` | Keeps the gesture math node-testable; the transform stays the vetted R-0024 path |
| 2026-06-22 | `touch-action: none` on the canvas | Required so two-finger pinch zooms the MAP, not the page |
| 2026-06-22 | One `@media (max-width: 640px)` that only overrides | Zero risk to the desktop layout — narrow rules are additive overrides |
| 2026-06-22 | Bottom-sheet drawer on mobile | Keeps the map visible; the mobile-native pattern vs. a buried right panel |

## Changelog

- 2026-06-22 implemented + QA **PASS** (AC1–AC6). `gestures.js` (pure `pinch`, 7 unit
  tests) + `main.js` (central `clientToCanvas` scale through which pan/wheel/click/pinch
  flow; `pointers` Map with the 2-pointer pinch branch + 1-pointer pan) + `index.html`
  (responsive `#world` + one `@media (max-width:640px)`: bottom-sheet drawer, wrapping
  HUD/40px targets, full-width creator/companion, 16px inputs, `overflow-x:hidden`,
  `.stage`/canvas capped to `100vw`). Browser-verified: mobile 375×812 (canvas 343px @
  scale 2.33, tap opened a plateau via the scaled hit-test, bottom-sheet exactly 375 with
  no overflow, pinch clean, console clean) and desktop 1280×800 (canvas 800 @ scale 1 =
  byte-identical, right-side drawer, wheel/click unchanged). Suite 262 green; additive
  (apps/web only, no Rust/core). One fix during verify: `.stage{width:100%}` +
  `box-sizing:border-box` on the sheet to kill horizontal overflow. **Status → Implemented.**
- 2026-06-22 architect design review: **REQUEST-CHANGES → resolved.** Confirmed sound:
  the pure `pinch` reducer + `zoomAt` reuse, the `pointers` Map, the single additive
  `@media` (no existing `@media` anywhere → desktop can't regress), the bottom-sheet
  z-order (z25, above creator/setup, below tutorial) not burying the map or its close
  button. **Folded the blocking fix:** a central `clientToCanvas` scale conversion
  (`canvas.width / rect.width`) through which pan/wheel/click/pinch coords all flow — once
  the canvas is made responsive (`#world { width:100%; height:auto; max-width:800px }`),
  client px ≠ canvas px, and this keeps pan speed, the pinch anchor, and tap hit-testing
  correct (also retires a pre-existing latent tap bug; desktop stays scale-1 = unchanged).
  Plus: `touch-action:none` already exists (not a new change); dismissal is the close
  button only (no backdrop element) with a 40px target; a `Number.isFinite` guard on the
  `pinch` factor (+ a NaN unit case); the 16px-input rule enumerated to cover every
  sub-16px input. **Status → Accepted.**
- 2026-06-22 created (Draft) — responsive `@media` (bottom-sheet drawer, wrapping HUD,
  finger targets) + touch pan/pinch (`gestures.js` + `touch-action:none`), reusing
  `zoomAt`. CSS+JS only; desktop + core untouched. Pending architect review, then `Accepted`.
