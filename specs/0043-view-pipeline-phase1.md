# SPEC-0043 — View pipeline Phase 1: `viewModel → Frame → canvasRenderer`, pure `hitTest`

- **Status:** Accepted
- **Realizes:** R-0043
- **Depends on:** RFC-0003 (the design + architect-reviewed Phase 1); the existing pure view
  modules `project.js` (place), `layout.js` (`spreadNodes`), `labels.js`
  (`planLabels`/`planBoxes`/`labelBox`/`captionBox`), `wayfinding.js` (`pickBridge`)

## 1. Approach

Split `apps/web/src/render.js` into three parts **without changing output**:

1. a pure **`viewModel(graph, positions, state) → Frame`** (`viewpipeline.js`) — every styling,
   emphasis, colour, label, and z-tier decision, no canvas;
2. a **`canvasRenderer(canvas)`** with `draw(frame)` — the *only* code that touches a 2D context,
   replaying the `Frame` in the exact order `render.js` draws today;
3. a pure **`hitTest(positions, x, y) → id|null`** — `pickBridge` + the node-pick loop, unchanged,
   as a function over the placement map (**not** on the renderer).

`main.js` injects `{ layout: spreadLayout, renderer: canvasRenderer, hitTest }` and runs
`renderer.draw(viewModel(graph, layout(place(graph, view)), state))`. `place`/`layout`/label
planning already exist as pure modules; this spec **moves the emphasis + styling decisions out of
`render.js` into `viewModel`** and leaves a thin, mechanical renderer. Same pixels, behind a seam.

## 2. Design

### 2.1 The `Frame` — exact, from a block-by-block `render.js` cross-check

Every element the current `render.js` draws, with the z-tier it draws in. (Inventory verified
against `render.js` on `main`.)

```js
// z-tiers draw in array order; the renderer honours `tier` explicitly, not source position.
Frame = {
  edges: [{ from, to, covered, caption? }],                 // lines (covered=trail) + concept caption
  pathRoute: [id, …] | null,                                // dashed, UNDER discs (tier 0)
  nodes: [{
    id, x, y,
    tier: "shadow" | "focus",                               // shadow ⇒ r=9 α0.4; focus ⇒ r=16 α1
    fill,                                                    // UNEXPLORED | STUDYING | MASTERED_FILL
    ring: "lit" | "unexplored" | null,                      // focus only
    communityRing: bool,                                    // outer CANONICAL ring at r+4 — SEPARATE from ring
    mastered: bool,                                         // draw ✓ glyph
    label: string | null,                                   // focus only, post-planLabels
  }],
  markers: [{ plateauId, stackIndex, crystallized, caption? }],  // dots + optional title; i*14 stack offset
  peers:   [{ plateauId, fanIndex, hue, label }],           // silhouettes LEFT of disc, fanned
  overlays: { focusRing: id|null, nextStepRing: id|null },
}
```

