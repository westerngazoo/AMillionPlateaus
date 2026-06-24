# RFC-0002 — Domains as bivectors: membership by the wedge, overlap by the meet

- **Status:** Draft (2026-06-23) — proposal for discussion. A spike exists; no production code is changed by this RFC.
- **Author:** Gustavo Delgadillo (with Claude)
- **Created:** 2026-06-23
- **Affects:** `crates/mp-domain`, `crates/mp-graph` (`ga.rs`), the fog/reach query, reputation scoping, the future paths feature; downstream `mp-wasm`, `apps/web`, `crates/mp-godot`
- **Decision needed:** whether to adopt the bivector-domain model, and if so at which phase boundary (see §9/§11)
- **Supersedes:** the implicit "a domain is its own grade-1 axis" assumption (R-0006/R-0022/R-0038)

## 1. Summary

Today a knowledge **domain** is, geometrically, treated as a *direction/axis* — Math on
`e1`, Physics on `e2`, Music on `e3` (and, since R-0038, an authored lens is a named
grade-1 direction). Domain overlap is not computed at all; "Math relates to Physics" exists
only if a human draws a `Bridge`.

This RFC proposes modelling a domain as an **oriented plane — a grade-2 bivector** — in the
*same* `Cl(3,0,0)`. Then two GA operators carry the semantics we keep hand-rolling:

- **membership:** a topic (grade-1 vector `v`) belongs to a domain (plane `B`) when
  `v ∧ B ≈ 0` (the wedge / join vanishes exactly when `v` lies in the plane);
- **overlap:** two domains meet along a **line** `B₁ ∨ B₂` (garust's regressive product,
  the *meet*) — a computed "grounded island" of shared topics.

The motivating property: this **adds no dimensions**. Grade-2 of `Cl(3)` is itself 3-D, so
there are infinitely many domain-planes inside the same 8-coefficient multivector. A broad
domain ("philosophy") is one bivector — three numbers — that simply has a non-zero meet
with every other domain. It *reuses* the space; it does not grow it. And because a plane is
the **dual** of its normal vector in `Cl(3)`, this does not discard R-0038's lenses — "domain
as direction" and "domain as plane" carry the same three numbers; the bivector view just
makes the *meet* a first-class operator where today we only have projection.

A spike (`crates/mp-graph/examples/bivector_meet_spike.rs`) already proves the operators on
garust and on the real seed data. This RFC turns that into a design + phased plan. **No
production code is changed by this RFC.**

## 2. Motivation

- **Intersection is the product.** The owner's vision is *paths that intersect over grounded
  islands* — studying AI and Physics, both grounded in Geometric Algebra, so a path through
  one domain reuses topics shared with another. Today "shared" means *same plateau UUID*; it
  is not geometric. The meet `∨` makes "where do these two domains overlap?" a single
  computable operation.
- **No multidimensional blow-up.** Giving every domain its own axis would push `Cl(3)` toward
  `Cl(n)` — a deep garust change, and one that *contradicts* "everything grounded in GA":
  grounded fields (AI, computation, electronics, FPGA) are **blends/regions** of the three
  axes, not new fundamentals. A plane is exactly "a region spanned by existing axes."
- **A broad domain collects, not expands.** "Philosophy intersects everything" should mean it
  shares a *strand* (a line) with each domain — not that it contains them, and not that it
  needs a huge multivector. One bivector does this.
- **It is dual to what we already have.** R-0038 lenses are grade-1 directions; a plane is the
  dual of a normal vector. Adopting bivectors is additive, not a rewrite.

## 3. What exists today (inventory)

Verified against the code (not the aspirational `architecture/*.md`, which do not exist):

- **A domain is not geometry.** `PlateauNode { …, domain_id: DomainId, position: Mv, … }`
  (`crates/mp-domain/src/types.rs`) carries `domain_id` as a plain `Uuid` *tag*. There is no
  domain record and no stored plane/axis. A domain's canonical direction lives only in the
  client (`apps/web/src/persona.js` `DOMAINS`/`authorDomain`) and in vouch endpoints.
- **Positions are grade-1, rotors even-grade.** `PlateauNode.position` is built and validated
  Grade-1 (`types.rs`); `Bridge.rotor = normalize(even_grade(from*to))` (`Bridge::between`).
  These invariants are load-bearing (CLAUDE.md §2/§3).
