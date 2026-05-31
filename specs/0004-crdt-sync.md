# SPEC-0004 — mp-crdt: Automerge-backed graph sync

- **Status:** Implemented
- **Realizes:** R-0004
- **Author:** Claude
- **Created:** 2026-05-31
- **Depends on:** SPEC-0001
- **Module(s):** `crates/mp-crdt`

## 1. Motivation

R-0004 requires the shareable graph state (plateaus, bridges, resources, votes)
to be a CRDT so two offline-capable peers converge without a server, while
reputation stays out of the replicated document (CLAUDE.md §7). This spec
realizes R-0004 by wrapping an Automerge document in a thin `mp-crdt` API that
hydrates from / projects back to an `mp-graph` `KnowledgeGraph`, exposes a
grow-only vote counter, drives Automerge's sync protocol over opaque byte
messages, and persists to redb. `mp-crdt` owns **no** graph or GA logic; it
marshals `mp-graph` types (which already carry their invariants and serde
encoding) in and out of Automerge.

## 2. Design

### 2.1 Document shape

The Automerge document root holds exactly four maps (AC1, AC6):

```
ROOT
├── "plateaus"  : Map<plateau_id_str        -> JSON string of PlateauNode>
├── "bridges"   : Map<bridge_id_str         -> JSON string of Bridge>
├── "resources" : Map<resource_id_str       -> JSON string of Resource>
└── "votes"     : Map<"resource_id/wizard_id/actor_id" -> f64>   // flat, single-writer cells
```

**Deterministic genesis (implementation refinement).** The four root maps are
created by a *genesis* change authored by a fixed actor id at timestamp 0, so the
change hash — and therefore the root map object ids — are byte-identical on every
replica. Each replica then adopts a random actor for its own edits. Without this,
two independently-initialized documents would each create a *different* `plateaus`
map object at the root; merging them would pick one as the winner and silently
orphan the other's entries. The shared genesis lets independent-bootstrap peers
(not just shared-base peers) converge cleanly — strengthening AC5.

**Entity encoding decision.** Plateaus, bridges, and resources are *write-once
identities* in Phase 3 (R-0004 §4 non-goal: no field-level co-editing of a
record). Each is stored as a single opaque **serde-JSON string scalar** keyed by
its UUID, reusing `mp-graph`'s existing `Serialize`/`Deserialize` (including the
`serde_mv` adapter for `position`/`rotor`). This keeps `mp-crdt` from re-encoding
GA values and makes the GA invariants survive the round trip verbatim. Concurrent
*adds of distinct ids* merge as distinct map keys (the union). A concurrent
re-add of the *same* id is last-writer-wins on an identical-identity record,
which is benign for write-once entities.

**Votes** need field-level merge, so each vote is one cell in the single,
genesis-shared `votes` map keyed by a `"<resource_id>/<wizard_id>/<actor_id>"`
composite (UUIDs and the hex actor id never contain `/`, so the separators are
unambiguous). The `<actor_id>` segment is *this* replica's Automerge actor, which
makes every cell **single-writer**: no two replicas ever write the same key, so
concurrent votes can never collide into a last-writer-wins overwrite. Two peers
adding cells concurrently both survive (Automerge merges disjoint keys in the
*same* shared map object) — the grow-only union R-0004 AC3/AC5 require. A wizard's
grow-only weight is then the **max across that wizard's per-actor cells**,
computed on read (§2.3).

> **Why single-writer cells, not one cell per `(resource, wizard)` (AC3 fix).**
> A `"<resource>/<wizard>"` key is written by *every* replica, so two concurrent
> same-wizard votes are two puts to the *same* key — Automerge merges them as
> last-writer-wins **by actor id**, non-deterministically discarding the higher
> weight and violating the grow-only guarantee (the defect QA caught against AC3).
> Adding the actor segment makes each cell single-writer, so concurrent votes
> never overwrite; the max-on-read reconstructs the grow-only weight. A local
> `max(existing, weight)` on write keeps a single replica's own cell monotonic.

> **Why flat, not a per-resource sub-map (implementation refinement).** A nested
> `votes/<resource> -> Map<wizard -> f64>` would have each peer *create* the
> per-resource sub-map object concurrently; those two `put_object`s conflict and
> one peer's sub-map (and its votes) is orphaned on merge — the same root-map
> hazard the genesis change solves one level up. A flat composite key writes into
> the one shared `votes` object, so there is no sub-object to create-conflict on.

