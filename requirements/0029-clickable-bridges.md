# R-0029 — Clickable bridges: open a connection

- **Status:** Met (2026-06-15)
- **Milestone:** POC — Navigation
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** R-0005 (render/projection + bridges), R-0013 (bridge authoring), R-0024 (camera + the per-frame `points` map used for hit-testing), R-0019 (open-a-plateau / travel), R-0028 (cross-cutting resources shown on a connection)
- **Realized by:** SPEC-0029
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Bridges name **why two topics connect** — "equations of motion" links Calculus
and Motion — but today a bridge is only a labelled line you **cannot click**, so
there is nowhere to "go check equations of motion." This requirement makes a
bridge **clickable**: clicking a bridge's line/label opens a small **connection
view** showing the **concept**, the **two topics it joins** (each a link that
opens that topic's Study view), and the **cross-cutting resources** that span
both ends (the books threaded across both topics, R-0028). The plateau click
(open a topic) is unchanged; bridges become navigable signposts between islands.

## 2. Rationale

Reachability is positional and bridges are decorative (R-0005), so a concept
like "equations of motion" has no home — it is neither island. Making the bridge
itself a destination gives cross-cutting concepts a place to live and directly
answers "where do I click for equations of motion?": the connection between
Calculus and Motion. It composes with R-0028 — a connection view is exactly
where a book spanning both ends belongs. It is **camera + presentation only**
(hit-test the segment between two already-projected plateau points, reuse the
detail drawer), **JS-only**, no GA/CRDT/Rust change.

## 3. Acceptance criteria

- **AC1 — Bridges are clickable.** Clicking on a bridge's line (within a small
  pixel tolerance) — when it is not a closer hit to a plateau disc — opens a
  **connection view**. Clicking empty space still does nothing; clicking a disc
  still opens that plateau (plateau hit-test wins ties / takes precedence when
  the cursor is within a disc).

- **AC2 — Connection view content.** The view shows the bridge **concept** as its
  title and the **two endpoint topics** by name, each a control that **opens that
  topic's** Study view (reusing the open-plateau path). It is clearly a
  *connection*, not a topic (no body/study-actions/add-resource form — those are
  plateau-only).

- **AC3 — Cross-cutting resources on the thread.** The connection view lists the
  resources that **span both endpoints** — i.e. a resource whose URL appears on
  **both** the `from` and `to` plateau (R-0028 threading) — as links (via
  `safeHref`). If none, it says so. This is the natural home for a book covering
  both topics.

- **AC4 — Hit-test is correct under pan/zoom.** The bridge hit-test uses the same
  per-frame projected `points` as the plateau hit-test (R-0024), so it stays
  correct at any camera. It only considers bridges whose **both** endpoints are
  present; the plateau disc hit-test is evaluated **first** and wins when the
  cursor is inside a disc (so endpoints stay openable).

- **AC5 — Pure + tested.** The geometry is a **pure** function —
  `pointToSegmentDistance(px,py, ax,ay, bx,by) → number` and a
  `pickBridge({bridges, points, mx, my, tol}) → bridgeId|null` — **unit-tested**
  (on-segment ≈ 0, perpendicular distance, endpoints, beyond-segment clamps to
  the endpoint, tolerance boundary, missing endpoint skipped, deterministic). No
  DOM/GA.

- **AC6 — Additive, JS-only, safe.** No Rust/wasm/CRDT/GA change; the plateau
  open/travel/traversal/presence paths are unchanged; opening a connection is
  **read-only** (no traversal signed, no graph edit — a bridge is not a plateau
  you "reach"). Connection text renders via `textContent`/`safeHref` (no
  injection). Existing suites stay green.

- **AC7 — Green + browser-verified.** All suites green; in the browser, clicking
  the **"equations of motion"** line opens a connection view naming **Calculus**
  and **Motion** (each opens its topic) and listing the cross-cutting book on
  that thread — with no uncaught console errors; clicking a disc still opens the
  plateau.

## 4. Constraints & non-goals

- **Camera + presentation only.** Reuse the projected `points` and the detail
  drawer; add a bridge hit-test + a connection render path. No new geometry/GA.
- **Read-only.** Opening a connection signs nothing and edits nothing (unlike a
  plateau traversal); bridges are not reachable destinations.
- **Non-goals:** authoring/editing bridges from the connection view (R-0013
  stays the author path); routing/pathfinding along bridges; making reachability
  edge-based; multi-hop "concept paths"; styling beyond a hover affordance.

## 5. Open questions

- **Pixel tolerance + hover cue.** Lean: ~6px tolerance; a cursor/hover hint that
  a line is clickable. Spec fixes the value.
- **Drawer reuse vs. a distinct panel.** Lean: reuse `#plateau-detail` with a
  bridge-mode render (hide body/study/add), so there's one drawer. Spec decides.
- **Precedence.** Lean: plateau disc hit wins when the cursor is within a disc;
  otherwise test bridges. Spec confirms.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Make bridges clickable → a read-only "connection view" | Gives cross-cutting concepts ("equations of motion") a home; answers "where do I click"; composes with R-0028 |
