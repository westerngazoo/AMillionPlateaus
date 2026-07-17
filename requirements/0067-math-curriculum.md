# R-0067 — The detailed Mathematics curriculum (Geometer lens)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0065 (the lens → "Your path" mechanism + `DOMAIN_PATH_OF`), R-0066 (the physics
  precedent this mirrors: detailed, source-grounded, seeded curriculum), R-0060/R-0063/R-0064 (each
  new topic is a real plateau, so Teach-me / progress / Continue apply), R-0027 (seeded resources).
- **Realized by:** direct implementation — a pure `math-curriculum.js` data module + its integrity
  test, seeded and wired into `DOMAIN_PATH_OF` by main.js. Also restores the per-module
  integrity-test convention by adding the missing `physics-core-curriculum.test.mjs` (R-0066 gap).
- **Source:** the owner: picking a lens must open a **numbered, detailed** curriculum "from Khan,
  university or other official source" — confirmed **seed the curricula**, **all core lenses**. This
  is the Mathematics slice (the Geometer lens had only 4 bare seed plateaus, no path).

## 1. Statement

Mathematics gets a **detailed, numbered, followable curriculum** — the Khan-Math / OpenStax sequence
a learner actually walks: number sense → fractions/ratios → algebra (expressions, linear, functions,
quadratics, exp/log) → geometry & trigonometry → precalculus & limits → differential & integral
calculus → probability & statistics → a first linear algebra. Fifteen new plateaus (plus the seed
**Arithmetic** trailhead they thread out of) form **The Mathematics Core** path, which the Geometer
lens surfaces as its numbered "Your path" (R-0065). Each topic is a real plateau with a
source-grounded body, so ▶ Teach me, Resume, and Continue all work on it.

## 2. Rationale

R-0065 shipped the "pick a lens → numbered path" mechanism and R-0066 deepened Physics, but the
Geometer (Mathematics) lens still landed on four bare, description-less seed pillars with no path —
the emptiest of the core lenses. Mathematics is the spine every other lens leans on, so it's the
highest-value curriculum to author next. Seeding it (rather than deferring to the hand-off) makes it
appear the instant you pick the lens, offline, no model key — the owner's explicit choice.

## 3. Acceptance criteria

- **AC1 — A numbered mathematics path.** `MATH_PATH` ("The Mathematics Core") sequences the seed
  Arithmetic trailhead + 15 new topics in learning order (number sense → calculus → stats → linear
  algebra); `DOMAIN_PATH_OF[MATH_DOMAIN]` points at it so the Geometer lens opens it as a numbered
  "Your path" (R-0065).
- **AC2 — Detailed, source-grounded topics.** Each of the 15 plateaus has a real body (an idea +
  key formulas in KaTeX), a **Deliverable**, and a **Study (official)** pointer to Khan Academy /
  OpenStax (/ 3Blue1Brown), so the teaching is grounded, not generic.
- **AC3 — Real plateaus, wired in.** Topics seed as MATH_DOMAIN plateaus (e1-dominant, Grade-1) with
  a prerequisite bridge spine (and a link from the seed Arithmetic trailhead); they participate in
  the seed loops, so Teach-me (R-0060), lesson progress (R-0063), and Continue (R-0064) work on them.
- **AC4 — Official references seeded.** Canonical free resources (Khan Arithmetic, OpenStax Algebra &
  Trigonometry / Calculus, 3Blue1Brown) attach to the right plateaus (R-0027 shape).
- **AC5 — Additive, no collisions, tested.** New ids live in a reserved MATH namespace (plateaus
  e0…, bridges e1…, resources e2…, path e3…); nothing existing is redefined; `apps/web` only, no
  core/Rust/wasm change. A sibling `math-curriculum.test.mjs` asserts uuid validity, global
  uniqueness (vs seeds/QC/CS/phys-lens/phys-core), namespaces, Grade-1 coords, source-grounded
  bodies, and path/bridge/resource resolution — and the previously-missing
  `physics-core-curriculum.test.mjs` is added to restore the convention across the whole chain.

## 4. Constraints & non-goals

- **Seed, don't fetch** — bodies are authored (grounded in the official sequences); no runtime scrape
  of Khan/OpenStax (offline-first, CSP).
- **Reference the seed pillars, don't redefine them** — the bare Arithmetic seed is threaded into as
  the trailhead (like Motion in R-0066); Algebra/Geometry/Calculus seed pillars are superseded by the
  new detailed topics rather than reused (reusing their ids would trip the collision test).
- **Non-goals (follow-ups):** the **Music** curriculum (R-0068 — the last bare core lens); giving the
  bare seed pillars their own bodies; per-lens curricula for the Polymath (Math×Music) beyond its
  first faced domain; a course table-of-contents beyond the "Your path" panel.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Self-contained new topics in an `e…` namespace, not reuse of the bare seed pillars | Reusing seed ids collides with the integrity test; new topics carry the depth, mirroring R-0066 (Motion referenced, detail added). |
| 2026-07-16 | Fold the missing `physics-core-curriculum.test.mjs` into this PR | R-0066 shipped without its sibling test (architect finding); R-0067 adds ids that must not collide, so the guard belongs here. |
| 2026-07-16 | ~15 topics, intro→calculus + stats + first linear algebra | The Khan/OpenStax core a motivated learner completes; deep enough to be "not general", bounded enough to review in one PR. |

## Changelog

- 2026-07-16 created (Accepted) + implemented — `math-curriculum.js`: 15 detailed, source-grounded
  MATH plateaus + a 16-step "The Mathematics Core" path + prereq bridges + Khan/OpenStax/3B1B
  resources, wired into the seed loops and `DOMAIN_PATH_OF[MATH_DOMAIN]`. Added
  `math-curriculum.test.mjs` and the missing `physics-core-curriculum.test.mjs` (11 new cases; full
  suite 494/494). Live-verified: the Geometer lens opens "The Mathematics Core" (16 numbered topics,
  "0 of 16 studied", ▶ Start here); a row opens the detailed topic (Differential Calculus, KaTeX
  derivative) with the R-0063 course line + Continue live; +15 topics seeded, no console errors.