**Co-occurrence the schema must preserve** (architect finding #5): a node can carry *both*
`communityRing:true` **and** `ring:"lit"` **and** `mastered:true` at once — three distinct
decorations. `ring` is the progress ring; `communityRing` is the separate bedrock ring; they are
not one field.

**Clarifications** (architect finding #5/#6):
- *Naming* — this `Frame` uses `tier`/`x`/`y` where RFC-0003 §4 wrote `emphasis`/`pos`; the spec is
  the authority, the rename is deliberate (radius/alpha are implied by `tier`).
- *Shadow nodes carry only `{ id, x, y, fill }`* — every decoration field (`ring`, `communityRing`,
  `mastered`, `label`) is null/false for `tier:"shadow"`, so the renderer's shadow branch is
  unambiguous.
- *A shadow node is never `STUDYING`-coloured* — `inFocus` already promotes any `visited` node to
  the focus tier (`render.js:48`), so shadow `fill` is only `"mastered"` or `"unexplored"`; the
  `viewModel` must not emit `"studying"` on a shadow node (a silent pixel change otherwise).
- *`pathRoute` is `null`, not `[]`, below 2 steps* — matches today's `pathSteps.length > 1` gate,
  so the renderer's route branch is a pure null-check and never strokes a degenerate 1-point path.

### 2.2 `viewModel(graph, positions, state) → Frame` (pure)

`state = { visited, mastered, community, focusedId, focusDomains, pathSteps, pathNext }`. It
computes: the `inFocus` predicate (→ `tier`) and `SHADOW_RADIUS`/`RADIUS`; progress `fill`/`ring`
(R-0033/R-0030); `communityRing` (R-0031); which labels survive (`planLabels` over focus nodes
only) and which captions survive (`planBoxes` with kept name-boxes as obstacles, focus-gated for
bridge concepts **and** resource titles); marker stacking + crystallized/floating; peer fanning +
`hue`; the overlay ring ids. **No `ctx` reference anywhere in this module** — it is unit- and
snapshot-testable exactly like `labels.js`.

### 2.3 `canvasRenderer(canvas)` (the only canvas code)

`draw(frame)` replays in the current z-order, holding **no state between frames**. **Critical
ordering nuance** (architect finding, verified against `render.js:143-177`): the focus disc, its
community bedrock ring, and its ✓ are drawn **per node in one loop** — so node B's disc can paint
over node A's ✓/ring. The renderer must therefore replay **disc → communityRing → ✓ per focus node
in a single interleaved pass**, NOT as three global tiers (a global split could change a pixel
where discs overlap). Only **names** are a genuinely separate final pass (`render.js:181`). Full
order:

```
path route  →  bridges (+captions)  →  shadow discs (α 0.4, r=9)
→  FOR EACH focus node: disc (r=16) → communityRing (r+4) → ✓        // interleaved, per node
→  names (separate pass)  →  focus ring  →  next-step ring  →  markers  →  peers
```

**Colours: semantic tokens, proven 1:1 (architect finding #3).** The `Frame` carries decision
tokens (`fill: "mastered"|"studying"|"unexplored"`, `ring: "lit"|"unexplored"`) and the renderer
holds the **exact same 12 hex constants** `render.js:11-22` holds today; a **unit test asserts the
token→hex table equals the current constants byte-for-byte**. This keeps the Phase-3 WebGL remap
benefit *without* widening the parity surface — the mapping is identical to today's inline ternary,
just named.

### 2.4 `hitTest(positions, x, y) → id | null` (pure, off the renderer)

Lift `main.js`'s node-pick loop + `pickBridge(positions, …)` into one pure function over the
placement map. **Iterate `positions` keys, not `graph.plateaus()`** (architect finding #4): today's
loop (`main.js:1166-1173`) does `points.get(p.id).x` with **no null guard**, so it *throws* if a
plateau is ever absent from `points` — safe today only because both the draw and the click read the
*same* live plateau set. The extraction breaks that coupling (`hitTest` gets the *last-drawn*
`positions`; the click reads `graph` *now*), so iterating `graph.plateaus()` would reintroduce an
NPE window. Iterating `positions` keys makes `hitTest` **total by construction** — the cleaner pure
function. This is a **declared, intentional micro-deviation**: it eliminates a latent crash; the
only observable difference is that a plateau authored/synced *between* a draw and a click becomes
clickable one frame later (the next `draw()` is immediate) — imperceptible, and strictly safer.
Node hit uses `RADIUS` (unchanged). It is **not** a method on `canvasRenderer` (RFC-0003 §4/§9) — a
future 3D renderer supplies its own raycast `hitTest`.

### 2.5 `main.js` wiring

```js
import { canvasRenderer } from "./renderers/canvas.js";
import { viewModel } from "./viewpipeline.js";
import { spreadNodes as spreadLayout } from "./layout.js";
import { project as place } from "./project.js";
import { hitTest } from "./hittest.js";

const renderer = canvasRenderer(canvas);
function draw() {
  positions = spreadLayout(placeAll(graph, VIEW));      // Map<id,{x,y}> — reused for hit-test
  renderer.draw(viewModel(graph, positions, viewState()));
}
// pointerup:  const id = hitTest(positions, mx, my);
```
`positions` is stored (as `points` is today) so the same placement drives draw **and** hit-test.

## 3. The gate: a draw-call-log snapshot (AC5 — the load-bearing test)

A `Frame` snapshot proves the *model* is stable; it does **not** prove the *rendered result* is
unchanged. But a **pixel** snapshot is the wrong tool here (architect findings #1/#2):
`apps/web` has **no `package.json`, no `node_modules`** — every one of the 30 existing
`*.test.mjs` runs under bare `node --test` importing only relative + `node:` modules. A canvas
shim (`@napi-rs/canvas`) would introduce the project's first npm manifest *and* be
**non-deterministic** (headless font rendering ≠ the author's `system-ui`), so a committed pixel
baseline goes red in CI for reasons unrelated to the refactor.

**Instead, snapshot the draw-call sequence, not the pixels.** `canvasRenderer(canvas)` draws
through the passed context; the test passes a **recording mock `ctx`** that appends each op to a
log — `["moveTo", x, y]`, `["arc", x, y, r, …]`, `["fill", style]`, `["fillText", text, x, y]`,
`["set globalAlpha", 0.4]`, `["set strokeStyle", "#…"]`, `setLineDash`, `save/restore` — as plain
data. This is:

- **dependency-free** (a ~40-line mock, no `package.json`, runs under the current `node --test`);
- **deterministic** (it records *intent*, not rendered glyphs — no font backend in the loop);
- **exactly the right resolution** — it catches z-order, alpha, radius, colour token→hex, and text
  position changes, which is precisely what a behaviour-preserving refactor must not alter.

Gate: capture the op-log from **pre-refactor `render.js`** across four states — (a) no persona,
(b) a Constructivist lens, (c) a followed path, (d) a mastered node — commit it as the baseline,
and assert the post-refactor `viewModel + canvasRenderer` produces the **identical** log. Red-team
it: deliberately swap two draw tiers → the test must go red. (A browser pixel snapshot via
Playwright can be added later in CI as belt-and-suspenders, but it is **not** required for Phase 1
and must never be the primary gate for the reasons above.) The interaction half of AC5 is a manual
browser smoke pass (§7).

## 4. Files

| File | Change |
|------|--------|
| `apps/web/src/viewpipeline.js` (new) + `.test.mjs` | pure `viewModel → Frame`; Frame snapshot tests |
| `apps/web/src/renderers/canvas.js` (new) | `canvasRenderer(canvas).draw(frame)` — the only `ctx` code |
| `apps/web/src/hittest.js` (new) + `.test.mjs` | pure `hitTest(positions,x,y)`; node-pick + `pickBridge` |
| `apps/web/src/render.js` | reduced to a thin shim or removed; callers use the seam |
| `apps/web/src/main.js` | inject `{ layout, renderer, hitTest }`; store `positions` for both |
| `apps/web/src/render.golden.test.mjs` (new) | the golden-canvas snapshot + baseline fixture |
| `requirements/0043-*`, `specs/0043-*`, READMEs | status/index |

## 5. Migration order (each step keeps tests green)

1. Add the **draw-call-log harness** — a pure recording mock `ctx` (~40 lines, no `package.json`,
   no dep; runs under the existing `node --test apps/web/src/*.test.mjs`) — call today's `render.js`
   with it and commit the op-log **baseline** across the four states. Red-team it (swap two tiers →
   red). All 30 existing dependency-free suites still run on a plain checkout (the mock is a local
   test helper, imported by nothing in `src`).
2. Extract `hitTest` (§2.4) — total over `positions` keys; repoint `main.js`. Op-log unchanged;
   add `hitTest` unit tests.
3. Extract `viewModel → Frame` + `canvasRenderer`; have `render.js` **delegate to them internally
   first** (same `render(ctx, …)` signature), so the op-log proves parity **before** touching
   `main.js`.
4. Flip `main.js` to inject `{ layout, renderer, hitTest }`; delete the `render.js` shim. Op-log
   still zero-diff; run the §7 manual smoke pass.

## 6. Non-goals (from R-0043 §4)

No behaviour/pixel change; `forceLayout` + #41 resolution is Phase 2 (#52); a WebGL renderer is
Phase 3; Godot untouched; LOD/#31 is a later view-model transform; no core/Rust/wasm/DTO change; no
plugin registry (injection is a constructor choice).

## 7. Acceptance mapping

| AC | Evidence |
|----|----------|
| AC1 pure `viewModel → Frame`, covers all | §2.1 schema (block-by-block) + Frame snapshot tests |
| AC2 `canvasRenderer` exact | §2.3 z-order replay + the golden snapshot |
| AC3 hit-test pure, off renderer | §2.4 `hitTest(positions,…)`; invariant preserved; unit tests |
| AC4 `main.js` injects | §2.5 wiring |
| AC5 no behaviour change | §3 draw-call-log zero-diff across 4 states + the §7.1 manual smoke pass |
| AC6 additive/web-only | §4 files (apps/web only); diff check; **no `package.json`/npm added** |
| AC7 pure + tested, green | Frame/hitTest unit tests + token→hex 1:1 assert + `node --test` suite green |

### 7.1 Manual browser smoke (the interaction half of AC5)

The op-log covers *drawing*; a short manual pass covers *wiring* after the `main.js` reshuffle
(architect finding #4 is where this bites): click-to-open a plateau, click a bridge, travel-to-topic,
follow a path (next-step ring tracks), mark-mastered (quiz → sign → ✓), and a second tab shows a
presence silhouette. Console clean throughout.

## Changelog

- 2026-07-03 architect design review: **REQUEST-CHANGES → resolved.** (#1/#2, BLOCKING) `apps/web`
  has no npm toolchain and a pixel baseline is font-non-deterministic → replaced the pixel golden
  snapshot with a **dependency-free draw-call-log snapshot** (recording mock `ctx`), which is
  deterministic and catches z-order/alpha/style. (#3) colours stay **1:1 tokens** with a table-equals-
  current-hex assertion, not a widened parity surface. (#4) `hitTest` is **total over `positions`
  keys** (declared micro-deviation that removes a latent NPE), not "keep the no-guard throw." (#5/#6)
  clarified Frame naming vs the RFC, shadow-node fields (only `id,x,y,fill`; never `studying`),
  `pathRoute: null` below 2 steps, and — importantly — the renderer replays **disc/communityRing/✓
  per focus node interleaved** (not global tiers) to preserve overlap pixels; names are the only
  separate pass. Added a §7.1 manual smoke checklist for the interaction half of AC5. Architect
  confirmed the Frame is complete against every `render.js` draw block and the z-order is faithful.
- 2026-07-03 drafted. Frame derived block-by-block from `render.js` on `main`; 4-step migration
  (`render.js` delegates internally before `main.js` flips) that keeps tests green throughout.
