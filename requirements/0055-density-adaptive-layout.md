# R-0055 — Density-adaptive decluttering: dense imported graphs stay readable

- **Status:** Accepted
- **Milestone:** POC — Navigation
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-13
- **Depends on:** R-0024 (map zoom/pan + label LOD — the decluttering this extends), RFC-0003 /
  R-0043 (the `forceLayout` + view-pipeline this feeds), R-0021 (Obsidian importer — the source of
  dense graphs).
- **Realized by:** direct implementation (one pure function `adaptiveMinDist` in `layout.js` + one
  call-site in `main.js`; no new architecture).
- **Source:** salvaged from the stale draft PR #41 ("Obsidian focus lens + force layout + 3D
  separation for dense graphs"). Only the genuinely-new, safe idea is kept — see the decision log.

## 1. Statement

The clearance the layout targets between plateau discs **scales with graph size**, so a dense
import — an Obsidian vault of 30–100 topics whose GA coordinates cluster tightly — is spread into
something readable instead of collapsing into an overlapping blob. The shipped ~50-topic seed world
is **unchanged**: the adaptive spread only engages past a node-count knee.

## 2. Rationale

`forceLayout` (RFC-0003) already declutters well at the shipped world's scale, but it targets a
**fixed** minimum separation (`DEFAULT_MIN_DIST = 56`). When a learner imports a real vault, dozens
of topics can land on nearly-identical GA coordinates; a fixed clearance can't open them up and the
map becomes an unreadable pile. PR #41 tried to fix this by replacing `forceLayout` wholesale with
an Obsidian-style force layout — but that reintroduced the uncapped-repulsion explosion bug our
`forceLayout` was specifically hardened against, and duplicated the focus/context tiering the view
pipeline already does. The one durable, safe idea from that work is **density-adaptive spacing**:
grow the target with √(node count). That composes with the existing hardened `forceLayout` in a
single line and needs nothing else.

## 3. Acceptance criteria

- **AC1 — Behaviour-preserving below the knee.** `adaptiveMinDist(n) === DEFAULT_MIN_DIST` for every
  `n` at or under the knee (60), including degenerate `0`/`1`. The shipped ~50-topic world renders
  byte-identically to before this change.
- **AC2 — Grows with density, monotonically, clamped.** Past the knee the target increases with node
  count, is non-decreasing, is continuous at the knee (no visual jump when one import crosses it),
  and is clamped to a maximum (120) so no import can fling discs off-canvas.
- **AC3 — Dense graphs actually spread.** Fed a dense cluster, `forceLayout` with the adaptive target
  pushes nodes further apart than with the fixed default. A dense-vault fixture
  (`fixtures/obsidian-dense/`) exists to exercise this by hand through the Obsidian importer.
- **AC4 — Wired at the one render seam.** The live placement path (`main.js` `draw()`:
  `forceLayout(raw, { bridges })`) passes `minDist: adaptiveMinDist(raw.size)`. `forceLayout` and
  `spreadNodes` are otherwise unchanged; the hardened-against-explosion `forceLayout` is kept.
- **AC5 — Pure + additive + tested.** `adaptiveMinDist` is a pure, deterministic export in
  `layout.js` with `node --test` unit tests (behaviour-preservation, monotonicity, clamp, knee
  continuity, fractional floor, and a dense-spread integration test). `apps/web/src` + a fixture
  only; no core/Rust/wasm change; no new runtime dependency.

## 4. Constraints & non-goals

- **Do not replace `forceLayout`.** Its capped Coulomb term + per-step displacement clamp are the
  stability guarantee (a fresh 50-topic world once rendered blank with discs at ±3000px before that
  fix). This requirement only changes the `minDist` it is handed.
- **Non-goals (explicitly dropped from PR #41):** an alternate Obsidian-style force layout;
  compact/study/overview density presets + a UI toggle (a reasonable follow-up, but it adds UI
  surface and isn't needed for readability); the focus-lens node tiering (the view pipeline already
  does focus/context); the Godot 3D track (R-0025).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-13 | Salvage only `adaptiveMinDist`, rebuilt on the existing `forceLayout` | PR #41's own `forceLayout` was uncapped — the explosion bug `main` already fixed; its lens tiering duplicates the view pipeline. Adaptive spacing is the one safe, new idea. |
| 2026-07-13 | Knee at 60 nodes; below it returns exactly `DEFAULT_MIN_DIST` | Makes the change provably behaviour-preserving for the shipped ~50-node world — spread engages only where crowding is the real problem. |
| 2026-07-13 | Clamp the target at 120 | Bounds the input to `forceLayout` so even a thousand-node vault can't push discs off-canvas. |
| 2026-07-13 | Keep the `obsidian-dense` fixture from PR #41 | It's the authored dense corpus that demonstrates the feature through the R-0021 importer; inert data, low risk. |

## Changelog

- 2026-07-13 created (Accepted) + implemented — density-adaptive `minDist` wired into the render
  placement; behaviour-preserving under 60 nodes, spreads dense imports past it. Salvaged from the
  stale PR #41; its unsafe `forceLayout` replacement and duplicate lens tiering were deliberately
  left behind.
