# SPEC-0022 — Physicist lens: Physics as a first-class faced domain

- **Status:** Implemented
- **Realizes:** R-0022
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-10
- **Depends on:** SPEC-0006/0009 (persona presets + authoring), SPEC-0010 (trailheads), SPEC-0021 (the Physics domain id)
- **Module(s):** `apps/web/src/persona.js` + `persona.test.mjs` (extend), `apps/web/src/seeds.js` + `seeds.test.mjs` (NEW — seed tables extracted from main.js so their invariants are node-testable), `apps/web/src/main.js` (import the seed tables; trailhead entry), `crates/mp-host/tests/import.rs` (+1 **test-only** assertion pinning the domain-UUID literal). **No production Rust change, no new deps, no index.html change.**

## 1. Motivation

R-0022: turn the importer's `PHYSICS_DOMAIN` tag into a faceable lens. Three
touch points, all JS: the domain row, the archetype, the seeded trailhead.

## 2. Design

### 2.1 `persona.js`

```js
export const PHYSICS_DOMAIN = "33333333-3333-3333-3333-333333333333"; // == mp-host import::PHYSICS_DOMAIN
```

- `DOMAINS` gains `{ id: PHYSICS_DOMAIN, label: "Physics", canonical: { e1: 0, e2: 1, e3: 0 } }`.
  This single row automatically: (a) adds Physics sliders to the author-your-own
  form, (b) adds Physics to the Draft-a-plateau domain select, (c) makes
  `labelForDomain` resolve imported physics notes' domain to "Physics" anywhere
  it's shown.
- `ARCHETYPES` gains:
  ```js
  {
    id: "physicist",
    name: "The Physicist",
    domainLabel: "Physics",
    blurb: "Wakes facing Physics — motion in reach, all else in fog.",
    orient: [{ domain: PHYSICS_DOMAIN, dir: { e1: 0, e2: 1, e3: 0 } }],
  }
  ```
  Single-axis direction keeps `seedReputation` float-exact (SEED lands wholly on
  the e2 blade), matching the Geometer/Composer pattern.

### 2.2 `seeds.js` (NEW) + `main.js` — seed trailhead + bridge

**Extract the seed tables** (`SEED_PLATEAUS`, `SEED_BRIDGES`, the `P` name→id
map) from main.js into a pure `apps/web/src/seeds.js`, imported back by main.js
— byte-identical data, no logic change. Rationale (architect, forward note):
this is the third hand-maintained fixed-id namespace; extraction makes the id
invariants **node-testable**, and `seeds.test.mjs` asserts uniqueness
mechanically — the class of bug that nearly shipped here (finding 1).

- `SEED_PLATEAUS` gains one row — fixed id **`…d1`** (Physics gets its OWN
  cluster prefix; `a*` = Mathematics, `c*` = Music — architect finding 4):
  ```js
  { id: "00000000-0000-0000-0000-0000000000d1", name: "Motion", domain: PHYSICS_DOMAIN, e1: 0.05, e2: 1.0, e3: 0.05 },
  ```
  **Lighting mechanism (architect finding 3):** with an empty event log the
  trailhead is lit by the **`TRAILHEAD_OF` orientation gate** (SPEC-0010) —
  NOT by `seedReputation`, which Phase 8 decoupled from live reach. Do not
  rewire `seedReputation` into the fog path. `e2 = 1.0` is still required: it
  keeps the canonical seed-mapping margin invariant documented at
  persona.js:27–31 true for the new lens (0.16·1.0 > 0.15), exactly like
  Arithmetic/Rhythm. "Motion" avoids name-collision with the vault's own
  "Mecánica…" notes in the Travel list.
- `SEED_BRIDGES` gains one row — fixed id **`…ba`** (architect finding 1:
  **`b1`–`b9` are already taken**; `…b4` is the Geometry→Calculus "limits"
  bridge, and the id-keyed upsert would have silently replaced it):
  ```js
  { id: "00000000-0000-0000-0000-0000000000ba", from: P.Calculus, to: P.Motion, concept: "equations of motion" },
  ```
  Ties the physics trailhead into the existing world (Calculus is the
  transversal hub).
- `TRAILHEAD_OF` (stays in main.js) gains `[PHYSICS_DOMAIN]: P.Motion`.
- `import { PHYSICS_DOMAIN }` joins the existing persona.js import. Everything
  else (DOMAIN_OF, the seeding loop, the creator cards, the draft form's domain
  select) picks the new rows up from the existing data-driven loops — no logic
  change.
- **AC7 expectation note (architect):** the fog scorer maxes projections across
  all buckets with no domain filter, so the Physicist's first traversal
  (rep ≈ e2) also lights e2-tinged plateaus of other clusters — Calculus
  (0.345), Counterpoint (0.345), Algebra/Melody (0.245)… This positional bleed
  is pre-existing engine semantics (a Geometer's first traversal already lights
  Counterpoint), not a defect — QA must not misread it.