| 2026-06-15 | Hit-test reuses the per-frame projected `points` (R-0024) | Correct under any pan/zoom for free; no new camera state |
| 2026-06-15 | Plateau disc hit-test takes precedence; opening a connection signs nothing | Keeps topics openable; a bridge is a relationship, not a reachable destination (no traversal) |

## Changelog

- 2026-06-15 created (Accepted) — make bridges navigable so "equations of motion"
  (and every connection) opens a view of the two topics it joins + the books that
  span them (R-0028). Pending SPEC-0029 + architect review.
- 2026-06-15 QA sign-off (PASS) — all 7 acceptance criteria met; **Status → Met**.
  See sign-off below.

## QA sign-off — 2026-06-15

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) / evidence | Result |
|----|--------------------|--------|
| AC1 — bridges clickable; disc precedence; empty space inert | `main.js` click handler: lit-disc hit returns first (`openPlateau`); else `overAnyDisc` guard (within `RADIUS` of ANY plateau, lit or fogged) returns before bridges; only then `pickBridge({…,tol:6})` → `openBridge`. `pickBridge` unit tests (`wayfinding.test.mjs`). Browser: Calculus→Motion line (t=0.4) opened "equations of motion"; disc click opened its plateau. | PASS |
| AC2 — concept title + both topics as Study links; no body/study/add | `openBridge` sets `detail.dataset.mode="bridge"`, title = `b.concept`, "Connects:" with two `bridge-topic` buttons → `openPlateau`. CSS (`index.html`) hides `#detail-body`/`#detail-study`/`#detail-reply`/`#detail-resources`/`#detail-add-form` in bridge mode, so the study-action buttons (in `#detail-study`) are `display:none` and cannot fire. `openPlateau` sets `data-mode="plateau"` first → restores plateau view. Browser: clicking "Calculus" flipped to plateau mode + opened Calculus. | PASS |
| AC3 — resources spanning BOTH endpoints, else "none" | `bridgeResources({resources,fromId,toId})` (pure, `study.js`): URL on both endpoints, sorted title→uri. Tests: spans-both kept, one-side excluded, unsafe-url ignored (`study.test.mjs`); none-span → `[]`. `openBridge` renders links via `safeHref` or "No resources span both topics yet." Seed: Feynman book on Calculus AND Motion. | PASS |
| AC4 — hit-test on per-frame `points`; both endpoints present; disc first | `pickBridge` consumes the same per-frame `points` map; skips bridges with a missing endpoint (`if (!a||!c) continue`). Disc hit-test runs first; `overAnyDisc` precedence. Tests: missing-endpoint skipped, inclusive boundary, order-independent tie. | PASS |
| AC5 — pure + unit-tested | `pointToSegmentDistance`, `pickBridge` (`wayfinding.js`), `bridgeResources` (`study.js`) — no DOM/GA. Tests: on-segment≈0, perpendicular, zero-length→dist to A, beyond-end clamp, inclusive `d===tol` selects, `d` just over → null, missing endpoint, same-distance id tiebreak (order-independent). | PASS |
| AC6 — additive JS-only; read-only; safe; suites green | `git diff --stat -- crates/` empty; cargo test/fmt/clippy green & unchanged. `openBridge` sets NO `myPlateau`, calls NO `announcePresence`, signs NO traversal (vs plateau branch `main.js:860–867`). All bridge text via `textContent`/`createTextNode`/`safeHref` — zero `innerHTML` in `openBridge`. | PASS |
| AC7 — green + browser-verified | All suites green (194 JS / Rust workspace). Seed has bridge `ba` concept "equations of motion" Calculus↔Motion + Feynman book on both. Browser: line opens connection naming Calculus & Motion (each opens its topic) + the cross-cutting book; disc click opens the plateau; console clean. | PASS |

### Suites

- **JS unit/e2e** (`node --test apps/web/src/*.test.mjs`): **194 pass / 0 fail** (matches expected 194).
- **cargo test --workspace**: green; `git diff --stat -- crates/` empty (Rust unchanged).
- **cargo fmt --all --check**: clean (exit 0).
- **cargo clippy --workspace --all-targets -- -D warnings**: clean (exit 0, 0 warnings).

### Gaps / failures

None blocking. Notes:
- The default working-tree diff also touches `apps/web/src/seeds.js` (additive — the
  R-0028/R-0029 cross-cutting Feynman book fixture, JS-only) and `Cargo.lock` (a
  pre-existing `garust-physics` dependency bookkeeping entry from R-0022, **no
  `crates/` source change**). Neither affects R-0029 product logic; `crates/`
  source diff is empty as AC6 requires. Flagged for the owner's awareness only.
- AC2's "hidden study action can't fire" is enforced by CSS (`#detail-study`
  `display:none` in bridge mode) — the `studyAction` early-return only guards
  `!studyPlateau || !activePersona`, and `openBridge` does not clear `studyPlateau`.
  The CSS guard is sufficient (a `display:none` button receives no clicks); noted
  for accuracy.
