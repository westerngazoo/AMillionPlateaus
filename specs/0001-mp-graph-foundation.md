# SPEC-0001 — mp-graph foundation crate

- **Status:** Implemented
- **Realizes:** R-0001
- **Author:** Claude (Phase 0)
- **Created:** 2026-05-30
- **Depends on:** none
- **Module(s):** `crates/mp-graph`

## 1. Motivation

Realizes R-0001: a runnable, persisted knowledge graph with GA invariants
enforced at construction. This is the foundation every later crate links to.

## 2. Design

### Workspace

Root `Cargo.toml` declares a `[workspace]` (resolver "2") with four members:
`mp-graph`, `mp-reputation`, `mp-crdt`, `mp-wasm`. Shared deps live in
`[workspace.dependencies]`; `garust = { path = "../garust" }`. Only `mp-graph`
is implemented in this spec — the other three are compiling skeletons (empty
`lib.rs`) so the workspace builds and later phases have a home.

### mp-graph module layout (per CLAUDE.md)

```
crates/mp-graph/src/
  lib.rs     ← pub use re-exports only
  types.rs   ← all structs/enums (from GRAPH_SCHEMA.md)
  graph.rs   ← KnowledgeGraph impl
  db.rs      ← redb persistence (GraphDb)
  error.rs   ← GraphError (thiserror)
crates/mp-graph/examples/seed_graph.rs
```

### Invariant enforcement

Constructors are the single choke point.

- `PlateauNode::new(name, domain_id, e1, e2, e3)` builds
  `position = Multivector::vector(e1,e2,e3)` and `debug_assert`s
  `position.dominant_grade() == 1`. Fields are private; read access via getters
  (`position()`), so the invariant cannot be violated externally (CLAUDE.md
  "no public mutable position field").
- `Bridge::between(from, to, label, created_by)` computes
  `rotor = (from_pos * to_pos).even_grade().normalize()`, records
  `dominant_grade = rotor.dominant_grade()`, `debug_assert`s the rotor is
  even-grade (odd-grade components are ~0).
- For data arriving from deserialization (not trusted), `PlateauNode` /
  `Bridge` expose `validate(&self) -> Result<(), GraphError>` checking the same
  invariants; `GraphDb::load` validates every record and returns
  `GraphError::Invariant` on violation rather than panicking.

### KnowledgeGraph

Wraps `petgraph::Graph<PlateauNode, Bridge>` plus a `HashMap<PlateauId,
NodeIndex>` index and the (declared-but-unused-this-phase) resource/wizard/
reputation maps. Methods: `new`, `add_plateau -> NodeIndex`,
`add_bridge(Bridge) -> Result<EdgeIndex, GraphError>` (errors
`InvalidBridgeEndpoint` if either id is absent), `plateau(&PlateauId) ->
Option<&PlateauNode>`, plus iterators `plateaus()` / `bridges()` for the example
and persistence.

### GraphDb (redb)

`GraphDb::create(path)` / `open(path)`. Tables keyed by UUID bytes, values are
`bincode`-serialized structs, per GRAPH_SCHEMA.md (`PLATEAUS`, `BRIDGES`, …).
`save(&KnowledgeGraph)` writes all plateaus + bridges in one write txn;
`load() -> Result<KnowledgeGraph, GraphError>` reads them back, validates
invariants, rebuilds the petgraph + index. Round-trip equality on the set of
plateaus and bridges is the contract (AC5).

## 3. Code outline

```rust
// types.rs
pub struct PlateauNode { id, name, description, domain_id, position: Multivector, fog, created_at }
impl PlateauNode {
    pub fn new(name: &str, domain_id: DomainId, e1: f32, e2: f32, e3: f32) -> Self { /* debug_assert grade 1 */ }
    pub fn position(&self) -> &Multivector { &self.position }
    pub fn validate(&self) -> Result<(), GraphError> { /* grade == 1 */ }
}

pub struct Bridge { id, from, to, concept_label, rotor: Multivector, dominant_grade: u8, bidirectional, created_by }
impl Bridge {
    pub fn between(from: &PlateauNode, to: &PlateauNode, label: &str, by: WizardId) -> Self { /* even_grade().normalize() */ }
}

// graph.rs
impl KnowledgeGraph {
    pub fn add_bridge(&mut self, b: Bridge) -> Result<EdgeIndex, GraphError> {
        let from = *self.index.get(&b.from).ok_or(GraphError::InvalidBridgeEndpoint(b.from))?;
        let to   = *self.index.get(&b.to).ok_or(GraphError::InvalidBridgeEndpoint(b.to))?;
        Ok(self.graph.add_edge(from, to, b))
    }
}

// error.rs
#[derive(thiserror::Error, Debug)]
pub enum GraphError {
    #[error("Plateau {0} not found")] PlateauNotFound(PlateauId),
    #[error("Bridge references unknown plateau: {0}")] InvalidBridgeEndpoint(PlateauId),
    #[error("Invariant violated: {0}")] Invariant(String),
    #[error("Persistence error: {0}")] Db(String),
}
```

## 4. Non-goals

- Reputation, fog, Eigentrust, Sybil detection (Phase 1).
- CRDT, WASM, networking, Alebrije.
- Bridge *traversal* / pathfinding queries beyond add/lookup.

## 5. Open questions

- Does garust's `Multivector` derive `Serialize`/`Deserialize`? Required for
  bincode persistence. Owner owns garust; if absent, a newtype wrapper with
  manual (de)serialization of the coefficient array is the fallback. **Flagged,
  not blocking the non-persistence ACs.**

## 6. Acceptance criteria

- [x] AC1 → `plateau_position_is_grade_one` + `plateau_position_scalar_part_is_zero`
- [x] AC2 → `bridge_rotor_is_even_grade` + `bridge_dominant_grade_recorded`
- [x] AC3 → `add_and_lookup_plateau` / `unknown_plateau_is_none`
- [x] AC4 → `bridge_to_unknown_endpoint_rejected`
- [x] AC5 → `db_round_trip_preserves_graph` (tempfile redb)
- [x] AC6 → `cargo run -p mp-graph --example seed_graph` prints 5 plateaus + 4 bridges; `cargo test --workspace` → 14 passed

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-30 | Private fields + getters on PlateauNode instead of the public-field sketch in GRAPH_SCHEMA.md | CLAUDE.md forbids a public mutable position; invariant must hold for the type's whole life |
| 2026-05-30 | `add_bridge` returns `Result` (not `Option` as in GRAPH_SCHEMA.md sketch) | CLAUDE.md error-handling rule: public API returns typed errors, not silent `None` |
| 2026-05-30 | garust's real API ≠ GARUST_INTEGRATION.md; added `mp_graph::ga` adapter over `garust::Vga3f` | Shipped garust lacks `vector`/`dominant_grade`/`even_grade`/`normalize`/`norm` and serde; adapter derives them from garust primitives only (no other math lib). See GARUST_INTEGRATION.md §8 reality-check note. |
| 2026-05-30 | Persist `Multivector` via its public `coeffs: [f32; 8]` (serde `with`) | garust does not derive Serialize/Deserialize |

## Changelog

- 2026-05-30 created and accepted
