# R-0022 — Physicist lens: Physics as a first-class faced domain

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-10
- **Depends on:** R-0006/R-0009 (lens presets + authoring), R-0010 (trailheads + earned reach), R-0021 (the importer tags `PHYSICS_DOMAIN` — this makes it *faceable*)
- **Realized by:** SPEC-0022 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

R-0021 imports the owner's vault and tags physics-leaning notes with a
**Physics domain** (`33333333-…`), but no career lens *faces* it and there is no
Physics **trailhead** — so imported physics notes start fully fogged with no
on-ramp. This requirement makes Physics first-class: a **"The Physicist"** lens
card (oriented to the empirical `e2` axis), a **Physics entry** in the
author-your-own domains, a seeded **Physics trailhead plateau** that is always
navigable for a physics-facing lens, and a seed **bridge** tying it into the
existing world. A visitor who picks The Physicist wakes facing the physical
axis, signs traversals from the trailhead, and earns reach over the e2-leaning
notes the importer placed — the imported physics curriculum becomes explorable.

## 2. Rationale

The fog core is already domain-agnostic (reach is a projection against
position), so nothing in Rust changes — Physics needs only the *orientation*
plumbing the other two domains have: a `DOMAINS` row (which automatically adds
Physics to the author-form sliders and the Draft-a-plateau domain select), an
archetype card, a trailhead (the orientation-gated, always-navigable first
step — without one, a Physicist has nowhere to sign a first traversal), and a
`TRAILHEAD_OF` entry. This is the smallest change that turns R-0021's tag into
a usable lens, and it directly serves the owner's stated goal ("I am studying
physics… choose the right path").

## 3. Acceptance criteria

- **AC1 — Physics is a faced domain.** `persona.js` exports `PHYSICS_DOMAIN`
  with **exactly the importer's UUID** (`33333333-3333-3333-3333-333333333333`),
  and `DOMAINS` gains `{ Physics, canonical e2 }` — so the author-your-own form
  offers Physics sliders and the Draft-a-plateau form offers the Physics domain,
  with no further wiring.

- **AC2 — The Physicist archetype.** A fourth preset lens card, oriented
  `{ domain: PHYSICS_DOMAIN, dir: e2 }`, with name/label/blurb like its peers.
  `seedReputation(physicist)` puts the seed magnitude on the **e2 blade** of the
  Physics domain only (float-exact, deterministic, like the Geometer/Composer).

- **AC3 — A Physics trailhead.** A seeded plateau on the e2 axis (on-axis coord
  ≥ 0.94 so the SEED=0.16 orientation clears the 0.15 threshold), with a
  **fixed id** (deterministic seed — both tabs converge), domain
  `PHYSICS_DOMAIN`, registered in `TRAILHEAD_OF` — so a physics-facing lens
  always has a navigable first step, exactly like Arithmetic/Rhythm. A seed
  **bridge** connects it to the existing world (Calculus ↔ the new trailhead).

- **AC4 — Earned physics reach works end-to-end.** Picking The Physicist lights
  the Physics trailhead (orientation-gated); clicking it signs traversals that
  grow the **Physics domain bucket**; the recomputed reputation then lights
  e2-leaning plateaus — including imported vault notes — while the Geometer's
  math-side reach is unchanged. Reach stays earned (reset-history re-fogs).

- **AC5 — Pure + tested.** New/extended unit tests cover: the Physicist seeds
  e2 in the Physics domain only; `PHYSICS_DOMAIN` equals the importer's UUID
  string; `DOMAINS` includes Physics with canonical e2; existing tests
  (`ARCHETYPES.length >= 3`, `DOMAINS.length >= 2`) stay green unmodified.

- **AC6 — Additive, JS-only.** No Rust/wasm change, no CRDT/root-key change, no
  reputation-model change (the persona still sets *direction only*). Existing
  tests green.

- **AC7 — Green + browser-verified.** All suites green; in the browser, a fresh
  visitor picks **The Physicist**, sees the Physics trailhead lit, traverses it,
  and watches e2-side reach grow over the imported vault — no console errors.

