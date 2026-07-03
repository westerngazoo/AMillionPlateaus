# R-0043 — View pipeline, Phase 1: extract the injectable render seam (web)

- **Status:** Accepted
- **Milestone:** Infra / DX
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-03
- **Depends on:** **RFC-0003** (the `place → layout → view-model → renderer` design + the
  architect-reviewed Phase 1); R-0033 (progress palette), R-0024 (label LOD), R-0031 (community
  ring), R-0030 (mastery ✓), R-0016 (presence), R-0039 (path overlays), PR #42 (focus/context)

- **Realized by:** SPEC-0043 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Turn the web client's single hard-wired `render(ctx, …)` into the **injectable seam** RFC-0003
defines, **without changing a single pixel or behaviour**. Extract a pure
`viewModel(graph, positions, state) → Frame` (all styling/emphasis/label decisions, no canvas),
a `canvasRenderer(canvas)` that `draw`s a `Frame` exactly as today, and keep hit-testing a
**pure function over the placement map** (`hitTest(positions, x, y)` — *not* on the renderer);
`main.js` injects `{ layout, renderer, hitTest }`. This is the presentation-only, additive
refactor that makes a second renderer (Phase 3) and the #41 force-layout compose (Phase 2) drop
in — and it is where semantic zoom/LOD (#31) will later live.

## 2. Rationale

Two renderers already coexist across the core→client DTO seam (web canvas, Godot 3D). What is
missing is the seam *within* the web client: layout, emphasis, drawing, and hit-testing are
entangled in `render.js`, so a new renderer or layout copies orchestration, and PR #41 vs the
merged #42 collided because both rewrote `render.js` in place. Naming the pipeline and injecting
its joints (per RFC-0003) resolves that structurally. Phase 1 is deliberately **behaviour-
preserving** so it is safe to land and easy to review: same pixels, now behind a contract.

## 3. Acceptance criteria

- **AC1 — Pure `viewModel → Frame`.** A pure `viewModel(graph, positions, state) → Frame`
  (no canvas, no DOM) is extracted from `render.js`. The `Frame` **covers every element the
  current renderer draws** (verified block-by-block): node discs with per-tier radius/alpha,
  progress fill + progress ring, the **community bedrock ring co-occurring with the mastered
  ring** (both representable at once), the mastered ✓ glyph, edges (covered + caption), markers
  (stacking index + crystallized/floating state + caption), peers (fan index + deterministic
  hue + label), and overlays (path route, focus ring, next-step ring). It is unit- + snapshot-
  tested.

- **AC2 — `canvasRenderer` reproduces today exactly.** A `canvasRenderer(canvas)` with
  `draw(frame)` renders the `Frame` with the **same z-order** the current code encodes — path
  route (under discs) → shadow discs (α 0.4) → focus discs (+ community/✓ decorations) → **names
  last** (so text is never occluded) → overlays/markers/peers — and the **same caption declutter
  chaining** (`planBoxes` using kept name-boxes as obstacles).

- **AC3 — Hit-testing stays pure (not on the renderer).** `pickBridge` + the node-pick loop
  become a `hitTest(positions, x, y) → Id | null` **pure function over the placement map** — it
  is NOT moved onto `canvasRenderer` (avoids retained per-frame state). Behaviour is byte-identical
  to today, including the invariant that every plateau is present in the placement map before a
  click dereferences it (no NPE on a plateau added between draw and click).

- **AC4 — `main.js` injects the seam.** The render loop becomes
  `renderer.draw(viewModel(graph, layout(place(graph, view)), state))` with `hitTest(positions, …)`
  on pointer; `main.js` holds `{ layout: spreadLayout, renderer: canvasRenderer, hitTest }`.
  `layout` is `spreadNodes` unchanged (identity to today).

- **AC5 — No behaviour change (the gate).** A **golden canvas snapshot** (offscreen-canvas
  pixel/hash compare on the seed world across representative states — no persona, a lens, a
  followed path, a mastered node) is **unchanged** vs. pre-refactor `main`. A `Frame` snapshot
  alone does not satisfy this. Every existing browser flow (click-to-open, travel, follow,
  mark-mastered, presence) works identically; console clean.

- **AC6 — Additive, web-only, safe.** `apps/web/src` only — **no core/Rust/wasm/DTO/Godot
  change**, garust untouched. No new runtime dependency (a dev-only snapshot harness is fine).

- **AC7 — Pure + tested, green.** `viewModel`/`Frame` and `hitTest` are pure and unit-tested;
  `canvasRenderer` draws a `Frame` (covered by the golden snapshot). All existing suites stay
  green (`node --test apps/web/src/*.test.mjs`).

## 4. Constraints & non-goals

- **Behaviour-preserving only.** Phase 1 changes *structure*, never *output*. Any pixel change
  is a bug, not a feature.
- **Hit-testing is polymorphic over placement geometry, not owned by the renderer** (RFC-0003
  §4) — the 2D/orthographic case shares one screen-space `hitTest`; a future 3D renderer supplies
  its own raycast. This requirement only ships the 2D one.
- **`layout` is web-only.** Godot mirrors `place`/`label-plan`/`draw`, not `layout`; no Godot
  change here.
- **Non-goals (later phases / RFC-0003):** the `forceLayout` strategy + #41 resolution (Phase 2);
  a WebGL/Three renderer (Phase 3); semantic zoom/LOD (#31/R-0040 — a *view-model* transform that
  will build on this seam); any renderer plugin registry (injection is a constructor choice); no
  change to the core→client DTO seam (already DI'd).

## 5. Open questions

- **Snapshot harness.** Offscreen-canvas `toDataURL`/hash under `node --test` (with a canvas
  shim) vs. a Playwright screenshot in CI — SPEC-0043 picks the lightest that actually catches a
  z-order/alpha regression.
- **`Frame` shape churn.** Fix the schema in SPEC-0043 from the block-by-block `render.js`
  cross-check (RFC-0003 §4) so implementation doesn't discover an un-modeled element mid-extraction.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-03 | Adopt RFC-0003's Phase 1 as a tracked requirement | The RFC's decision request; unblocks #41 compose (P2) + a future renderer (P3) |
| 2026-07-03 | Hit-testing stays a pure function over placements, not on the renderer | The web already does it right (`pickBridge` over `points`); moving it onto a stateful renderer regresses composability (architect finding #3) |
| 2026-07-03 | Golden **canvas** snapshot is the acceptance gate, not just a Frame snapshot | A Frame snapshot proves the model is stable, not that the pixels are unchanged (architect finding #4) |

## Changelog

- 2026-07-03 created (Accepted) — the RFC-0003 Phase-1 extraction: pure `viewModel → Frame` +
  `canvasRenderer(draw)` + pure `hitTest(positions,…)`, injected in `main.js`, behaviour-preserving
  (golden-canvas-snapshot gate), web-only/additive. Pending SPEC-0043 + architect review.