### 2.3 Tests — `persona.test.mjs` (extend) + `seeds.test.mjs` (new) + one Rust line

- `physicist seeds e2 in the Physics domain only` — mirrors the geometer test:
  `seedReputation(byId("physicist"))` has SEED on blade index 2 of
  `PHYSICS_DOMAIN`, zeros elsewhere, and no other domain key.
- `PHYSICS_DOMAIN matches the importer's domain id` — the JS side asserts the
  literal `"33333333-3333-3333-3333-333333333333"`; **the Rust side gains a
  matching one-line test** in `mp-host/tests/import.rs` asserting
  `PHYSICS_DOMAIN.to_string()` equals the same literal (architect finding 2 —
  previously only `Uuid::from_u128(0x3333…)` existed, so a drift would have
  been silent; now either side's drift fails its own suite). Test-only Rust.
- `DOMAINS offers Physics with a canonical e2 axis`.
- `seeds.test.mjs`: **all SEED_PLATEAUS + SEED_BRIDGES ids are unique** (the
  mechanical guard for finding 1); the Motion row is e2-dominant with the
  PHYSICS domain; every bridge endpoint exists in SEED_PLATEAUS.
- Existing `ARCHETYPES.length >= 3` / `DOMAINS.length >= 2` assertions stay
  untouched and remain green.

## 3. Code outline

persona.js: +1 const, +1 DOMAINS row, +1 archetype (~12 lines). main.js: +1
seed plateau, +1 seed bridge, +1 trailhead entry, +1 import symbol (~5 lines).
persona.test.mjs: +3 tests (~25 lines). Nothing else.

## 4. Non-goals

Map zoom/LOD; AI re-classification of imported domains/positions; importer
changes; new GA axes; any Rust/wasm/CRDT change.

## 5. Open questions (resolved here)

- Trailhead name: **Motion** (no Travel-list collision with imported notes). §2.2.
- Seed bridge concept: **"equations of motion"**, Calculus → Motion. §2.2.

## 6. Acceptance criteria

Maps to R-0022 AC:

- [x] AC1 — `PHYSICS_DOMAIN` exported with the importer's UUID; `DOMAINS` row
      (author sliders + draft select follow automatically). *(persona.test.mjs
      UUID pin + DOMAINS row test; auto-wiring QA-confirmed in main.js.)*
- [x] AC2 — The Physicist archetype; `seedReputation` puts SEED on the e2 blade
      of Physics only. *(Float-exact `[0,0,0.16,0,0,0,0,0]` test.)*
- [x] AC3 — "Motion" seed plateau (fixed id `…d1`, e2=1.0, PHYSICS domain) +
      Calculus→Motion seed bridge (`…ba`) + `TRAILHEAD_OF` entry.
      *(seeds.test.mjs ×6 incl. mechanical id-uniqueness; QA byte-diffed the
      extracted tables against pre-extraction main.js — b1–b9 intact.)*
- [x] AC4 — browser: Physicist woke to Motion only (1/9), traversals grew
      physics reach to 120/639 over the imported vault (Geometer baseline 582 —
      domain-scoped); reset re-fogs via the unchanged recompute path.
- [x] AC5 — 9 new JS tests + the Rust literal pin pass; existing assertions
      unmodified.
- [x] AC6 — JS-only, additive (`git diff crates/` = test-only +18 lines); all
      suites green (156 JS, 117 workspace, fmt, clippy).
- [x] AC7 — browser-verified with the imported world, console error-clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | Physics rides the canonical e2 axis; single-axis orient | Float-exact seeding, identical pattern to the other presets |
| 2026-06-10 | Trailhead "Motion" with fixed id …a5 + bridge …b4 | Deterministic convergent seed; distinct from imported note names |
| 2026-06-10 | UUID literal asserted on BOTH sides (JS test + existing Rust const) | The cross-crate contract fails loudly if either side drifts |

## Changelog

- 2026-06-10 created (Draft) — pending architect review, then Accepted.
- 2026-06-10 architect design review: **REQUEST-CHANGES → amended → Accepted.**
  Findings folded: (1) BLOCKING — bridge id `…b4` collided with the existing
  Geometry→Calculus "limits" bridge (b1–b9 taken); now `…ba`, plus seed tables
  extracted to `seeds.js` with a mechanical id-uniqueness test. (2) the
  "asserted on both sides" UUID claim was false — a one-line test-only Rust
  assertion now pins the literal in mp-host. (3) §2.2 reworded: live trailhead
  lighting is the TRAILHEAD_OF orientation gate (Phase 8), not seedReputation;
  e2=1.0 preserves the canonical margin invariant. (4) Physics gets its own id
  prefix `…d1`. AC7 positional-bleed expectation documented.
- 2026-06-10 implemented + browser-verified + **QA sign-off PASS** (all AC1–AC7;
  156 JS / 117 workspace tests, fmt + clippy clean; Physicist 1/9 → 7/9 →
  120/639 over the imported vault, console clean). R-0022 → Met.
  **Status → Implemented.**
