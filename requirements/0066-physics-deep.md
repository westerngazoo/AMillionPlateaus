# R-0066 — Deepen the Physics core (detailed, source-grounded)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0065 (the "Your path" numbered panel + `PHYS_CORE_PATH` this replaces), R-0057
  (the 9 upper-division physics plateaus this threads through — referenced, never redefined), R-0027
  (seeded resources shape), R-0060 (the Teach-me lesson each topic now feeds with richer notes).
- **Realized by:** direct implementation — a new pure-data `physics-core-curriculum.js` (10 granular
  plateaus + prereq bridges + official resources + the rebuilt 20-step path), seeded by main.js.
- **Source:** the owner: "the teach has to be deeper not so general … a list of topics very detailed
  maybe from khan, university or other official source." (Confirmed: **seed** detailed curricula.)
  **Slice 2 of 3** — the Physics deepening (owner's licenciatura-en-física focus).

## 1. Statement

The Physics Core path went from 10 upper-division topics (R-0065) to the **full 20-topic
intro→advanced degree sequence**: the granular mechanics and E&M a real physics degree / Khan Physics
walks before the upper division —

> Motion → Kinematics 2D & Projectiles → Newton's Laws & Forces → Work, Energy & Power → Momentum &
> Impulse → Rotational Mechanics → Gravitation & Orbits → Oscillations & SHM → Waves & Optics →
> Electrostatics → DC Circuits → Magnetism → Electromagnetic Induction → Thermodynamics →
> Mathematical Methods → Classical Mechanics (Lagrangian) → Electromagnetism & Maxwell → Special
> Relativity → Quantum Mechanics → Spin & Angular Momentum.

Each of the 10 new topics has a **detailed body** (the core equations + the method + a concrete
**Deliverable**) and a **"Study (official)"** pointer to Khan Academy and OpenStax *University
Physics* — so opening one and hitting ▶ Teach me is source-grounded, not generic. Two seeded official
resources (Khan Physics library; OpenStax, free) anchor it.

## 2. Rationale

R-0065 made the lens open a numbered path, but for Physics that path was 10 upper-division topics with
a big gap where the intro degree sequence should be — "too general," as the owner put it. A learner
starting a physics degree needs kinematics, forces, energy, momentum, circuits, magnetism *first*.
This fills that gap with granular, official-curriculum-grounded topics, so the numbered path is now an
actual degree track the owner can follow from the start, and each stop points at a free official
source for depth.

## 3. Acceptance criteria

- **AC1 — 20-topic degree path.** The Physicist lens' "Your path" shows the full ordered sequence
  above (20 numbered topics), intro mechanics → E&M → the R-0057 upper division.
- **AC2 — Detailed, source-grounded topics.** Each of the 10 new plateaus has a Markdown body with
  the key equations, the method, a **Deliverable:**, and a **Study (official):** line citing Khan
  Academy / OpenStax; rendering (Markdown + KaTeX) works when the topic opens.
- **AC3 — Wired into the map + progress.** The new topics are real plateaus with prerequisite bridges
  into the intro chain and up to the R-0057 core; each participates in Teach me (R-0060) / Resume
  (R-0063) / Continue (R-0064) / lens-path progress (R-0065).
- **AC4 — Official resources.** At least the Khan Physics library and OpenStax University Physics are
  seeded as resources on the new topics (R-0027 shape).
- **AC5 — Additive, no collisions, no regressions.** New fixed ids don't collide with any existing
  seed id; the R-0057 upper-division ids are only referenced, so the GA/SIA cross-lens bridges stay
  intact; `apps/web` only; no core/Rust/wasm change; the seed stays idempotent.

## 4. Constraints & non-goals

- **Reference, don't redefine.** The 9 upper-division physics plateaus keep their R-0057 ids and
  bodies; this only adds intro/mid topics and re-sequences the path.
- **Grounded, not scraped.** Bodies are authored (from the standard Khan/OpenStax structure) and cite
  the free official sources; the app stays offline-first and does not fetch curricula at runtime.
- **Non-goals (follow-ups):** further splitting (e.g. geometric vs. wave optics, electric potential as
  its own topic); Math + Music curricula (R-0067); per-lens curricula so GA/SIA and Classical/
  Intuitionistic stop sharing one path (a later refinement noted in R-0065).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | New module `physics-core-curriculum.js`, not extend physics-lens | Keeps the R-0057 file focused on the GA/SIA reframings; the new file owns the intro core + the rebuilt path, referencing upper-division ids as strings (no circular import). |
| 2026-07-16 | Intro mechanics + intro E&M as the 10 new topics | The biggest gap between "Motion" (bare) and the upper division; matches the standard first-two-semesters degree / Khan sequence. |
| 2026-07-16 | Each body ends in Deliverable + "Study (official)" | The Deliverable makes it testable (R-0030 mastery); the official pointer is the owner's "from Khan/university" made concrete without a runtime fetch. |
| 2026-07-16 | Math Methods placed at #15 (gateway to upper division) | It's the calculus/linear-algebra toolkit the Lagrangian/EM/QM tier needs; the R-0057 bridges already treat it as their prerequisite. |

## Changelog

- 2026-07-16 created (Accepted) + implemented (slice 2) — `physics-core-curriculum.js`: 10 granular
  intro→mid physics plateaus (kinematics 2D, forces, energy, momentum, gravitation, SHM,
  electrostatics, circuits, magnetism, induction) with detailed source-grounded bodies + prereq
  bridges + Khan/OpenStax resources, and the rebuilt 20-step `PHYS_CORE_PATH`. Live-verified: the
  Physicist path shows all 20 topics ("0 of 20 studied"); opening Newton's Laws & Forces renders its
  detailed body + "Study (official)" + the Khan resource; no id collisions (81 plateaus, all path
  steps resolve); full suite 483/483; no console errors.
