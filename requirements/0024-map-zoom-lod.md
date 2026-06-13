# R-0024 — Map zoom, pan & label level-of-detail

- **Status:** Met
- **Milestone:** POC — Navigation
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-10
- **Depends on:** R-0005 (render/projection), R-0019 (mutable `VIEW` + Travel/`centerOn`), R-0021 (the 630-node imported vault that makes this necessary)
- **Realized by:** SPEC-0024 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

At 630 imported plateaus the map is a smear: discs and labels pile on top of one
another at the fixed camera, so you can't read it — you navigate only by Travel +
open. This requirement makes the map **navigable and legible**: **zoom** (mouse
wheel, anchored at the cursor, + buttons) to spread a dense cluster apart,
**pan** (drag) to roam, and **label level-of-detail** so plateau labels never
overlap — they're drawn in priority order (the focused one, then lit, then the
rest) and any that would collide are dropped, so whatever is visible is readable
at every zoom. Zooming in reveals more labels as space opens. Nothing about the
graph, reach, or sync changes — this is pure camera + presentation.

## 2. Rationale

The camera is already a single mutable `VIEW = {cx, cy, scale}` (R-0019 made it
mutable for Travel) and `draw()` recomputes screen points every frame, so
hit-testing, presence, the focus ring, and Travel all already follow the camera —
zoom/pan need only mutate `VIEW` and the rest works. The legibility win is the
label declutter: today every label is drawn unconditionally (render.js), which is
the pile-up; culling overlapping labels (a standard, pure box-packing step) fixes
it without hiding any disc. This is the smallest change that turns the imported
vault from "a gold smear" into "a map you can actually study," and it is **JS-only,
camera-only** — no GA/CRDT/Rust.

## 3. Acceptance criteria

- **AC1 — Zoom.** The mouse **wheel** zooms the map and **+ / −** buttons zoom by a
  step; a **reset** returns to the default view. Wheel zoom is **anchored at the
  cursor** — the graph point under the pointer stays under it as scale changes.
  Scale is **clamped** to a sensible `[min, max]` so you can't zoom into the void
  or collapse everything to a dot.

- **AC2 — Pan.** **Dragging** the canvas moves the view (the world follows the
  pointer). A drag must **not** open a plateau or sign a traversal — click-to-open
  (R-0023) and traversal (R-0010) fire only on a genuine click (movement below a
  small threshold). Hit-testing stays correct under any pan/zoom.

- **AC3 — Label level-of-detail.** Plateau labels are **decluttered**: drawn in
  priority order — the **focused/travelled-to** plateau first, then **lit**
  plateaus, then the rest — and any label whose box would **overlap** an
  already-placed label is **dropped** for that frame. Discs still all draw (they
  convey the shape/density); only labels are culled. Result: at every zoom the
  visible labels are **non-overlapping**, and zooming in surfaces more of them.

- **AC4 — Camera-only, nothing else moves.** Zoom, pan, and LOD change **only**
  the view origin/scale and which labels render. They never touch reachability,
  the graph, reputation, the signed log, sync, or persistence; Travel, the focus
  ring, presence silhouettes, markers, and bridges all keep following the same
  `VIEW`. Re-opening the app restores the world (the camera itself need not
  persist).

- **AC5 — Pure + tested.** The camera math is **pure** and **unit-tested**:
  `zoomAt(view, factor, sx, sy)` returns a new view that keeps the screen point
  `(sx, sy)` fixed (verified against the real `project`), and `clampScale` bounds
  the scale. The label planner is **pure** and **unit-tested**:
  `planLabels(...) → Set<id>` returns a non-overlapping set that always includes
  the focused/lit-first priorities and is deterministic — no browser needed.

- **AC6 — Additive, JS-only.** No Rust/wasm/CRDT/root-key change; no
  reputation/identity change; existing behaviour (Travel, click-to-open,
  traversal, presence, the read/study view) is unchanged for genuine clicks.
  Existing tests stay green.

- **AC7 — Green + browser-verified.** All suites green; on the imported vault, a
  visitor **zooms in** to spread the cluster, **pans** to roam, sees **readable,
  non-overlapping labels**, and can still **open a plateau** — with no uncaught
  console errors.

## 4. Constraints & non-goals

- **Camera + presentation only.** `VIEW` and label selection are the only state
  touched; discs keep a fixed screen radius (zoom spreads positions, it doesn't
  resize discs — so the hit radius is unchanged).
- **Reuse the camera.** Build on the existing `VIEW` + `centerOn` (wayfinding.js);
  add `zoomAt`/`clampScale` beside `centerOn`.
- **Non-goals:** disc **clustering / aggregation** ("N topics" blobs at low zoom)
  — a heavier level-of-detail step, deferred; a **minimap**; **animated/eased**
  zoom (a snap is fine); **pinch-zoom** gestures (wheel + buttons this phase;
  drag-pan works on touch); changing the projection or the fog math.

## 5. Open questions

- **Zoom control placement.** A small `＋ − ⟳` cluster overlaid on the canvas
  corner vs. toolbar buttons. Leans: a canvas-corner control. Spec decides.
- **Label box estimate.** Approx width from name length × a per-char constant vs.
  measuring on the canvas. Leans: a pure length estimate (keeps `planLabels`
  browser-free + testable). Spec decides.
- **Does Travel also set a readable zoom?** Travel currently re-centres at the
  current scale; optionally it could bump scale so the target is legible. Leans:
  keep Travel center-only (camera changes stay orthogonal). Spec decides.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | Zoom/pan mutate the existing `VIEW`; everything else already follows it | `draw()` recomputes points each frame — hit-test, presence, focus, Travel are camera-correct for free |