- **The only query is a projection, not a meet.** `ga::project(rep, pos) = ⟨rep·pos⟩₀`
  (`crates/mp-graph/src/ga.rs:84`); fog clears a plateau when reputation projects above a
  threshold. Domains are kept apart only because reputation is a `Multivector` keyed per
  `DomainId`, recomputed from signed events — never stored in the CRDT (CLAUDE.md §7).
- **Persistence is two redb tables** `plateaus`/`bridges`, bincode rows keyed by UUID
  (`crates/mp-graph/src/db.rs`); the browser mirror is the Automerge `CrdtDoc`.
- **garust already has the operators.** `Multivector::wedge` (∧, `garust-core/src/products.rs`)
  and `Multivector::regressive` (∨, the meet, `garust-core/src/dual.rs`), plus complements and
  `pseudoscalar`. No GA must be invented or stubbed (CLAUDE.md §1).

## 4. The model

```
domain  ≔  an oriented plane, a grade-2 bivector B (3 coeffs: e12, e13, e23) in Cl(3,0,0)
topic   ≔  a grade-1 vector v (unchanged — the existing PlateauNode.position)

membership:  v ∈ domain B     ⇔   v ∧ B ≈ 0          (wedge; "near", see §6.1)
overlap:     domain B₁ ∩ B₂   =   B₁ ∨ B₂            (regressive product → a line)
dual:        B = dual(n)       (a plane is the dual of its normal vector n — R-0038 lens)
```

A plateau keeps its grade-1 `position`. A domain *gains* a grade-2 `plane`. The Grade-1
plateau invariant and the even-grade bridge invariant are **untouched** — this is purely
additive geometry. "Philosophy" is the bivector whose meet with each other domain is a
non-empty line; it is three numbers, not a new axis.

## 5. Evidence (the spike)

`crates/mp-graph/examples/bivector_meet_spike.rs` (`cargo run -p mp-graph --example
bivector_meet_spike`, green) establishes:

- **Operators are exact and direct on garust.** With `Math = e1∧e2`, `Physics = e2∧e3`:
  `meet(Math, Physics) = e2` (the shared line); `e1 ∧ Math = 0` (in-plane), `e3 ∧ Math = e123`
  (out-of-plane). A "Philosophy" plane `e1∧e3` meets Math in `e1` and Physics in `e3` — a
  shared line with each, while remaining one coefficient in the 8-coeff multivector. The
  "no new dimension" claim holds literally.
- **Real seeds expose the one wrinkle.** Building planes from real positions
  (`apps/web/src/seeds.js`): `Algebra∧Calculus`, `Harmony∧Counterpoint` give a genuine meet
  line, but a third same-domain topic sits **off** the plane — Geometry is 26% off the Math
  plane, Melody 32% off the Music plane. Real topics scatter in 3-D; they are *near*, not
  *in*, one plane.

## 6. Design consequences / hard problems

