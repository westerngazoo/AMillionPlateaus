# SPEC-0024 — Map zoom, pan & label level-of-detail

- **Status:** Implemented
- **Realizes:** R-0024
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-10
- **Depends on:** SPEC-0005 (render/projection), SPEC-0019 (mutable `VIEW`, `centerOn`)
- **Module(s):** `apps/web/src/wayfinding.js` + `wayfinding.test.mjs` (add `zoomAt`/`clampScale`), `apps/web/src/labels.js` + `labels.test.mjs` (NEW, pure), `apps/web/src/render.js` (cull labels via `planLabels`), `apps/web/src/main.js` (wheel/pan/buttons), `apps/web/index.html` (zoom control + CSS). **No Rust, no new deps.**

## 1. Motivation

R-0024: make the 630-node map legible. The camera is one mutable `VIEW`; `draw()`
recomputes points each frame, so zoom/pan only mutate `VIEW`. The legibility fix
is label overlap-culling (today every label draws → the pile-up).

## 2. Design

### 2.1 `wayfinding.js` — camera math (pure, beside `centerOn`)

```js
export const SCALE_MIN = 80;
export const SCALE_MAX = 4000;
export const clampScale = (s) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

// Zoom by `factor` keeping the SCREEN point (sx,sy) fixed (cursor-anchored). The
// world-projected coord under the cursor is (sx-cx)/s; after rescaling we solve
// the same projection (project.js) for the new origin. Pure; scale is clamped.
export function zoomAt(view, factor, sx, sy) {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale; // == 1 at the clamp edges → origin unchanged
  return { cx: sx - k * (sx - view.cx), cy: sy - k * (sy - view.cy), scale };
}
```

`wayfinding.test.mjs` adds: `zoomAt` keeps `(sx,sy)` fixed under the **real
`project`** (project a node, zoom at its screen point, re-project with the new
view → same screen point, to 1e-6) across zoom-in and zoom-out; `clampScale`
bounds both ends and a zoom at the clamp edge leaves the origin unchanged
(`k == 1`); deterministic.

### 2.2 `labels.js` — label level-of-detail (pure)

```js
// labels.js — pure label decluttering for the map (R-0024). Decide WHICH plateau
// labels to draw so none overlap: priority order (focused → lit → rest), greedy
// box-pack, drop any candidate whose label box hits an already-placed one. No
// canvas — label width is estimated from name length so this stays node-testable.
const CHAR_W = 6.6;   // ~px per char at 12px system-ui (lit labels are bold/wider; slight over-estimate avoids kissing)
const LINE_H = 14;    // label box height
const RADIUS = 16;    // disc radius (label sits below the disc)

export function labelBox(name, pt) {
  const w = Math.max(12, (name?.length ?? 0) * CHAR_W);
  return { x: pt.x - w / 2, y: pt.y + RADIUS + 4, w, h: LINE_H };
}
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Returns the Set of plateau ids whose label should render this frame.
 * `plateaus` is the DTO array, `points` the id→{x,y} screen map, `reachable` the
 * lit Set, `focusedId` the travelled-to id (or null). Greedy, deterministic:
 * candidates are ordered focused → lit → rest (stable within each tier by input
 * order), and each is kept only if its box clears all kept boxes.
 */
export function planLabels({ plateaus, points, reachable, focusedId = null }) {
  const rank = (p) => (p.id === focusedId ? 0 : reachable.has(p.id) ? 1 : 2);
  const ordered = plateaus
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);
  const kept = new Set();
  const boxes = [];
  for (const { p } of ordered) {
    const pt = points.get(p.id);
    if (!pt) continue;
    const box = labelBox(p.name, pt);
    if (boxes.some((b) => overlaps(box, b))) continue; // would collide → drop this frame
    boxes.push(box);
    kept.add(p.id);
  }
  return kept;
}
```

`labels.test.mjs`: two far-apart plateaus both labelled; two overlapping → only
the higher-priority kept; the **focused** id wins over a lit one it overlaps and a
**lit** wins over fogged; deterministic; an off-screen/missing point is skipped.

### 2.3 `render.js` — use `planLabels`

`render` computes `points` as today, then once: `const labelled =
planLabels({ plateaus, points, reachable, focusedId })`. In the plateau loop,
draw the disc unconditionally (unchanged) but **only draw the name when
`labelled.has(p.id)`**. Bridge concept labels and marker labels are unchanged
this phase (bridges are sparse; markers already stack per-plateau). No signature
change — `planLabels` reads the args `render` already has.

### 2.4 `main.js` — wheel zoom, drag pan, buttons

- **Wheel:** on `wheel` over the canvas, `e.preventDefault()`, compute
  `factor = e.deltaY < 0 ? 1.15 : 1/1.15`, `VIEW = zoomAt(VIEW, factor, mx, my)`
  (mx,my = cursor in canvas px), `draw()`.
- **Pan (pointer):** `pointerdown` **resets `moved = false`** and records the
  start + sets `panning`; `pointermove` while panning shifts `VIEW.cx/cy` by the
  delta and `draw()`s, setting `moved = true` once the pointer travels beyond
  `DRAG_THRESHOLD = 4` px; `pointerup` clears `panning` only.
