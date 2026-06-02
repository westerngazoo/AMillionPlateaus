# RFC-0001 — Extracting a geometric-algebra graph store as a standalone project

- **Status:** Scope A approved (2026-05-31) — tracked as R-0008. Scopes B and C remain future RFCs.
- **Author:** Gustavo Delgadillo (with Claude)
- **Created:** 2026-05-31
- **Affects:** `crates/mp-graph`, `crates/mp-crdt`; A Million Plateaus build going forward
- **Decision needed:** whether to extract, and if so which scope (see §11)

## 1. Summary

A Million Plateaus contains, almost by accident, a small and genuinely unusual
piece of infrastructure: a **graph store whose node positions are Grade-1
multivectors, whose edges are even-grade rotors, and whose primary query is a
geometric-algebra projection** rather than a B-tree lookup or a hop traversal.

This RFC proposes extracting that kernel into a standalone Rust library — working
name **`rotor-store`** (alternatives in §5) — and having A Million Plateaus
consume it as a dependency. The extraction is *mechanically* easy (the relevant
code is the leaf of the dependency tree, ~750 lines, no reverse dependencies on
the rest of the workspace). The *real* work is generalizing the domain-specific
types into a reusable schema and building the parts that make it a database rather
than a serializable struct: a query surface and a geometric index.

This document inventories what exists, proposes the extracted crate's shape and
API, separates "lifts as-is" from "must be generalized" from "must be built new,"
and gives a phased plan. **No code is written by this RFC.**

## 2. Motivation

- **The differentiator is real and rare.** The query primitive in
  `mp-graph/src/graph.rs:80` is `⟨rep · position⟩₀ > threshold` — a Hestenes
  inner-product projection, not an index seek. Vector databases do cosine/L2
  nearest-neighbour; graph databases do adjacency traversal. *A store where the
  index metric is a geometric-algebra projection, and where edges carry rotors
  (orientation-preserving transforms between nodes), is a different primitive.*
  That is a defensible wedge for a standalone project.
- **It is already CRDT-native.** `mp-crdt` gives multi-writer, serverless
  convergence with a deterministic genesis actor (two independently-constructed
  replicas merge cleanly). "An embedded geometric graph store that syncs without a
  server" is a second differentiator most graph DBs do not have.
- **Dogfooding.** AMP becomes the store's first real consumer, which keeps the
  library honest and the API grounded in a working application.
- **You own the math layer.** The whole thing rests on **garust** (your GA
  library). That is a strategic asset: the hardest, most differentiating dependency
  is already yours, not a third party.

## 3. What exists today (inventory)

All of the following is in the workspace now and passing CI (R-0001…R-0006 met).

### 3.1 The reusable kernel (≈ 750 lines)

| File | Lines | Role | Reuse verdict |
|---|---|---|---|
| `crates/mp-graph/src/types.rs` | 381 | GA-native node/edge types + invariants | **Generalize** (strip domain types) |
| `crates/mp-graph/src/graph.rs` | 219 | In-memory graph (petgraph) + geometric query | **Generalize** (query API) |
| `crates/mp-graph/src/ga.rs` | 133 | Thin adapter over garust's G(3,0,0) `f32` algebra | **Lift as-is** (or widen, §9) |
| `crates/mp-graph/src/db.rs` | 148 | redb + bincode save/load with invariant re-validation | **Rework** into an engine |
| `crates/mp-graph/src/error.rs` | 16 | `GraphError` | Lift as-is |

### 3.2 The sync layer (≈ 750 lines, optional feature)

`crates/mp-crdt/` — Automerge-backed `CrdtDoc` (`doc.rs` 454), grow-only vote
CRDT (`vote.rs` 109), `SyncSession` (`sync.rs` 41), feature-gated redb storage
(`store.rs` 128, behind `storage`). Root document keys are exactly
`{plateaus, bridges, resources, votes}`. Reputation is deliberately *never* in the
CRDT (project rule §7).

### 3.3 What is genuinely novel vs. conventional

- **Novel:** the GA types with construction-time invariants (`PlateauNode.position`
  forced Grade-1; `Bridge.rotor` forced even-grade via
  `(from * to).even_grade().normalize()`), and the projection query.
