# R-0002 — GA reputation, Sybil resistance, and fog reachability

- **Status:** Met
- **Milestone:** Phase 1 — GA Reputation
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-30
- **Depends on:** R-0001
- **Realized by:** SPEC-0002
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Wizard reputation must be a geometric-algebra quantity, scoped per knowledge
domain, never a scalar. The system must:

1. Grow a wizard's domain reputation from genuine *traversal* of plateaus —
   reputation gains a Grade-1 (vector) component aligned with the visited
   plateau's position in knowledge space.
2. Propagate trust between wizards along bridges via the **rotor sandwich**
   `R · rep · R̃` (GA Eigentrust), scaled by a trust-decay factor.
3. Resist Sybil attacks by *grade collapse*: a cluster of wizards holding only
   raw-activity (Grade-0 / scalar) reputation that vouch for one another can
   never promote themselves above Grade-0.
4. Recognize genuine **cross-domain synthesis**: a wizard with real reputation
   in two or more non-parallel domains accumulates a Grade-2 (bivector)
   synthesis component; three independent domains can yield Grade-3.
5. Drive the **fog** mechanic: a plateau is reachable for a wizard iff the
   wizard's reputation, projected onto the plateau's position (inner product),
   exceeds a reachability threshold. Otherwise the plateau is fogged.

## 2. Rationale

Scalar reputation (a single number) is the root of Sybil-attackable systems: a
ring of fake accounts can pump each other's score arbitrarily. Encoding
reputation as a multivector makes *grade* — not magnitude — the measure of
trust, and grade can only be promoted by genuine geometric diversity of work
(visiting differently-oriented plateaus). The fog mechanic turns this same
geometry into the core navigation experience: you can only see the parts of the
knowledge world your accumulated understanding "faces".

## 3. Acceptance criteria

- **AC1.** `WizardReputation` stores reputation as `HashMap<DomainId, Multivector>`
  plus a `synthesis: Multivector`; no `f32`/scalar reputation field exists.
- **AC2.** Recording a traversal of a plateau adds a Grade-1 component along the
  plateau's position to the wizard's reputation in that plateau's domain;
  afterward that domain reputation has a non-zero Grade-1 part.
- **AC3.** `ReputationEngine::propagate` transfers a voucher's domain reputation
  to a vouched wizard as `bridge.rotor · rep · bridge.rotor̃ · TRUST_DECAY`.
- **AC4.** Propagating a purely Grade-0 (scalar) reputation through any bridge
  rotor yields a purely Grade-0 result — no grade promotion (the grade-collapse
  property). A ring of ≥3 scalar-only wizards vouching for each other never
  exceeds Grade-0 in any domain after repeated propagation.
- **AC5.** A wizard with non-parallel Grade-1 reputation in ≥2 domains has a
  non-zero Grade-2 synthesis after recomputation; a single-domain wizard's
  synthesis has no Grade-2 part.
- **AC6.** `KnowledgeGraph::is_reachable(plateau, wizard)` is true iff the
  maximum over the wizard's domain reputations of
  `⟨rep · plateau.position⟩₀` exceeds `REACHABILITY_THRESHOLD`;
  `reachable_plateaus(wizard)` returns exactly the set of plateaus for which
  this holds.
- **AC7.** A fresh wizard (empty reputation) finds all seed plateaus fogged;
  after traversing a set of plateaus, at least one previously-fogged,
  geometrically-aligned plateau becomes reachable. An example `fog_demo` prints
  the reachable set before and after.
- **AC8.** `cargo test -p mp-reputation` is green including the Sybil test;
  `cargo run -p mp-reputation --example fog_demo` runs and prints the fog lift.

## 4. Constraints & non-goals

- All GA operations go through garust (via the `mp_graph::ga` adapter); no other
  math lib. No `async` in `mp-reputation`. No `unwrap()` in library code without
  a `// SAFETY:` comment.
- Reputation is **computed**, never stored in any CRDT (R-0001 §7 / CLAUDE.md §7).
- **Non-goals:** Nostr-signed event sourcing of reputation (Phase 8), the
  Alebrije flight-path slerp, WASM exposure (Phase 2), persistence of
  reputation. Reachability here is a per-plateau projection test, not
  bridge-path traversal/BFS reachability.

## 5. Open questions

- Exact value of `TRUST_DECAY` (a tunable; starts at 0.5). Not blocking — chosen
  in the spec decision log, adjustable later.
- Whether synthesis aggregates pairwise wedges only, or also triple wedges for
  Grade-3. Settled in SPEC-0002 (both; Grade-3 when ≥3 independent domains).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-30 | `WizardReputation` stays defined in `mp-graph` (declared in R-0001); the `ReputationEngine` *algorithms* live in `mp-reputation` and operate on it | Avoids a dependency cycle: `mp-graph` reachability needs the type, `mp-reputation` depends on `mp-graph` |
| 2026-05-30 | Reachability/fog methods live on `KnowledgeGraph` in `mp-graph` (per GRAPH_SCHEMA.md), not in `mp-reputation` | They are graph queries needing only graph types + a garust inner product; keeps dep direction clean |
| 2026-05-30 | Synthesis uses the **wedge** `∧` of domain reputations, not the full geometric product | Wedge yields pure higher grades (2 from a pair, 3 from a triple) and is zero for parallel/scalar inputs — exactly the cross-domain signal we want |

## Changelog

- 2026-05-30 created and accepted
- 2026-05-30 Met — `qa` signed off on AC1–AC8 (30 tests green, clippy/fmt clean, `fog_demo` lifts fog)