### 6.1 Membership needs a tolerance, not exact zero
`v ∧ B = 0` is too strict for real data (§5). Define membership by the **out-of-plane
fraction** `‖⟨v ∧ B⟩₃‖ / (‖v‖·‖B‖) ≤ τ` (the spike's metric; 0 = in-plane, 1 = orthogonal).
The 26–32% measurements set a starting band (τ ≈ 0.35 would admit the seeds' own topics).
This is a fuzzy-membership knob, analogous to today's `REACHABILITY_THRESHOLD`.

### 6.2 A domain's plane should be *fitted*, not spanned by two picks
`Algebra∧Calculus` and `Geometry∧Calculus` give different planes. A stable domain plane is
the **best-fit plane** through its member topics (the normal = smallest-singular-vector of
the topic matrix; equivalently the eigenvector of least variance), then `B = dual(normal)`.
For a domain with <2 topics, fall back to `dual(canonical_axis)` — the R-0038 lens direction.

### 6.3 Where the plane lives
Options: (a) a **stored `Domain { id, label, plane: Mv }`** entity (new CRDT map + redb
table), authoritative and synced; or (b) **derived** (recompute each domain's plane from its
member topics on load, store nothing — consistent with "the graph is the platform", CLAUDE.md
§6). Lean **(b)**: the plane is a *projection* of the topics, so deriving it keeps a single
source of truth and avoids a new authoritative entity. R-0038's authored lenses then seed the
fallback normal for sparse domains.

### 6.4 Reputation & fog stay put (at first)
Reputation remains a `Multivector` per `DomainId`, recomputed from signed events (CLAUDE.md
§4/§7 unchanged). The meet/membership are **new read-side geometry** layered beside the
existing projection fog — not a replacement. Whether reach later becomes "near the domain
plane" instead of "projects onto a direction" is a *separate* decision (Phase 3), deliberately
deferred so this RFC stays additive.

### 6.5 Invariants preserved
Plateau `position` stays Grade-1; `Bridge.rotor` stays even-grade. The new object is a
grade-2 domain plane — a different field, not a mutation of the constrained ones. CLAUDE.md
§1 (garust-only) is satisfied: `wedge`/`regressive` are garust primitives.

## 7. Paths on the meet (why this unblocks R-0039)

A path is an ordered list of plateau ids (the planned `KIND_PATH` signed artifact). With
bivector domains:
- a path lies (approximately) in a domain plane; where it crosses into another domain, the
  meet `B_mine ∨ B_theirs` is the **line of shared topics** to reuse — *grounding becomes
  computed*, not "same UUID";
- two authors' paths "intersect over a grounded island" exactly when their domain planes meet
  and both paths pass near that line. That is the vision, expressed as one operator.

So the recommended sequencing is: land the bivector model (membership + meet) first, then
define paths on top of the meet.

## 8. Non-goals

- **No higher-dimensional algebra.** Stays `Cl(3,0,0)`; no `Cl(n)`, no garust change.
- **No fog/reputation rewrite in this RFC.** The projection query and per-`DomainId`
  reputation are untouched; the meet/membership are additive read-side geometry (§6.4).
- **No new authoritative entity unless §6.3(a) is chosen.** Default is derived planes.
- **No change to the Grade-1 / even-grade invariants.**

## 9. Phased plan

- **Phase 0 — spike (done).** `bivector_meet_spike.rs` proves operators + surfaces the
  tolerance/fit findings.
- **Phase 1 — `ga` adapter + derived domain planes (additive).** Add `ga::wedge`, `ga::meet`,
  `ga::dual` wrappers (thin, garust-backed, tested) to `crates/mp-graph/src/ga.rs`; add a pure
  `domain_plane(topics) -> Mv` fit + `membership(v, B) -> f32` + `meet`-based
  `shared_line(B1,B2)` in `mp-domain`. Host-tested against the seeds. Nothing user-visible;
  fog unchanged.
- **Phase 2 — surface overlaps + define paths on the meet.** Expose the meet line through
  `mp-wasm`/`mp-godot`; show "shared with: <domain>" / grounded-island markers in the clients;
  define the `KIND_PATH` artifact and ground its intersections on the meet (this is R-0039).
- **Phase 3 — (optional) migrate reach onto the plane.** Only if Phase 2 shows the projection
  fog and the plane model disagree in a way worth reconciling. Its own RFC/requirement.

## 10. Open questions

- **τ (the membership tolerance):** fixed constant, per-domain, or learned from the domain's
  own topic spread? (§6.1)
- **Plane fit for sparse/!coplanar domains:** least-variance eigenvector vs. simple normal of
  the top-2 topics; how to handle a 1-topic domain beyond the lens fallback. (§6.2)
- **Derived vs stored plane** (§6.3) — does anything need the plane to be authoritative/synced
  (e.g. cross-user domain alignment for shared paths), which would argue for (a)?
- **Meet degeneracy:** parallel/near-parallel domain planes have an ill-conditioned meet; what
  is the "no meaningful overlap" threshold?
- **R-0038 reconciliation:** authored lenses are grade-1 normals today; do we keep storing the
  normal (and derive the plane), or store the plane? (Lean: keep the normal, derive — §6.3b.)

## 11. Proposed plan & decision

**Recommendation:** approve **Phase 1** (the additive `ga`/`mp-domain` layer + derived domain
planes, fog untouched) as the next tracked work item, then re-evaluate Phase 2 (overlaps +
paths-on-the-meet = R-0039) once the membership/meet primitives have lived against the real
seeds. Defer Phase 3 (migrating reach) until there is evidence it is needed.

> Decision requested: approve the bivector-domain model and **Phase 1** as a tracked
> requirement (additive, garust-only, invariants preserved), or hold. Phases 2–3 remain
> gated on Phase 1's results.

## 12. Changelog

- 2026-06-23 created (Draft) — proposal + phased plan; spike
  (`crates/mp-graph/examples/bivector_meet_spike.rs`) is the executable evidence. No
  production code changed.