| 2026-06-10 | Fix legibility with label overlap-culling, not by hiding discs | Discs convey shape/density; labels are the pile-up; culling is a pure, testable box-pack |
| 2026-06-10 | Discs keep a fixed screen radius; zoom spreads positions | Keeps the hit radius constant (no hit-test change) and makes "zoom in to separate" the natural gesture |

## Changelog

- 2026-06-10 created (Accepted) — the legibility fix for the 630-island imported vault. Pending SPEC-0024 + architect review.
- 2026-06-13 **QA sign-off: PASS — Status → Met.** All four gates green: JS
  `node --test apps/web/src/*.test.mjs` **174 pass / 0 fail** (164 prior + 4
  zoom + 6 labels); `cargo test --workspace` green (116 tests, 0 fail, no
  `crates/` diff); `cargo fmt --all --check` clean; `cargo clippy --workspace
  --all-targets -- -D warnings` clean (exit 0). Every AC has a passing test or
  is covered by the additive-diff/manual-browser evidence — see the QA report
  below for the AC→test map and the adversarial findings (zoom anchor proven
  exact against the real affine `project.js`; click guard correctly gates on
  `moved` alone, reset on `pointerdown`; discs always draw, only `fillText`
  names are culled via `labelled.has`; no graph/reputation/persist mutation in
  any zoom/pan/label path).

## QA — R-0024 Map zoom, pan & label level-of-detail

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) / evidence | Result |
|----|--------------------|--------|
| AC1 — Zoom (wheel cursor-anchored, ＋/− buttons, reset, clamp) | `wayfinding.test.mjs`: "zoomAt keeps the cursor's graph point fixed under the real projection" (factors 1.15, 1/1.15, 2, 0.5 → ≤1e-6), "zoomAt scales by the factor, within clamp", "clampScale bounds both ends; a zoom past the edge leaves the origin unchanged" (k==1 at edge → origin fixed). Buttons route through `zoomAt(VIEW,1.3/0.77,W/2,H/2)`; reset restores the pre-interaction `DEFAULT_VIEW` snapshot (`main.js:808–820`). Wheel `preventDefault` + `{passive:false}`. | PASS |
| AC2 — Pan + click/traversal guard | `main.js`: click handler first line `if (moved) return;` (`:823`), gated on `moved` ALONE; `moved=false` on `pointerdown` (`:766`), set true past `DRAG_THRESHOLD=4` (`:778`), persists through `pointerup`. Hit-test reuses the per-`draw` `points` map + fixed `RADIUS` (`:837–846`) → correct under any pan/zoom (discs not resized). Browser: panned✓, suppressedAfterDrag✓, reset+click opened "Arithmetic"✓. | PASS |
| AC3 — Label level-of-detail | `labels.test.mjs` (6): far-apart both labelled; overlapping lit beats fogged; focused beats overlapping lit; missing point skipped (not thrown); deterministic; `labelBox` centered + min width. `planLabels` priority focused(0)→lit(1)→rest(2), stable by input index, greedy overlap-cull. `render.js`: every disc `ctx.arc` unconditional (`:61`), only `fillText(p.name…)` gated on `labelled.has(p.id)` (`:70–74`) — canvas text, no innerHTML. | PASS |
| AC4 — Camera-only, nothing else moves | Grep of the R-0024 nav block + `labels.js` + `render.js` + `wayfinding.js` zoom additions: NO `doc.`/`vote`/`add_`/`sign_`/`pump`/`persist`/`recompute`/`reputation`/`ingest`/`log.` — camera + label-selection only. Travel/focus-ring/presence/markers/bridges all read the same `VIEW`. Browser: HUD reach held 583/639 across all zoom/pan. | PASS |
| AC5 — Pure + tested | `zoomAt`/`clampScale` pure in `wayfinding.js`, tested vs the REAL `project` (which is exactly the affine `x=cx+scale·(e1−½e2)` the derivation assumes → anchor exact, not a test fluke). `planLabels`/`labelBox` pure in `labels.js`, 6 unit tests, no browser. | PASS |
| AC6 — Additive, JS-only | `git diff --stat`: only `apps/web/*` (7 files) + the R-0024 requirement & spec docs; zero `crates/`/wasm/CRDT/identity change. `cargo test --workspace` unchanged-green. Existing JS behaviour intact (164 prior tests still pass). | PASS |
| AC7 — Green + browser-verified | All four gates green (below). Manual browser evidence recorded in SPEC-0024 §6: zoom spreads the cluster + declutters labels, pan roams, reset restores, genuine click still opens, console error-clean. Accepted as the manual portion. | PASS |

### Suites

- **test (JS):** `node --test apps/web/src/*.test.mjs` — **174 pass / 0 fail** (zoom +4, labels +6). PASS
- **test (Rust):** `cargo test --workspace` — 116 pass / 0 fail across all crates; no `crates/` diff. PASS
- **e2e / browser:** manual on the 630-node imported vault (SPEC-0024 §6) — zoom/pan/reset/genuine-click-opens, console clean. PASS (manual)
- **lint:** `cargo clippy --workspace --all-targets -- -D warnings` — exit 0, clean. PASS
- **format:** `cargo fmt --all --check` — clean. PASS

### Gaps / failures

None. Every acceptance criterion maps to at least one passing test (AC1/AC3/AC5
unit-tested; AC2/AC4 verified by code inspection + grep + browser evidence; AC6
by diff scope; AC7 by gates + manual browser). The cursor-anchor invariant was
re-derived and confirmed exact against the real `project.js`; the click guard,
hit-test, disc-vs-label gating, and camera-only constraint all hold under
adversarial reading.