- **Conventional/thin:** `GraphDb` is a *dump/restore* — `save()` rewrites the
  whole graph in one redb write txn, bincode-per-record keyed by UUID bytes. redb
  is doing the actual storage work; there is no incremental write, no secondary
  index, no exposed transaction. The fog query is an **O(n) linear scan** over all
  nodes (`graph.rs:90`). These are the parts that must grow to call it a "DB."

### 3.4 Coupling reality (why extraction is low-risk)

`mp-graph` depends only on `garust, serde, uuid, petgraph, redb, bincode,
thiserror`. It has **zero dependency on `mp-crdt`, `mp-reputation`, or `mp-wasm`** —
it is the dependency-tree leaf. The hard coupling to remove is *naming*, not
*wiring*: `types.rs` declares domain concepts (`WizardProfile`, `WizardReputation`,
`AlebrijeState`, `Resource`, `CreatureArchetype`, the
`e1=Formal/e2=Physical/e3=Creative` axis semantics) inside the same module as the
generic graph types. Those domain types must move *out* (into AMP) so the store
core keeps only Node/Edge/position/rotor/query/persistence/sync.

## 4. Non-goals (for the extracted v0.1)

- A server, wire protocol, or query *language* (string DSL). v0.1 is an **embedded
  Rust library** with a typed query API.
- Replacing redb. redb stays the byte-level storage engine; the store adds the
  graph/geometry/index layer on top.
- Re-implementing garust. The store depends on garust for all GA math.
- Migrating AMP's domain model into the library. AMP keeps its wizards, reputation,
  alebrijes, plateaus-as-knowledge semantics; it maps them onto the generic store.

## 5. Proposed product

**Shape:** an embedded, optionally-syncable graph store — *"redb/sled, but the
index is geometric and edges are rotors."*

**Working name:** `rotor-store` (edges are rotors; memorable). Alternatives to
bikeshed later: `gade` (GA Database Engine), `cliffstore`, `geom-graph`,
`pleroma` (the GA "fullness"). Name is **not** a blocker for this RFC.

**Positioning vs. neighbours:**

| | Adjacency query | Vector/ANN query | **`rotor-store`** |
|---|---|---|---|
| Node payload | row/props | embedding vector | **multivector (graded)** |
| Edge payload | label/props | — | **rotor (even-grade transform)** |
| Core query | graph traversal | k-NN cosine/L2 | **GA projection / grade filter** |
| Sync | usually server | usually server | **CRDT, serverless** |
| Examples | Neo4j, Memgraph | Pinecone, Qdrant | (this) |

The pitch is not "another graph DB" or "another vector DB" — it is a store for
data that is *intrinsically geometric-algebraic*: orientation, grade, and
projection are first-class, not bolted on.

## 6. Architecture of the extracted crate

Dependencies point inward, mirroring the current workspace discipline:

```
rotor-store (the library)
  ├─ rotor-store-core     ← types (Node/Edge), invariants, in-mem graph, query   [no_std-friendly?]
  │     └─ garust         ← all GA math (G(3,0,0) f32 today; generalize later, §9)
  ├─ rotor-store-redb     ← persistence engine (feature "redb")
  └─ rotor-store-sync     ← CRDT replication (feature "sync", Automerge)          [from mp-crdt]
```

(Single crate with features is acceptable for v0.1; the split above is the eventual
shape.)

### 6.1 Generic types (the main generalization)

```rust
// rotor-store-core — generic over the caller's node/edge metadata.

/// A node positioned in the geometric algebra. `position` is held private and
/// validated to a fixed grade at construction (Grade-1 by default), exactly as
/// today's PlateauNode does.
pub struct Node<M> {
    pub id: NodeId,
    position: Mv,        // garust multivector; invariant-checked
    pub meta: M,         // caller payload (AMP puts name/domain/description here)
}

/// An edge whose geometry is an even-grade rotor between two node positions.
pub struct Edge<M> {
    pub id: EdgeId,
    pub from: NodeId,
    pub to: NodeId,
    rotor: Mv,           // even-grade invariant-checked
    pub dominant_grade: u8,
    pub meta: M,
}

pub struct GeoGraph<N, E> { /* petgraph + id index, as today */ }
```