**Numeric representation.** Vote weights are the `f32` of the `ResourceVote` API
stored as Automerge `f64`: cast `f32 -> f64` on write, `f64 -> f32` on read, with
no rounding beyond the exact IEEE-754 widening/narrowing round trip. The cast is
deterministic, so two peers writing the same logical weight produce bit-identical
scalars (needed for cell-level convergence).

**Single source of truth for the tally.** The `votes` map is the *only*
authority for a resource's vote tally. `Resource.vote_count` (a denormalized
`f32` on the serialized blob) is **non-authoritative**: it is ignored on
`to_graph` and the live tally is read from `weighted_sum()`. This avoids two
sources of truth for the same number.

### 2.2 `CrdtDoc`

```rust
pub struct CrdtDoc { doc: automerge::AutoCommit }
```

- `new() -> CrdtDoc` — initializes the four empty root maps.
- `from_graph(g: &KnowledgeGraph) -> Result<CrdtDoc, CrdtError>` — writes every
  plateau, every bridge, and **every** resource (`g.resources`, a public field) as
  JSON entries, so the round trip is total, not partial (AC2).
- `to_graph(&self) -> Result<KnowledgeGraph, CrdtError>` — reads every entry,
  `serde_json::from_str` → `PlateauNode`/`Bridge`/`Resource`, calls `validate()`
  on each (Grade-1 / even-grade), and assembles a `KnowledgeGraph`. A failed
  `validate()` or a parse failure is a `CrdtError`, never a panic (AC1).
- `add_plateau(&mut self, p: &PlateauNode) -> Result<(), CrdtError>`,
  `add_bridge(&mut self, b: &Bridge) -> Result<(), CrdtError>`,
  `add_resource(&mut self, r: &Resource) -> Result<(), CrdtError>` — put one JSON
  entry under the matching map, keyed by `id`.
- `plateau(&self, id) -> Result<Option<PlateauNode>, CrdtError>` etc. — typed
  readers used by `to_graph` and tests (AC1).
- `vote(&mut self, resource_id, wizard_id, weight: f32) -> Result<(), CrdtError>`
  — delegates to the `ResourceVote` grow-only semantics (§2.3).
- `resource_vote(&self, resource_id) -> Result<ResourceVote, CrdtError>` — scans
  the flat `votes` map for the resource's cells and folds them, per wizard, to the
  max over the wizard's per-actor cells (§2.3).
- `merge(&mut self, other: &mut CrdtDoc) -> Result<(), CrdtError>` — Automerge
  `merge` (for the redb cycle / tests).
- `save(&mut self) -> Vec<u8>` / `load(bytes: &[u8]) -> Result<CrdtDoc, CrdtError>`
  — Automerge `save`/`load`.
- `root_keys(&self) -> Vec<String>` — for the AC6 test asserting exactly the four
  data maps.

### 2.3 `ResourceVote` — grow-only counter

A view over one resource's `wizard_id -> f64` sub-map. The only mutator raises a
cell monotonically; it can never remove a voter or lower a weight (AC3):

```rust
pub struct ResourceVote { weights: BTreeMap<WizardId, f32> }

impl ResourceVote {
    pub fn cast(&mut self, wizard: WizardId, weight: f32);   // sets max(existing, weight)
    pub fn weight_of(&self, wizard: &WizardId) -> f32;       // 0.0 if absent
    pub fn weighted_sum(&self) -> f32;                       // Σ weights
    pub fn voters(&self) -> usize;
}
```

`ResourceVote` is the in-memory tally view; the persisted form is the flat
`votes` map of single-writer cells (§2.1). `CrdtDoc::vote` writes the cell at
`votes["<resource>/<wizard>/<actor>"]`, applying `max(existing, weight)` against
*this replica's own* cell so a single replica stays monotonic.
`CrdtDoc::resource_vote` rebuilds a `ResourceVote` by scanning every cell for the
resource and taking, per wizard, the **max over that wizard's per-actor cells**.
Because each cell is single-writer, concurrent same-wizard votes merge cleanly
(no LWW overwrite) and the max-on-read converges to the larger weight; concurrent
votes by different wizards merge to the union; a re-vote never shrinks the tally
(AC3).

### 2.4 `SyncSession` — transport-agnostic Automerge sync

