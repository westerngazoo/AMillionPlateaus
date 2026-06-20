# SPEC-0029 — Clickable bridges (a read-only connection view)

- **Status:** Implemented
- **Realizes:** R-0029
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** SPEC-0005 (render + the `points` map), SPEC-0024 (per-frame `points`, click guard), SPEC-0019 (`openPlateau`), SPEC-0028 (`normalizeUrl` for cross-cutting resources on the thread)
- **Module(s):** `apps/web/src/wayfinding.js` (+ `wayfinding.test.mjs`) — pure `pointToSegmentDistance`/`pickBridge`; `apps/web/src/study.js` (+ `study.test.mjs`) — pure `bridgeResources`; `apps/web/src/main.js` — bridge hit-test in the click handler + `openBridge`; `apps/web/index.html` — a `#detail-bridge` section + bridge-mode CSS. **No Rust/wasm/CRDT/GA change; read-only (no traversal/edit).**

## 1. Motivation

R-0029: bridges name *why* topics connect ("equations of motion") but aren't
clickable. Make a bridge open a read-only **connection view** (concept + the two
topics + cross-cutting books), reusing the projected `points` and the detail
drawer.

## 2. Design

### 2.1 `wayfinding.js` — pure hit-test geometry

```js
// Distance from point P to segment AB (clamped to the segment ends). Pure.
export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Nearest bridge whose line is within `tol` px (INCLUSIVE) of (mx,my); null if
// none. Only bridges with BOTH endpoints in `points` are considered.
// Deterministic + order-independent: min distance, ties broken by smallest id.
export function pickBridge({ bridges = [], points, mx, my, tol = 6 } = {}) {
  let hitId = null, bestD = Infinity;
  for (const b of bridges) {
    const a = points.get(b.from), c = points.get(b.to);
    if (!a || !c) continue;
    const d = pointToSegmentDistance(mx, my, a.x, a.y, c.x, c.y);
    if (d > tol) continue; // inclusive boundary: d === tol is selectable
    if (d < bestD || (d === bestD && (hitId === null || b.id < hitId))) {
      bestD = d;
      hitId = b.id;
    }
  }
  return hitId;
}
```

`bestD` starts at `Infinity` and the `d > tol` gate is separate, so a bridge
exactly at the tolerance boundary (`d === tol`) is selectable, and the
`(hitId === null || b.id < hitId)` tiebreak is reachable and **order-independent**
(smallest id wins a genuine same-distance tie regardless of iteration order — e.g.
two bridges sharing an endpoint with the cursor on it).

### 2.2 `study.js` — cross-cutting resources on a thread (pure)

```js
// Resources whose URL appears on BOTH endpoints of a bridge (the books that
// span the connection). One row per shared URL, with a representative title/kind.
export function bridgeResources({ resources = [], fromId, toId } = {}) {
  const onFrom = new Set(), onTo = new Set();
  const meta = new Map(); // url -> {title, kind, uri}
  for (const r of resources) {
    const key = normalizeUrl(r.uri);
    if (!key) continue;
    if (r.plateau_id === fromId) onFrom.add(key);
    if (r.plateau_id === toId) onTo.add(key);
    if (!meta.has(key)) meta.set(key, { title: r.title, kind: r.kind, uri: r.uri });
  }
  return [...onFrom].filter((k) => onTo.has(k)).map((k) => meta.get(k))
    .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0));
}
```

The secondary `uri` tiebreak keeps the order deterministic when two distinct
books share a title (the `uri` is the threading key — present and distinct).

### 2.3 `main.js` — bridge hit-test + `openBridge`

In the canvas click handler, **after** the plateau disc hit-test (R-0024): if
`hit` is a plateau, `openPlateau(hit)` as today.

**Precedence (architect finding 2 — fogged discs block bridges).** The plateau
hit-test only considers `clickable` (lit) discs, so a **fogged** disc is not a
`hit` and would otherwise fall through to a bridge *behind* it. Before testing
bridges, compute `overAnyDisc` = the cursor is within `RADIUS` of **any** plateau
point (lit **or** fogged, scanning all `graph.plateaus()`). Only call
`pickBridge` when **`!hit && !overAnyDisc`** — so a disc (of any fog state) always
wins the cursor, and clicking a fogged disc does nothing (never opens a bridge
through the fog). `const bid = !hit && !overAnyDisc ? pickBridge({ bridges: graph.bridges(), points, mx, my, tol: 6 }) : null;`
if `bid`, `openBridge(theBridge, graph)`.

`openBridge(b, graph)` — **read-only**:
- It signs **no** traversal, makes **no** graph edit, and does **not** touch
  presence: unlike the plateau branch (`main.js:854–861`), it must **not** set
  `myPlateau`, call `announcePresence()`, or sign a traversal. A bridge is a
  relationship, not a reachable position — leaving `myPlateau` at the last real
  plateau is correct (CLAUDE.md §6/§7: no CRDT write, no reputation event).
- Set the drawer to **bridge mode**: `detail.dataset.mode = "bridge"` (CSS hides
  `#detail-body`, `#detail-study`, `#detail-reply`, `#detail-resources`,
  `#detail-add-form`; shows `#detail-bridge`), then `detail.hidden = false`.
- Title (`#detail-name`) = `b.concept`.
- `#detail-bridge` renders: "Connects:" + the two endpoint names as controls →
  `openPlateau(plateauDtoById(b.from))` / `b.to` (names via `textContent`); then
  the `bridgeResources({ resources: graph.resources(), fromId: b.from, toId: b.to })`
  as links via `safeHref` (or "No shared resources yet.").
- `studyPlateau` is left as-is; study actions are hidden (`#detail-study` is
  `display:none` in bridge mode) and `studyAction` early-returns without a fresh
  plateau anyway, so a stray study action can't fire against a bridge.

