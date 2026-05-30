# R-0001 — Foundation: core knowledge graph with GA invariants

- **Status:** Met
- **Milestone:** Phase 0 — Foundation
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-30
- **Depends on:** none
- **Realized by:** SPEC-0001
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The project must have an in-memory knowledge graph of plateaus (knowledge
domains) connected by bridges (conceptual links), with every geometric quantity
expressed through garust geometric algebra. A plateau's position must be a
Grade-1 multivector; a bridge's rotor must be even-grade. The graph must support
adding plateaus, adding bridges between existing plateaus, and looking up a
plateau by id. The graph must persist to and reload from local disk such that a
round-trip preserves every plateau and bridge.

## 2. Rationale

Every later phase — reputation, fog, WASM, CRDT, the 3D world — reads and writes
this graph. It is the single integration point of the system ("the graph is the
platform"). If the core types do not enforce their geometric invariants at
construction, invalid state leaks into every downstream component and the GA
guarantees (Sybil resistance, fog reachability) become unsound. Phase 0 exists
to make that foundation correct and runnable before anything is built on it.

## 3. Acceptance criteria

- **AC1.** Constructing a `PlateauNode` produces a `position` whose dominant
  grade is 1 (a pure vector in G(3,0,0)); its scalar part is 0.
- **AC2.** A `Bridge` constructed from two plateau positions has an even-grade
  `rotor` (grade 0 + grade 2 components only), and its recorded
  `dominant_grade` matches the rotor's actual dominant grade.
- **AC3.** `KnowledgeGraph::add_plateau` makes the plateau retrievable by its id
  via `plateau(id)`; an unknown id returns `None`.
- **AC4.** `KnowledgeGraph::add_bridge` succeeds only when both endpoints exist;
  a bridge referencing an unknown plateau is rejected (no edge added).
- **AC5.** Saving a graph to a redb database and loading it back yields a graph
  with the same set of plateaus and bridges (ids, names, positions, endpoints).
- **AC6.** A runnable `seed_graph` example builds 5 plateaus and 4 bridges and
  prints them; the workspace test suite is green.

## 4. Constraints & non-goals

- All geometry goes through garust — no `glam`/`nalgebra`/`linear_algebra`.
- No `async` in `mp-graph`; it is pure computation.
- No `unwrap()` in library code without a `// SAFETY:` comment.
- **Non-goals:** reputation/fog computation (R-0002+, Phase 1), CRDT sync,
  WASM bindings, networking. Wizard/reputation/resource types may be *declared*
  (the schema is one module) but their algorithms are out of scope here.

## 5. Open questions

- None blocking. Serialization format for redb values is `bincode` per
  TECH_STACK; `Multivector` must be `Serialize`/`Deserialize` (assumed from
  garust — confirmed needed, owner owns garust).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-30 | garust path dependency is `../garust` (sibling of repo), not `../../garust` | Owner confirmed garust lives one folder back from the repo root |
| 2026-05-30 | Invariants enforced with `debug_assert` in constructors per GRAPH_SCHEMA.md, plus a checked `try_*`/validation path for runtime-sourced data | Construction is the single choke point; debug builds catch programmer error, deserialized data is validated |

## Changelog

- 2026-05-30 created and accepted (Phase 0 is the agreed starting point per SDLC.md / ROADMAP.md)