- **Click vs drag:** the existing `canvas` `click` handler gets one guard at the
  top — **`if (moved) return;`** (architect finding 1: gate on `moved` alone, not
  `panning && moved` — by `click` time `pointerup` has cleared `panning`, so a
  `panning`-gated guard would fail open; `moved` persists from the drag until the
  next `pointerdown` resets it). So a pan never opens a plateau / signs a
  traversal — R-0010/R-0023 fire only on a genuine click.
- **Buttons:** a small `#zoom-controls` overlay (`＋`, `−`, `⟳`) on the canvas
  corner: `＋/−` call `zoomAt(VIEW, 1.3 / 0.77, canvas.width/2, canvas.height/2)`
  (zoom about centre); `⟳` resets `VIEW` to the default `{cx,cy,scale}` constant.
- `VIEW` stays the single camera; Travel/`centerOn`, the focus ring, presence,
  hit-testing all already read it — unchanged.

### 2.5 `index.html` — zoom control

A `#zoom-controls` div positioned over the canvas's top-right (three small
buttons) + CSS. The canvas is `width="800" height="600"` with **no CSS resize**,
so canvas px == CSS px 1:1 and `e.clientX − rect.left` is the correct wheel
anchor (a code comment notes this so a future responsive-canvas change scales the
anchor by `canvas.width / rect.width`). The `wheel` handler `preventDefault`s, and
`#world` gets **`touch-action: none`** so a drag-pan isn't stolen by the browser's
scroll/zoom (architect note). No other markup change.

## 3. Code outline

`wayfinding.js` +~10 lines (zoomAt/clamp) + tests; `labels.js` ~30 lines pure +
tests; `render.js` ~3 lines (call + the `labelled.has` guard); `main.js` ~35
lines (wheel + 3 pointer handlers + 3 buttons + the click guard); `index.html`
~6 lines + CSS. No Rust.

## 4. Non-goals

Per R-0024 §4: no disc clustering/aggregation; no minimap; no eased/animated
zoom; no pinch gesture; no projection/fog change. Discs keep a fixed screen
radius (hit-test unchanged).

## 5. Open questions (resolved here)

- Zoom control = a canvas-corner `＋ − ⟳` overlay. §2.5.
- Label width = pure length estimate (`CHAR_W`), keeps `planLabels` browser-free. §2.2.
- Travel stays centre-only (no auto-zoom) — camera changes stay orthogonal. §2.4.

## 6. Acceptance criteria

Maps to R-0024 AC:

- [x] AC1 — wheel (cursor-anchored) + ＋/− buttons + reset; scale clamped.
      *(Browser: wheel-zoom spread the cluster + redrew; ⟳ restored default coords.)*
- [x] AC2 — drag pans; a drag doesn't open/traverse; genuine click still does;
      hit-test correct under pan/zoom. *(panned✓, suppressedAfterDrag✓,
      genuine-click-after-reset opened "Arithmetic"✓.)*
- [x] AC3 — labels culled by priority (focused→lit→rest) + overlap; discs all draw;
      visible labels never overlap; zoom-in reveals more. *(Screenshots: dense
      view decluttered, zoomed-in view legible & non-overlapping.)*
- [x] AC4 — camera + label-selection only; no reach/graph/sync/persist change.
      *(HUD reach held at 583/639 across all zoom/pan.)*
- [x] AC5 — `zoomAt`/`clampScale` + `planLabels` pure + unit-tested. *(wayfinding
      +4, labels +6.)*
- [x] AC6 — additive JS-only; existing behaviour intact; tests green. *(174 JS;
      fmt clean; no Rust; pointer-capture hardened with try/catch.)*
- [x] AC7 — browser on the imported vault: zoom/pan, readable labels, open still
      works; console error-clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | `zoomAt`/`clampScale` live in wayfinding.js beside `centerOn` | All camera math in one pure, tested module |
| 2026-06-10 | `planLabels` is a pure box-pack with a length-based width estimate | Browser-free + deterministic; the real legibility fix |
| 2026-06-10 | Guard the existing click handler with a drag flag, don't rewrite it | Smallest change; keeps R-0010/R-0023 click paths intact |

## Changelog

- 2026-06-10 created (Draft) — pending architect review, then Accepted.
- 2026-06-10 architect design review: **APPROVE-WITH-NITS, no blocking issues**
  (zoom-anchor invariant verified numerically vs the real `project`, drift ~2e-13;
  `planLabels` 0.08 ms/frame at 630 nodes; hit-test unchanged confirmed). Folded:
  click guard gates on **`moved` alone, reset on `pointerdown`** (finding 1 —
  `panning` is cleared by `pointerup` before `click`); `CHAR_W` 6.2→6.6;
  `touch-action: none` + the 1:1-canvas anchor note. **Status → Accepted.**
- 2026-06-10 implemented + browser-verified. `wayfinding.js` `zoomAt`/`clampScale`
  (+4 tests); `labels.js` `planLabels` (+6 tests); `render.js` gates labels via
  `planLabels`; `main.js` wheel/pointer-pan/buttons + the `moved` click guard
  (pointer-capture try/catch-hardened); `index.html` `#zoom-controls` + CSS +
  `touch-action`. 174 JS tests, fmt clean, no Rust. Browser on the 630-vault:
  zoom spread the cluster, labels decluttered (non-overlapping), pan + reset +
  genuine-click-opens all confirmed, reach unchanged, console clean.
  **Status → Implemented.**