```rust
pub struct SyncSession { state: automerge::sync::State }

impl SyncSession {
    pub fn new() -> Self;
    pub fn generate_message(&mut self, doc: &mut CrdtDoc) -> Option<Vec<u8>>; // encoded sync msg or None at quiescence
    pub fn receive_message(&mut self, doc: &mut CrdtDoc, bytes: &[u8]) -> Result<(), CrdtError>;
}
```

Each peer keeps one `SyncSession` per remote peer plus its own `CrdtDoc`. The
caller pumps `generate_message`/`receive_message` until both sides yield `None`
(quiescence) — at which point the replicas are equal (AC4, AC5). No networking,
no async: bytes are the only currency, so the loop is fully host-testable and
the real transport (Gun.js relay, Phase 5) injects later.

**Convergence predicate.** Tests assert convergence via a *stable* predicate —
equal change heads (`doc.get_heads()`) and/or equal projected graphs plus equal
per-resource `weighted_sum()` — **not** raw `save()` byte equality, which
Automerge does not guarantee to be byte-identical between logically-equal
replicas (compression/ordering may differ).

### 2.5 redb persistence — `CrdtStore`

`mp-crdt` owns its persistence (a dedicated redb table) rather than extending
`mp-graph`'s `GraphDb`, because the stored artifact is an opaque Automerge save
blob, not the per-entity bincode rows `GraphDb` manages:

```rust
pub struct CrdtStore { db: redb::Database }
const DOC: TableDefinition<&str, &[u8]> = TableDefinition::new("crdt_doc"); // key "snapshot"

impl CrdtStore {
    pub fn open(path: &Path) -> Result<Self, CrdtError>;
    pub fn load(&self) -> Result<Option<CrdtDoc>, CrdtError>;        // None on empty store
    pub fn persist(&self, doc: &mut CrdtDoc) -> Result<(), CrdtError>; // writes doc.save()
}
```

The AC7 cycle is: `store.load()` → `doc.merge(&mut incoming)` →
`store.persist(&mut doc)`; reload equals the merged doc.

### 2.6 Errors

```rust
#[derive(thiserror::Error, Debug)]
pub enum CrdtError {
    #[error("automerge error: {0}")] Automerge(#[from] automerge::AutomergeError),
    #[error("sync decode error: {0}")] Sync(String),
    #[error("entity JSON is invalid: {0}")] Json(#[from] serde_json::Error),
    #[error("invariant violated on load: {0}")] Invariant(#[from] mp_graph::GraphError),
    #[error("storage error: {0}")] Storage(String),
    #[error("malformed document: {0}")] Malformed(String),
}
```

No `unwrap()` without `// SAFETY:`; every public method returns `Result` where it
can fail — no panic crosses the `mp-crdt` API (AC8).

### 2.7 File layout

```
crates/mp-crdt/src/
  lib.rs       ← pub use re-exports only
  doc.rs       ← CrdtDoc (document shape, hydrate/project, save/load/merge)
  vote.rs      ← ResourceVote grow-only counter
  sync.rs      ← SyncSession
  store.rs     ← CrdtStore (redb)
  error.rs     ← CrdtError
  tests/
    two_peer.rs   ← AC4 + AC5 integration tests
```

`Cargo.toml`: add `serde_json`, `thiserror`, `redb` (workspace); keep `automerge`,
`mp-graph`, `serde`, `uuid`. **Remove** `mp-reputation` exposure (it is not a dep)
and do **not** add `tokio` this phase (AC6, R-0004 §4).

## 3. Code outline

```rust
// doc.rs — representative, not final
use automerge::{transaction::Transactable, AutoCommit, ObjType, ReadDoc, ROOT};

const PLATEAUS: &str = "plateaus";
const BRIDGES: &str = "bridges";
const RESOURCES: &str = "resources";
const VOTES: &str = "votes";

impl CrdtDoc {
    pub fn new() -> Result<Self, CrdtError> {
        let mut doc = AutoCommit::new();
        for k in [PLATEAUS, BRIDGES, RESOURCES, VOTES] {
            doc.put_object(ROOT, k, ObjType::Map)?;
        }
        Ok(Self { doc })
    }

    fn map_id(&self, key: &str) -> Result<automerge::ObjId, CrdtError> {
        match self.doc.get(ROOT, key)? {
            Some((_, id)) => Ok(id),
            None => Err(CrdtError::Malformed(format!("missing root map {key}"))),
        }
    }

    pub fn add_plateau(&mut self, p: &PlateauNode) -> Result<(), CrdtError> {
        let map = self.map_id(PLATEAUS)?;
        self.doc.put(&map, p.id.to_string(), serde_json::to_string(p)?)?;
        Ok(())
    }

    pub fn to_graph(&self) -> Result<KnowledgeGraph, CrdtError> {
        let mut g = KnowledgeGraph::new();
        let pmap = self.map_id(PLATEAUS)?;
        for key in self.doc.keys(&pmap) {
            let json = /* read string scalar at key */;
            let p: PlateauNode = serde_json::from_str(&json)?;
            p.validate()?;            // Grade-1 invariant survives the wire
            g.add_plateau(p);
        }
        // bridges after plateaus so endpoints resolve; each b.validate()? then g.add_bridge(b)?
        Ok(g)
    }
}
```