The current `PlateauNode`/`Bridge` become AMP types that are *either* `Node<PlateauMeta>`
aliases *or* thin wrappers — TBD in §9. The axis semantics
(`e1=Formal/e2=Physical/e3=Creative`) move to AMP docs; the store is axis-agnostic.

### 6.2 Query surface (the new public value)

Generalize the single hardcoded `reachable_plateaus(rep)` into a small query API:

```rust
impl<N, E> GeoGraph<N, E> {
    /// Nodes whose position projects onto `direction` above `threshold`
    /// (today's fog query, generalized). ⟨direction · position⟩₀ > t.
    fn project_above(&self, direction: &Mv, threshold: f32) -> impl Iterator<Item = NodeId>;

    /// k nearest nodes to `direction` under the GA projection metric.
    fn nearest(&self, direction: &Mv, k: usize) -> Vec<(NodeId, f32)>;

    /// Nodes of a given dominant grade (grade-filtered scans).
    fn by_grade(&self, grade: u8) -> impl Iterator<Item = NodeId>;

    /// Apply an edge's rotor to a multivector (transport along a bridge).
    fn transport(&self, edge: EdgeId, v: &Mv) -> Mv;
}
```

`project_above` is exactly today's reachability with the wizard-reputation framing
removed; AMP's fog query becomes `graph.project_above(&rep, REACHABILITY_THRESHOLD)`.

### 6.3 Persistence engine (the rework)

Today: `save()` serializes *everything* each call. For a real store:

- **Incremental writes**: `put_node`/`put_edge`/`delete` as individual redb txns,
  not whole-graph rewrites.
- **Keep** the load-time invariant re-validation (`validate()` on every record) —
  that is a genuine correctness feature worth advertising ("the store refuses to
  load a node that violates its grade invariant").
- **Open question** (§10): expose redb transactions, or keep them internal?

### 6.4 Geometric index (the hard, differentiating piece)

The O(n) projection scan is fine for AMP's ~10-node demo but is *the* thing that
separates "a struct I can query" from "a database." Options, in increasing effort:

1. **None (v0.1):** document the linear scan; correct, not scalable. Acceptable to
   ship if framed honestly.
2. **Grade buckets + coarse direction binning:** cheap pre-filter; nodes indexed by
   dominant grade and by quantized direction, scan only candidate bins.
3. **Real spatial index over the grade-1 subspace** (e.g. an R-tree / cover-tree on
   the e1/e2/e3 coordinates, since the projection of grade-1 vectors reduces to a
   dot product). This is the credible "geometric index" and is the main research/
   engineering investment.

v0.1 can ship with (1) or (2); (3) is the moat.

### 6.5 Sync (lift from `mp-crdt`)

`CrdtDoc` + `SyncSession` move in behind a `sync` feature, generalized from the
fixed `{plateaus, bridges, resources, votes}` schema to "nodes + edges + caller-
defined CRDT maps." The deterministic-genesis trick (independently-created replicas
share root object ids and merge) is the reusable gem here.

## 7. What lifts vs. generalizes vs. is new

| Category | Items |
|---|---|
| **Lift ~as-is** | `ga.rs` adapter, `GraphError`, the in-memory `petgraph + HashMap<Id, NodeIndex>` structure, invariant-at-construction pattern, load-time `validate()`, the deterministic CRDT genesis actor |
| **Generalize** | `PlateauNode`→`Node<M>`, `Bridge`→`Edge<M>`, `reachable_plateaus`→query API, CRDT schema from fixed keys to node/edge + caller maps |
| **Move OUT to AMP** | `WizardProfile`, `WizardReputation`, `AlebrijeState`/creatures, `Resource`/`ResourceKind`/`ResourceState`, axis semantics, domain thresholds (`REACHABILITY_THRESHOLD`, `CRYSTALLIZE_THRESHOLD`, …) |
| **Build new** | incremental persistence, the query API surface, the geometric index (§6.4), benchmarks, the store's own docs/tests |

## 8. Relationship to A Million Plateaus