## 4. Constraints & non-goals

- **Orientation only.** The Physicist is a direction, never a magnitude — same
  invariant as every lens (CLAUDE.md §4).
- **Non-goals:** map zoom/level-of-detail (R-0023 candidate); AI re-classification
  of imported note domains/positions (the "AI pass", separate); re-importing or
  changing the importer; a 4th GA axis (Physics rides the existing e2).

## 5. Open questions

- **Trailhead name.** "Motion" (clean, e2-flavored, no collision with the
  imported "Mechanics" note) vs "Mechanics". Leans Motion; spec decides.
- **Seed bridge concept.** "equations of motion" vs "rates of change". Cosmetic;
  spec decides.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | Physics = the existing e2 axis + the importer's domain UUID; no Rust change | The fog core is domain-agnostic; only orientation plumbing is missing |
| 2026-06-10 | Ship a seeded trailhead + TRAILHEAD_OF entry | Without an always-navigable first step a Physicist can never sign a first traversal |
| 2026-06-10 | Trailhead named distinctly from imported note names | Avoids Travel-list ambiguity with the vault's own "Mecánica…" notes |

## Changelog

- 2026-06-10 created (Accepted) — successor to R-0021's deferred "Physics as a faced domain". Pending SPEC-0022 + architect review.
- 2026-06-10 **QA sign-off — PASS → Status: Met.** All seven acceptance criteria
  covered by passing tests; all gates green. Suites: `node --test
  apps/web/src/*.test.mjs` = 156 pass / 0 fail (147 prior + 9 new: 3 in
  persona.test.mjs, 6 in the new seeds.test.mjs); `cargo test --workspace` =
  117 pass / 0 fail (incl. mp-host import = 9, with the new
  `domain_ids_match_the_web_app_literals` pin); `cargo fmt --all --check` clean;
  `cargo clippy --workspace --all-targets -- -D warnings` clean. No wasm rebuild
  needed — zero production Rust/wasm change (`git diff crates/` =
  tests/import.rs +18 lines, test-only). Adversarial checks: seeds.js rows
  verified **byte-identical** to the pre-extraction main.js tables by mechanical
  diff — b1–b9 intact, incl. the `…b4` Geometry→Calculus "limits" bridge the
  architect's collision finding protected; `…d1`/`…ba` collision-free across all
  seed ids (mechanical uniqueness test + repo-wide grep; the only other `…d1`
  literal is a test-local resource-id fixture in vote.test.mjs — different
  keyspace, never seeded); the Rust pin imports the real
  `mp_host::import::PHYSICS_DOMAIN` const (non-vacuous); AC1's auto-wiring
  confirmed in main.js (author sliders `DOMAINS.map`, draft-form select loops
  `DOMAINS`, `labelForDomain` resolves Physics); trailhead lighting is the
  `TRAILHEAD_OF` orientation gate layered over earned reach, not
  `seedReputation`. AC4/AC7 browser half accepted as recorded manual evidence:
  fresh origin → 4 lens cards → The Physicist → HUD "1/9 lit · 10 bridges"
  (Motion trailhead only) → Travel+click Motion opens its read view + signs a
  traversal → 7/9 → import igoose-world.bin (639 plateaus / 633 bridges) → 3
  Motion traversals total → **120/639 lit** (the e2-leaning slice; Geometer
  baseline 582 — reach is domain-scoped) → console error-clean. The 7/9 figure
  reproduces arithmetically (Arithmetic/Rhythm project ≈ 0.102 < 0.15; the other
  seven seeds clear it) — the positional bleed SPEC-0022 §2.2 documents, not a
  defect; the Londoño-note projection ≈ 1.66 > 0.15 also checks out. Re-fog:
  earned reach derives solely from the unchanged `log.reputation()` recompute
  path; events.test.mjs "clear() empties the log back to reaching nothing"
  covers reset, and the fresh-origin 1/9 state demonstrates empty-log ⇒
  trailhead-only for the new lens. Owner holds final sign-off.