```rust
// sync.rs — representative
use automerge::sync::{Message, State, SyncDoc};

impl SyncSession {
    pub fn generate_message(&mut self, doc: &mut CrdtDoc) -> Option<Vec<u8>> {
        doc.doc.sync().generate_sync_message(&mut self.state).map(|m| m.encode())
    }
    pub fn receive_message(&mut self, doc: &mut CrdtDoc, bytes: &[u8]) -> Result<(), CrdtError> {
        let msg = Message::decode(bytes).map_err(|e| CrdtError::Sync(e.to_string()))?;
        doc.doc.sync().receive_sync_message(&mut self.state, msg)?;
        Ok(())
    }
}

// two_peer.rs — pump to quiescence
fn sync(a: &mut CrdtDoc, sa: &mut SyncSession, b: &mut CrdtDoc, sb: &mut SyncSession) {
    loop {
        let mut progressed = false;
        // test helper: .expect (not bare unwrap) so AC8's clippy gate stays clean
        if let Some(m) = sa.generate_message(a) { sb.receive_message(b, &m).expect("a->b"); progressed = true; }
        if let Some(m) = sb.generate_message(b) { sa.receive_message(a, &m).expect("b->a"); progressed = true; }
        if !progressed { break; }
    }
}
```

## 4. Non-goals

- Network transport / async (`tokio`, Gun.js relay) — Phase 5.
- Nostr signature verification and event-log-derived reputation — Phase 8.
- `ResourceState` crystallization transitions & rendering — Phase 7.
- Field-level co-editing of a single plateau/bridge record — write-once this phase.
- Any reputation/wizard-profile data in the CRDT — forbidden (CLAUDE.md §7).

## 5. Open questions

- Exact Automerge 0.5 reader API for a string scalar at a key (`get` → `Value::Scalar`
  match). Mechanical; resolved during implementation, does not change the design.
- Whether `from_graph` should also carry resources. Seed graph has none; method
  will handle the empty case and write resources when present.

## 6. Acceptance criteria

- [ ] **AC1** → `CrdtDoc` four-map shape; add/read each entity reconstructs a
  `validate()`-passing `mp-graph` value or a typed error. Tests in `doc.rs`.
- [ ] **AC2** → `from_graph`/`to_graph` round-trip on the 5/4 seed preserves ids,
  names, positions, endpoints, rotors. Test in `doc.rs`/`tests`.
- [ ] **AC3** → `ResourceVote` grow-only: `cast` is monotonic, no removal;
  `weighted_sum` correct; distinct-wizard concurrent votes union after merge.
  Tests in `vote.rs` + `two_peer.rs`.
- [ ] **AC4** → two-peer test: A adds plateau → pump → B has it. `two_peer.rs`.
- [ ] **AC5** → concurrent different edits + votes → both replicas converge
  (equal `get_heads()` and/or equal projected graphs + equal per-resource
  `weighted_sum()`) and contain the union; order-independent. `two_peer.rs`.
- [ ] **AC6** → `root_keys()` == {plateaus,bridges,resources,votes}; no rep API;
  `mp-crdt` has no `mp-reputation` dep (Cargo.toml + a test).
- [ ] **AC7** → `CrdtStore` load → merge → persist → reload equals merged doc.
  Test in `store.rs`.
- [ ] **AC8** → `cargo test --workspace` green; clippy `-D warnings` clean; fmt
  clean; no unwrap without `// SAFETY:`; no panic across the public API.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Plateaus/bridges/resources stored as opaque serde-JSON string scalars; votes as a structural nested map | Records are write-once this phase (LWW on identical identity is benign); reuses `mp-graph` serde + `serde_mv` so GA invariants survive verbatim; only votes need field-level (grow-only) merge |