AMP stops owning the graph kernel and instead:
- Defines `PlateauMeta` / `BridgeMeta` payload types and aliases
  `type PlateauNode = Node<PlateauMeta>` (or wraps them).
- Keeps reputation/wizards/alebrijes/resources as *its* domain layer.
- Replaces direct `KnowledgeGraph`/`GraphDb` use with the library's `GeoGraph` +
  engine; `mp-wasm` re-exports stay thin.
- Gains nothing user-visible immediately (it is a refactor), but de-risks the
  store by being its proving ground.

Project rules survive the move: garust-only math (§1), deps point inward (§2),
reputation never in the CRDT (§7) — the store enforces the first two structurally
and stays agnostic about reputation (which lives entirely in AMP).

## 9. Hard problems / design tensions

- **Fixed algebra vs. generic.** Today everything is G(3,0,0) `f32` (8 coeffs,
  blade order `[1,e1,e2,e12,e3,e13,e23,e123]`). A general GA store might want
  G(p,q,r) parametrized. That is a large garust-level question; v0.1 should
  **stay G(3,0,0)** and treat generalization as future work, or the scope explodes.
- **Wrapper vs. alias.** `Node<M>` with a private `position` field cannot expose
  `position` mutably (invariant), so AMP payload goes in `meta`. Need to confirm
  this ergonomically replaces today's `PlateauNode` without a painful migration.
- **The index is the project.** Without §6.4(3), "geometric queries" is a marketing
  claim over a linear scan. Whether to invest in the real index decides if this is a
  toy extraction or a product.
- **garust as a published dependency.** Shipping `rotor-store` to crates.io means
  garust must be publishable (versioned, licensed, documented) — or vendored. That
  is a prerequisite, not an afterthought.

## 10. Open questions

- Expose storage transactions, or keep them internal behind `put_*`/`delete`?
- Is the value proposition "embedded library" only, or is a server (b) ever in
  scope? (This RFC assumes library-only for v0.1.)
- License/repo: new public repo now, or develop in-tree under `crates/` and split
  later once the API settles? (In-tree first is lower-friction; split when stable.)
- Does the geometric index warrant its own research spike before committing?
- Name (§5) — defer.

## 11. Proposed plan & decision

Three scopes to choose from:

- **Scope A — In-tree generalization (recommended first step).** Keep the code in
  this workspace, but refactor `mp-graph` into a domain-agnostic `Node<M>`/`Edge<M>`
  core with the generalized query API, moving AMP's domain types out into a new
  `mp-domain` (or AMP-side) module. *No new repo, no publishing.* This proves the
  abstraction against a real consumer and is reversible. Ship the linear-scan query
  honestly; defer the index.
- **Scope B — Split into a sibling repo** once Scope A's API has settled: move the
  generalized core + sync into `rotor-store`, depend on it from AMP via path/git,
  add the geometric index (§6.4) and benchmarks. Requires garust to be
  path/git-depable cleanly.
- **Scope C — Public crate.** Polish, docs, publishable garust, crates.io release,
  positioning page. Only after B has a real index and a second (non-AMP) example.

**Recommendation:** do **Scope A** as the next concrete piece of work (it is a
well-bounded refactor with clear acceptance criteria and keeps AMP green), then
re-evaluate B once the generic API has lived in AMP for a phase. Defer C until
there is an index and an external use case.

> Decision requested: approve **Scope A** (in-tree generalization) as a tracked
> work item, or hold. B and C remain future RFCs.

## 12. Changelog

- 2026-05-31 created (Draft) — proposal for discussion; no implementation.
- 2026-05-31 **Scope A approved** by the owner as the next concrete work item:
  in-tree generalization of `mp-graph` into a domain-agnostic `Node<M>`/`Edge<M>`
  core with a typed geometric query surface, moving AMP's domain vocabulary out of
  the store core. No new repo, no publishing, no garust changes; ship the
  linear-scan query honestly and defer the geometric index (§6.4(3)) to Scope B.
  Tracked as **R-0008**. Scopes B (sibling repo + index) and C (public crate)
  remain future RFCs, revisited after the generic API has lived in AMP for a phase.
