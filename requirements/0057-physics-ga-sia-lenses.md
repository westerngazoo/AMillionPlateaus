# R-0057 — GA + SIA lenses over the physics-degree core

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-14
- **Depends on:** R-0022 (the Physicist lens / Physics faced domain), R-0038 (faced domains as
  lenses), R-0011/R-0013 (plateaus + bridges), R-0020 (Markdown/KaTeX bodies), R-0039 (learning
  paths), and the QC math island in `curriculum.js` (Clifford, τ & Rotors, SIA Infinitesimals,
  Qubit = Spinor) that this meets.
- **Realized by:** direct implementation — a seed module `physics-lens-curriculum.js` + two personas
  and two domains in `persona.js` + the seed-loop wiring in `main.js` (mirrors the R-0085
  CS-curriculum pattern; no new architecture).
- **Source:** the owner's *Licenciatura en Física* study plan (PDF) + "give it an alternate lens for
  GA and SIA instead," choosing "physics core, deeper" and two separate lenses.

## 1. Statement

Seed the **physics-degree core** as plateaus (the load-bearing sequence: mechanics → EM/Maxwell →
relativity → optics → thermo/stat-mech → quantum → spin), and add **two alternate lenses that
re-face the same topics through a different formalism**:

- **Geometric Algebra (GA)** — the algebra the whole app runs on (garust): the geometric product,
  bivectors, rotors, geometric calculus, Maxwell as one $\nabla F = J$, spacetime algebra, spinors.
- **Synthetic Infinitesimal Analysis (SIA)** — calculus by nilsquare infinitesimals $\varepsilon^2=0$:
  the Kock–Lawvere derivative, microlinearity, least action by infinitesimal variation, synthetic
  differential geometry.

Cross-lens **bridges** tie each physics topic to its GA and SIA reframing, so a concept can be
studied three ways; four **"(meet)"** bridges cross into the existing quantum-computing math island
so the worlds share plateaus, not copies.

## 2. Rationale

The app's premise is "knowledge graph as geometry, wizard rank as multivectors" — the physics a
learner already knows is the perfect thing to *re-see* in that geometry. GA collapses the physics
learner's zoo (dot/cross products, axial vectors, the mysterious $i$, four Maxwell equations, spin
as a bolt-on) into one algebra; SIA collapses its calculus (limits, epsilons, "small enough") into
honest algebra. Presenting the owner's own degree curriculum through both is the sharpest possible
demonstration of the app's thesis, and turns a standard syllabus into an active re-derivation.

## 3. Acceptance criteria

- **AC1 — Physics core seeded.** The load-bearing physics topics (≥8: math methods, classical
  mechanics, rotational mechanics, EM & Maxwell, special relativity, waves/optics, thermo/stat-mech,
  quantum mechanics, spin) are seeded as `PHYSICS_DOMAIN` plateaus with Markdown/KaTeX bodies and a
  prerequisite bridge spine, anchored to the existing "Motion" trailhead.
- **AC2 — Two lenses.** Two new faced domains (`GA_DOMAIN`, `SIA_DOMAIN`) and two pickable personas
  ("The Geometric Algebraist", "The Synthetic Analyst") exist; each lens' trailhead ("The Geometric
  Product" / "Nilsquare Infinitesimals ε²=0") sits ON the lens' canonical unit direction so the
  SEED=0.16 projection clears mp-graph's 0.15 fog on step one (R-0019).
- **AC3 — GA + SIA reframings.** Each lens seeds plateaus that reframe the physics core (GA: product,
  bivectors, rotors, geometric calculus, ∇F=J, STA, spinors; SIA: ε²=0, Kock–Lawvere, microlinearity,
  least action, SDG), each with a correct, illuminating body and a concrete deliverable.
- **AC4 — Cross-lens + meet bridges.** Bridges connect each core physics topic to its GA and its SIA
  reframing; ≥4 "(meet)" bridges cross INTO the existing QC math plateaus (Clifford Cl(V,Q), τ &
  Rotors, SIA Infinitesimals, Qubit = Spinor) — shared ground, never duplicated. Every bridge/
  resource/path endpoint resolves to a real plateau.
- **AC5 — A followable path.** At least one learning path walks GA through the physics core to the
  summit where the GA and SIA lenses meet (synthetic differential geometry).
- **AC6 — Pure + additive + tested.** All content is pure data on fixed ids in reserved namespaces
  (physics 8…, GA 9…, SIA a…, bridges b…, resources c…, path d…), idempotently upserted; no
  core/Rust/wasm change; no new runtime dependency. `node --test` proves id uniqueness, endpoint
  resolution, the four meet crossings, on-axis trailheads, and lens registration.

## 4. Constraints & non-goals

- **Meet, don't copy.** The GA/SIA *math foundations* already exist in `curriculum.js`; this module
  bridges into them rather than redefining them.
- **Scope = the physics core, deeper** (owner's choice): the load-bearing physics + the math it
  needs, not every one of the ~48 degree courses. Non-core courses (Inglés, Electrónica, Metrología,
  Seminario, Física Ecológica) are out; the rest of the degree map is a follow-up (the "whole degree"
  option).
- **Non-goals:** an authored SPEC per plateau; changing the Physicist lens; the density knee (R-0055)
  — the new plateaus push the shipped world past the 60-node knee, which is the intended adaptive
  behaviour, acknowledged by updating the R-0055 guard test.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-14 | Two separate lenses (GA, SIA), not one combined | They are different tools — the algebra of space vs. the calculus of the infinitesimal; separate lenses keep each self-contained (owner's call). |
| 2026-07-14 | Physics core lives in `PHYSICS_DOMAIN`; GA/SIA reframings in their own domains, joined by cross-lens bridges | Matches the app's lens model: a lens faces a domain; the reframing is a bridged neighbour, so one concept is genuinely three plateaus you can compare. |
| 2026-07-14 | Four "(meet)" bridges into the QC island instead of new GA/SIA math plateaus | Clifford, rotors, SIA infinitesimals, and the spinor already exist there; sharing them is the RFC-0002 meet in spirit. |
| 2026-07-14 | GA canonical (0.71, 0.71, 0), SIA (0.9, 0, 0.44) | GA is the 45° meet of Formal(math) and Empirical(physics) — it IS the math of physics; SIA sits near Intuitionistic Foundations (it is intuitionistic analysis) yet distinct enough not to light its trailhead. |
| 2026-07-14 | Accept crossing the R-0055 density knee | 71 > 60 by design; more topics SHOULD get more room. The R-0055 guard is updated to protect the clamp + monotonicity instead of behaviour-preservation. |

## Changelog

- 2026-07-14 created (Accepted) + implemented — physics-degree core (9 plateaus) + GA lens (7) + SIA
  lens (5), 32 bridges (prereq spine, cross-lens reframings, four meet crossings), 4 canonical book
  resources, one GA→physics→meet path, two personas/domains. Built from the owner's Licenciatura en
  Física plan. Live-verified: both lenses pickable, GA lens renders at 71 topics / 95 bridges, all 21
  bodies render with valid KaTeX, no console errors.