| 2026-05-31 | `ResourceVote::cast` sets `max(existing, weight)` (monotonic per wizard) | Grow-only counter semantics (R-0004 AC3); concurrent same-wizard writes converge without shrinking the tally |
| 2026-05-31 | `SyncSession` is transport-agnostic, sync (no tokio) | Host-testable two-peer pump; real transport is Phase 5 |
| 2026-05-31 | redb store lives in `mp-crdt` (own `crdt_doc` table), not `GraphDb` | Stored artifact is an opaque Automerge blob, not per-entity bincode rows |
| 2026-05-31 | `to_graph` calls `validate()` on every decoded entity | Network/disk data is untrusted; Grade-1 / even-grade invariants must be re-checked (CLAUDE.md) |
| 2026-05-31 | Per-wizard vote weight must be **monotonic non-decreasing** — hard precondition of `cast = max` | The `max` cell-merge is correct only while a wizard's weight never legitimately decreases; if a future phase feeds decaying reputation into vote weight this model must change to a PN/G-counter (architect note) |
| 2026-05-31 | `votes` map is the sole tally authority; `Resource.vote_count` is non-authoritative (ignored on `to_graph`) | Avoids two sources of truth for the same number (architect note) |
| 2026-05-31 | Convergence asserted via `get_heads()`/projected-graph equality, not `save()` byte equality | Automerge does not guarantee byte-identical `save()` between logically-equal replicas; protects AC5 from a flaky false negative (architect note) |
| 2026-05-31 | **Revised:** root maps built by a deterministic genesis change (fixed actor, time 0), then a random per-replica actor | Found during implementation: two independently-`new()`'d docs otherwise create conflicting root map objects and orphan one peer's entries on merge. Genesis makes independent-bootstrap peers converge — strengthens AC5 beyond the literal "shared base" |
| 2026-05-31 | **Revised:** `votes` is a *flat* `"resource/wizard" -> f64` map, not a per-resource nested sub-map | Found during implementation: a nested sub-map is *created* concurrently by each peer and conflicts (orphaning votes); a flat composite key writes into the one genesis-shared `votes` object, so distinct-wizard votes merge to the union (AC3/AC5) |
| 2026-05-31 | **Revised (AC3 fix):** vote cells are single-writer `"resource/wizard/actor"`; a wizard's weight is the **max over its per-actor cells** computed on read | QA caught: a `"resource/wizard"` cell is written by every replica, so concurrent same-wizard votes merge as Automerge last-writer-wins **by actor id**, non-deterministically discarding the higher weight (violates the grow-only guarantee, §2.3). Adding the actor segment makes each cell single-writer (no overwrite); max-on-read reconstructs the grow-only weight, so same-wizard concurrent votes converge to the larger weight |

## Changelog

- 2026-05-31 created
- 2026-05-31 architect design review → APPROVE WITH CHANGES; all six changes folded
  in (explicit f32↔f64 cast; votes-map is sole tally authority; from_graph carries
  resources; convergence asserted via get_heads not save() bytes; .expect in test
  pump; monotonicity precondition noted). Status Draft → Accepted
- 2026-05-31 implemented `mp-crdt` (doc/vote/sync/store/error). Two design points
  revised during implementation and logged above (deterministic genesis change;
  flat composite-key `votes` map) — both eliminate Automerge object-creation
  conflicts so independent peers converge. 15 mp-crdt tests (11 unit + 4 two-peer)
  green; `cargo test --workspace` → 56 host tests; clippy `-D warnings` + fmt
  clean. Status Accepted → Implemented (pending `qa` sign-off on R-0004)
- 2026-05-31 **AC3 fix** (QA-found defect): same-wizard concurrent votes did not
  converge to the max — a `"resource/wizard"` cell is written by every replica, so
  concurrent puts merged as Automerge last-writer-wins by actor id, discarding the
  higher weight. Fixed by making cells single-writer (`"resource/wizard/actor"`)
  and folding to the max over a wizard's per-actor cells on read (§2.1, §2.3,
  decision log). `same_wizard_concurrent_votes_converge_to_the_max` now passes;
  18 mp-crdt tests (12 unit + 6 two-peer) green, `cargo test --workspace` → 59
  host tests, clippy + fmt clean