`openPlateau` sets **`detail.dataset.mode = "plateau"` as its first line** (before
`renderStudyResources`/`detail.hidden = false`), so re-opening a plateau after a
bridge restores the body/study/resources view.

### 2.4 `index.html` — `#detail-bridge` + bridge-mode CSS

Add `<div id="detail-bridge" class="detail-bridge" hidden></div>` in
`#plateau-detail`. CSS keys off the mode:
`#plateau-detail[data-mode="bridge"] #detail-body,
 …#detail-study, …#detail-reply, …#detail-resources, …#detail-add-form { display:none }`
and `#plateau-detail:not([data-mode="bridge"]) #detail-bridge { display:none }`.
A `cursor` hint is optional (no per-frame hover hit-test this phase).

## 3. Code outline

- `wayfinding.js`: `pointToSegmentDistance`, `pickBridge` (~20 lines pure).
- `wayfinding.test.mjs`: on-segment≈0, perpendicular distance, zero-length segment
  → distance to A, beyond-end clamps to endpoint, **inclusive tolerance boundary**
  (`d === tol` selects; `d` just over → null), missing endpoint skipped,
  **same-distance id tiebreak** (two bridges sharing an endpoint, cursor on it →
  smallest id, order-independent), deterministic.
- `study.js`: `bridgeResources` (+ tests: spans-both, only-one-side excluded,
  empty-url ignored, title+uri sorted, deterministic).
- `main.js`: the precedence branch — plateau hit wins; else compute `overAnyDisc`
  (cursor within `RADIUS` of any plateau point, lit or fogged) and only
  `pickBridge` when `!hit && !overAnyDisc`; `openBridge` (~22 lines, read-only:
  no traversal/presence/edit); set `dataset.mode="plateau"` first in `openPlateau`.
- `index.html`: `#detail-bridge` + the `data-mode` CSS.

## 4. Non-goals

Per R-0029 §4: read-only (no traversal/edit); no bridge authoring/editing here;
no pathfinding/multi-hop; no edge-based reachability; no per-frame hover hit-test
(just clickable + a cursor cue).

## 5. Open questions (resolved here)

- Tolerance = 6px; plateau disc hit-test takes precedence. §2.3.
- Reuse `#plateau-detail` via `data-mode` (one drawer). §2.4.
- No traversal/edit on bridge open (read-only). §2.3.

## 6. Acceptance criteria

Maps to R-0029 AC:

- [ ] AC1 — clicking a bridge line opens the connection view; disc/empty-space
      behaviour unchanged. *(browser)*
- [ ] AC2 — view shows concept + both topics (each opens its Study view); no
      body/study/add. *(browser)*
- [ ] AC3 — lists resources spanning both ends (else "none"). *(browser +
      `bridgeResources` test)*
- [ ] AC4 — hit-test uses per-frame `points`; correct under pan/zoom; plateau
      precedence; missing-endpoint skipped. *(unit + browser)*
- [ ] AC5 — `pointToSegmentDistance`/`pickBridge`/`bridgeResources` pure +
      unit-tested. *(node --test)*
- [ ] AC6 — additive JS-only; read-only (no traversal/edit); `textContent`/
      `safeHref`; suites green. *(diff + suites)*
- [ ] AC7 — browser: "equations of motion" opens Calculus↔Motion + the Feynman
      book; disc click still opens the plateau; console clean. *(browser)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Pure `pickBridge` over the per-frame `points`; plateau hit wins | Correct under any camera for free (R-0024); keeps topics openable |
| 2026-06-15 | Reuse `#plateau-detail` via `data-mode="bridge"` | One drawer, no new panel; CSS hides plateau-only parts |
| 2026-06-15 | Opening a bridge is read-only (no traversal) | A bridge is a relationship, not a reachable destination; avoids spurious reach growth |
| 2026-06-15 | `bridgeResources` reuses `normalizeUrl` (R-0028) | The connection view is exactly where a cross-cutting book belongs; one threading rule |

## Changelog

- 2026-06-15 created (Draft) — pure bridge hit-test + read-only connection view
  (concept + endpoints + cross-cutting books), reusing `points` + the drawer.
  Pending architect review, then `Accepted`.
- 2026-06-15 architect design review: **REQUEST-CHANGES → resolved**. Fixed the
  blocking `pickBridge` bug (init `Infinity`, **inclusive** `d <= tol` gate,
  order-independent `(hitId === null || b.id < hitId)` tiebreak — boundary now
  selectable, tie reachable). Resolved fogged-disc precedence: only `pickBridge`
  when `!hit && !overAnyDisc` (cursor not within `RADIUS` of any disc, lit or
  fogged) so a fogged disc never opens a bridge through it. Pinned `openBridge` as
  strictly **read-only** (no traversal/presence/edit). Added the `bridgeResources`
  uri tiebreak. Confirmed `openPlateau` sets `data-mode="plateau"` first, study
  actions can't fire in bridge mode, all read-only/injection-safe. **Status →
  Accepted.**
- 2026-06-15 implemented + browser-verified. `wayfinding.js` `pointToSegmentDistance`/`pickBridge` (+ tests incl. inclusive boundary + order-independent id tie); `study.js` `bridgeResources` (+ tests); `main.js` click precedence (`overAnyDisc`) + read-only `openBridge` + `openPlateau` mode-first; `index.html` `#detail-bridge` + bridge-mode CSS. 194 JS tests; cargo/clippy/fmt green & unchanged (no `crates/` diff). Browser: clicking the Calculus→Motion line opened "equations of motion" (Connects: Calculus ↔ Motion + the Feynman book spanning both); topic links opened the plateaus; disc click still opened its plateau; console clean. QA PASS → R-0029 **Met**. **Status → Implemented.**
