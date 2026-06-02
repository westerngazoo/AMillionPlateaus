# SPEC-0008 — Generalize `mp-graph` into a domain-agnostic geometric graph store (RFC-0001 Scope A)

- **Status:** Implemented
- **Realizes:** R-0008
- **Author:** Claude
- **Created:** 2026-05-31
- **Source:** `docs/rfcs/0001-ga-graph-store-extraction.md` §6, §7, §11 (Scope A)

## 1. Goal & shape

Turn `mp-graph` from "the AMP knowledge-graph crate" into a **domain-agnostic
geometric graph store** with a small **typed query surface**, and move AMP's
domain vocabulary into a new **`mp-domain`** crate that consumes the store. AMP
keeps working, **bit-for-bit**, on top of the generalized core (R-0008 AC4).

This spec deliberately chooses the **lowest-risk** generalization that satisfies
R-0008, because the behaviour-preservation bar (AC4) and the on-disk/on-wire
serialization constraint (below) dominate the design.

### 1.1 The constraint that drives the design: serialization must not change

`mp-graph`'s domain structs (`PlateauNode`, `Bridge`, `Resource`) are not just
in-memory types — their **serde representation is a wire/disk contract**:

- `mp-crdt`'s `CrdtDoc` stores plateaus/bridges/resources as **serde-JSON string
  scalars** keyed by UUID (`doc.rs`), reusing `mp-graph`'s own `Serialize`.
- `mp-graph::GraphDb` persists them as **bincode** rows in redb (`db.rs`).

If the *serialized shape* of these structs changes, existing CRDT documents and
redb files stop round-tripping and two tabs on different builds diverge. AC4
("identical results", root keys unchanged) therefore forbids changing their
serde layout. **Any design that nests today's flat fields under a `meta` payload
(RFC §6.1's `Node<M>`) changes the JSON/bincode shape** — and `#[serde(flatten)]`
is not an escape hatch because it breaks bincode (non-self-describing). This rules
the payload-struct approach out for Scope A (see §8 "Designs considered").

## 2. Architecture

### 2.1 Crate layout (dependencies point inward — CLAUDE.md §2)

```
garust  (unchanged, external)
  ▲
mp-graph        ← GENERIC store core: GeoGraph<N,E>, Positioned/Rotored traits,
  │               query API, generic GraphDb<N,E>, ga adapter, GraphError.
  │               NO AMP domain vocabulary.
  ▲
mp-domain (NEW) ← AMP types: PlateauNode, Bridge, Resource, WizardProfile,
  │               WizardReputation, Traversal, AlebrijeState + creatures,
  │               ResourceKind/State, id aliases, thresholds, axis semantics,
  │               and `KnowledgeGraph` (the domain graph = GeoGraph + side tables).
  ▲           ▲           ▲
mp-reputation  mp-crdt    mp-wasm   ← swap their `mp_graph::{domain types}` imports
                                       to `mp_domain::…`; keep `mp_graph::{ga, GraphError}`.
```

No cycles: `mp-domain → mp-graph`; the three consumers → `mp-domain` (+ `mp-graph`
for `ga`/`GraphError`). `mp-crdt` and `mp-wasm` keep their existing extra deps
(automerge, wasm-bindgen, …) unchanged.

### 2.2 The generic core (`mp-graph`)

The store is generic over the caller's node and edge **types**, constrained by two
geometric traits. This is the "**`GeoGraph<N, E>` equivalent**" R-0008 AC1 admits
— the caller owns its full type (and thus its serde), and the store reads geometry
through traits. It is *more* faithful to AC4 than a payload struct because the
caller's type — and its serialized form — is untouched.

```rust
// mp-graph: the geometry contract a node must satisfy.
pub type NodeId = Uuid;
pub type EdgeId = Uuid;

/// A node the store can position in the algebra. The position is Grade-1
/// (the store's defining geometry — RFC §9 keeps G(3,0,0)); the implementor
/// holds it privately and validates it at its own construction.
pub trait Positioned {
    fn node_id(&self) -> NodeId;
    fn position(&self) -> &Mv;
    /// Re-validate the Grade-1 invariant for data not built in-process
    /// (deserialized from disk/network). Called by the store on `load`.
    /// This maps to today's `PlateauNode::validate()` (the load-time hard check);
    /// the in-process construction check stays a `debug_assert!` (as today —
    /// `types.rs`), NOT a release panic, so release behaviour is unchanged (AC4).
    fn validate_position(&self) -> Result<(), GraphError>;
}

/// An edge whose geometry is an even-grade rotor between two node positions.
pub trait Rotored {
    fn edge_id(&self) -> EdgeId;
    fn endpoints(&self) -> (NodeId, NodeId);
    fn rotor(&self) -> &Mv;
    fn validate_rotor(&self) -> Result<(), GraphError>;
}

/// The generic store: petgraph + id index, plus the geometric query surface.
pub struct GeoGraph<N: Positioned, E: Rotored> {
    graph: petgraph::Graph<N, E>,
    index: HashMap<NodeId, NodeIndex>,
}
```

`GeoGraph` carries exactly today's `KnowledgeGraph` graph machinery
(`add_node`/`add_edge` with endpoint validation, `node`/`nodes`/`edges`,
counts) minus the domain side-tables (resources/wizards/reputation), which are
domain state and move to `mp-domain` (§2.5).

### 2.3 The typed query surface (R-0008 AC3)

Generalize the single hardcoded reachability query into a small typed API. A
"query orientation" is a **set of Grade-1 directions** scored by the **strongest**
alignment — this is exactly today's `max over wizard.domain_reps.values()` with the
wizard framing removed, so the scoring is preserved to the bit.

```rust
impl<N: Positioned, E: Rotored> GeoGraph<N, E> {
    /// max over `directions` of ⟨dir · node.position⟩₀  (today's projection_score,
    /// the single source of truth shared by `project_above`, `nearest`, and the
    /// domain's `is_reachable`). PUBLIC so `mp-domain` — a *separate crate* — can
    /// read the per-node score for `is_reachable` (resolves Open Question §6.2).
    pub fn score(&self, node: &N, directions: &[Mv]) -> f32;

    /// Nodes whose projection exceeds `threshold` (today's fog query, generalized).
    pub fn project_above(&self, directions: &[Mv], threshold: f32) -> Vec<NodeId>;

    /// Top-k nodes by descending projection, deterministic id tie-break (today's
    /// `nearest_plateaus`).
    pub fn nearest(&self, directions: &[Mv], k: usize) -> Vec<(NodeId, f32)>;

    /// Nodes whose position has the given dominant grade (grade-filtered scan).
    pub fn by_grade(&self, grade: u8) -> Vec<NodeId>;

    /// Apply an edge's rotor to a multivector (transport along a bridge):
    /// `rotor * v * ~rotor` via the ga adapter.
    pub fn transport(&self, edge: EdgeId, v: &Mv) -> Option<Mv>;
}
```

`score` (today's private `projection_score`), `project_above`, and `nearest` are
**moved verbatim** from today's `graph.rs` with `wizard.domain_reps.values()`
replaced by the `directions: &[Mv]` slice; the `total_cmp` descending sort + id
tie-break is unchanged. `score` is the **single** scorer that `project_above`,
`nearest`, and `mp-domain`'s `is_reachable` all call, so fog and retrieval still
cannot drift (today's invariant, preserved) — it is `pub` precisely because
`is_reachable` lives in a different crate and needs the per-node value.

`by_grade` and `transport` are the two genuinely new (small) queries the RFC names.
`by_grade` uses the existing `ga::dominant_grade`. `transport` needs a **new `ga`
helper** — a reverse/conjugation and a rotor sandwich product (`r * v * ~r`) — which
does **not** exist in `ga.rs` today (it exposes only
`vector/grade_magnitude/dominant_grade/even_grade/is_even_grade/norm/normalize/project`).
That helper MUST be built purely from garust primitives (CLAUDE.md §1, like the rest
of `ga.rs`) and unit-tested; the implementer must not assume a sandwich primitive
already exists. The O(n) linear scan is retained and **documented as such** (AC6);
the geometric index is Scope B.

### 2.4 Persistence (generic, format-preserving)

`GraphDb` becomes generic over the stored types:

```rust
pub struct GraphDb { db: redb::Database }
impl GraphDb {
    pub fn save<N, E>(&self, g: &GeoGraph<N, E>) -> Result<(), GraphError>
        where N: Positioned + Serialize, E: Rotored + Serialize;
    pub fn load<N, E>(&self) -> Result<GeoGraph<N, E>, GraphError>
        where N: Positioned + DeserializeOwned, E: Rotored + DeserializeOwned;
}
```

Because the **stored type is the caller's own struct** (`PlateauNode`/`Bridge`,
serde-unchanged), bincode rows are **byte-identical** to today. `load` still calls
`validate_position`/`validate_rotor` per record (the "store refuses to load a node
that violates its grade invariant" feature is kept — AC5). Table names
(`"plateaus"`, `"bridges"`) are generic store-level names; keep the strings to
avoid a redb schema rename (they are not "domain vocabulary" in any meaningful
sense, but if the architect prefers, rename to `"nodes"`/`"edges"` — this only
affects fresh files and is called out in §6 open questions).

### 2.5 `mp-domain` — AMP's types on top of the store

`mp-domain` holds everything moved out of `mp-graph`, **unchanged** except for
implementing the store traits:

- `PlateauNode` (flat serde struct, **identical fields/derives/methods** as today:
  `new`, `with_description`, `position()`, `validate()`) **+** `impl Positioned`.
- `Bridge` (identical) **+** `impl Rotored`.
- `Resource`/`ResourceKind`/`ResourceState`, `WizardProfile`, `WizardReputation`,
  `Traversal`, `AlebrijeState` + creature enums — moved verbatim.
- Id aliases `PlateauId = NodeId`, `BridgeId = EdgeId`, `DomainId`, `WizardId`,
  `ResourceId`; thresholds `REACHABILITY_THRESHOLD`, `CRYSTALLIZE_THRESHOLD`,
  `DECAY_THRESHOLD`; the `e1=Formal/e2=Physical/e3=Creative` axis docs.
- `KnowledgeGraph` — the **domain** graph: wraps a `GeoGraph<PlateauNode, Bridge>`
  and keeps the domain side-tables (`resources`, `wizards`, `reputation`), plus the
  AMP-named convenience methods that re-express the generic queries:

`resources`/`wizards`/`reputation` stay **`pub`** (as today — `mp-crdt`'s `doc.rs`
reads/writes `graph.resources` directly); only `geo` is private (today's `pub graph`
/ `pub index` are tightened to private, which is safe — no external consumer reads
`.graph`/`.index`).

```rust
// mp-domain
pub struct KnowledgeGraph {
    geo: GeoGraph<PlateauNode, Bridge>,
    pub resources: HashMap<ResourceId, Resource>,
    pub wizards:   HashMap<WizardId, WizardProfile>,
    pub reputation: HashMap<WizardId, WizardReputation>,
}
impl KnowledgeGraph {
    // The reputation→directions mapping is AMP domain logic (the store stays
    // agnostic): a wizard's orientation is the set of its per-domain reps.
    fn directions(rep: &WizardReputation) -> Vec<Mv> {
        rep.domain_reps.values().copied().collect()
    }
    pub fn is_reachable(&self, p: &PlateauNode, w: &WizardReputation) -> bool {
        // identical result to today: `score` is the same scorer `project_above` uses.
        self.geo.score(p, &Self::directions(w)) > REACHABILITY_THRESHOLD
    }
    pub fn reachable_plateaus(&self, w: &WizardReputation) -> Vec<PlateauId> {
        self.geo.project_above(&Self::directions(w), REACHABILITY_THRESHOLD)
    }
    pub fn nearest_plateaus(&self, w: &WizardReputation, k: usize) -> Vec<(PlateauId, f32)> {
        self.geo.nearest(&Self::directions(w), k)
    }
    // add_plateau / add_bridge / plateau / plateaus / bridges / *_count delegate to `geo`.
}
```

This keeps the **entire** public surface that `mp-reputation`, `mp-crdt`, and
`mp-wasm` use today (`KnowledgeGraph::new`, `add_plateau`, `add_bridge`, `plateau`,
`plateaus`, `bridges`, `is_reachable`, `reachable_plateaus`, `nearest_plateaus`,
`plateau_count`, `bridge_count`) — only the **import path** changes
(`mp_graph::KnowledgeGraph` → `mp_domain::KnowledgeGraph`). The
`REACHABILITY_THRESHOLD` gate (the only domain threshold the store used) lives in
AMP, where it belongs (AC2).

The R-0007 companion retrieval path is unaffected at the call site: `mp-wasm`'s
`nearest_dtos`, `reachable_ids`, and `is_reachable_by_id` (`convert.rs:145,168,188`)
keep their signatures and keep calling `KnowledgeGraph::{nearest_plateaus,
reachable_plateaus, is_reachable}` — those now delegate to `geo.nearest` /
`geo.project_above` / `geo.score`, so fog **and** retrieval share the one scorer
(AC3). No JS change.

## 3. Migration plan (workspace stays green at every step)

1. **Introduce traits + `GeoGraph` in `mp-graph`** alongside the existing types
   (no deletions yet); add the query API on `GeoGraph`. Core unit tests pass.
2. **Create `mp-domain`**; move the domain types there verbatim, add
   `impl Positioned/Rotored`, define the `KnowledgeGraph` wrapper delegating to
   `GeoGraph`. Re-export everything `mp-graph` used to export.
3. **Repoint consumers** (`mp-reputation`, `mp-crdt`, `mp-wasm`): change
   `use mp_graph::{domain types}` → `use mp_domain::…`; keep `mp_graph::{ga,
   GraphError, Mv}`. Add `mp-domain` to their `Cargo.toml`.
4. **Delete the moved types from `mp-graph`**; make `GraphDb` generic. Workspace +
   wasm build green.
5. **Re-express the web POC path** through the query API (it already calls
   `reachable_plateaus`/`nearest_plateaus` via `mp-wasm`, which now delegate to
   `GeoGraph` queries — no JS change expected). Rebuild the wasm bundle.

Each step ends green (`cargo test --workspace`); steps 1–4 are pure Rust, step 5
is the wasm rebuild + browser smoke.

## 4. Test plan (R-0008 AC4/AC7)

- **Core (`mp-graph`), domain-free:** a tiny test node/edge type (e.g. `TestNode`
  with a Grade-1 position) exercises `project_above`, `nearest` (ranking +
  truncation + id tie-break), `by_grade`, `transport`, endpoint validation, and
  load-time `validate_*` rejection. Proves the core compiles and is tested
  **without** any AMP type (AC1/AC2/AC6).
- **Regression (the AC4 bar):** all existing tests move with their types and must
  pass unchanged — `mp-graph`'s old graph/db tests become `mp-domain` tests;
  `mp-reputation`, `mp-crdt` (incl. `two_peer`), and `mp-wasm` (`convert` host +
  `web.rs` wasm) suites stay green verbatim. A new test asserts the **bincode bytes
  of a `PlateauNode`/`Bridge` are unchanged** by the move (serialize a fixed
  fixture, compare to a committed golden), guarding the serde contract.
- **Behaviour identity:** `is_reachable`/`reachable_plateaus`/`nearest_plateaus`
  produce identical results pre/post (the moved-verbatim tests already pin this);
  `mp-crdt` `root_keys()` stays `{bridges, plateaus, resources, votes}`.
- **Gates:** `cargo test --workspace`, `wasm-pack test --node`, clippy `-D
  warnings` (host + `wasm32`), `cargo fmt --check`, `node --test
  apps/web/src/*.test.mjs`, and a fog-world browser smoke (no console errors).

## 5. CLAUDE.md compliance

- **§1 garust-only math:** the core still routes all GA through the `ga` adapter;
  `by_grade`/`transport` use `ga::dominant_grade` and a rotor sandwich via `ga`. No
  new math lib, no GA in JS.
- **§2 deps inward:** `mp-domain → mp-graph`; consumers → `mp-domain`. No cycle.
- **§4 reputation never scalar:** `WizardReputation` moves verbatim (still a
  multivector map); the store never sees it — it sees `&[Mv]` directions.
- **§5 no panic across FFI / no bare unwrap:** `transport` returns `Option`;
  invariant checks return `Result`; `mp-wasm` skin unchanged.
- **§7 reputation/config/chat never in CRDT:** untouched; CRDT schema generalization
  is explicitly Scope B; root keys unchanged.

## 6. Open questions (for architect review)

1. **Trait shape.** `Positioned`/`Rotored` as above, vs. a single `GeoNode`/`GeoEdge`
   trait; and whether `validate_*` belongs on the trait or as a store-side check.
2. **`projection_score` exposure.** `is_reachable` needs a per-node score; expose a
   `pub fn score(&self, n, dirs)` on the core, or have `mp-domain` derive
   reachability from `project_above` membership only (loses the single-call score)?
3. **Directions as `&[Mv]` vs. a `Orientation(Vec<Mv>)` newtype** vs. a
   single-direction primitive with AMP doing the max-merge. (`&[Mv]` keeps today's
   scoring verbatim; recommended.)
4. **redb table names** `"plateaus"/"bridges"` → keep (zero churn) or rename to
   `"nodes"/"edges"` (cleaner, fresh-file only).
5. **Crate vs. module.** A full `mp-domain` crate (recommended; clean dep edge) vs.
   an in-crate `mp-graph::domain` module behind nothing (lighter but doesn't prove
   the dependency boundary).
6. **id aliases location.** `NodeId/EdgeId` in core; `PlateauId/DomainId/WizardId/…`
   in `mp-domain` — confirm no consumer needs a domain id name from the core.

## 7. Designs considered (and why this one)

- **Chosen — trait-bounded generic graph (`GeoGraph<N: Positioned, E: Rotored>`).**
  Caller owns its node/edge type and its serde; the store reads geometry through
  traits. Minimal churn (import paths + trait impls), **serde/bincode/JSON shape
  unchanged**, behaviour bit-identical — the strongest fit for AC4. R-0008 AC1
  explicitly admits the `GeoGraph<N,E>` form.
- **Rejected for Scope A — payload struct `Node<M>` / `Edge<M>` (RFC §6.1).** Nests
  today's flat fields under `meta`, **changing the serde wire/disk shape** and
  breaking CRDT/redb byte-compatibility (AC4); also forces `.name → .meta.name`
  churn across four crates. The payload form can be revisited in Scope B if a
  versioned migration is in scope.

## 8. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Trait-bounded `GeoGraph<N,E>`, not a `Node<M>` payload | Preserves serde wire/disk format (CRDT + redb byte-compat) and behaviour, satisfying AC4 at minimal churn; AC1 admits the `GeoGraph<N,E>` form |
| 2026-05-31 | New `mp-domain` crate holds AMP types; `mp-graph` is the generic core | Proves the dependency boundary against a real consumer (the point of Scope A) while keeping deps inward |
| 2026-05-31 | Query orientation is a set of directions (`&[Mv]`), scored by max projection | Exactly today's `max over domain_reps` with the wizard framing removed → bit-identical scoring; keeps fog + retrieval on one scorer |
| 2026-05-31 | Linear scan retained and documented; geometric index deferred | RFC §6.4 — the index is Scope B's moat, not Scope A |
| 2026-05-31 | `score` is `pub` on `GeoGraph` (one scorer for fog + retrieval + reachability) | `is_reachable` lives in `mp-domain`, a separate crate, so the shared scorer cannot be private (architect Finding 1) |
| 2026-05-31 | `transport` adds a new garust-built `ga` reverse+sandwich helper; construction stays `debug_assert` | No sandwich primitive exists in `ga.rs` today (Finding 3); a release-panic construction check would change behaviour vs. today (Finding 5, AC4) |

## Changelog

- 2026-05-31 created (Draft) — pending architect design review, then R-0008 → Accepted.
- 2026-05-31 architect design review: **APPROVE WITH CHANGES**, all folded in — resolved the
  `score` visibility contradiction (now `pub`, §2.3/§2.5), traced the three `mp-wasm`
  retrieval entry points for AC3 (§2.5), flagged `transport` needs a new garust-built
  `ga` reverse+sandwich helper (§2.3), pinned `resources` stays `pub` and construction
  stays a `debug_assert` not a release panic (§2.2/§2.5). Verdict ready for Accepted.
  Status Draft → **Accepted**.
- 2026-06-01 implemented (Accepted → **Implemented**). `mp-graph` is now the generic
  `GeoGraph<N: Positioned, E: Rotored>` store: traits + `NodeId`/`EdgeId` aliases in
  `geo.rs`, the typed query surface (`score` **pub**, `project_above`, `nearest`,
  `by_grade`, `transport`) moved verbatim from the old `graph.rs` with the wizard
  framing replaced by `&[Mv]` directions, generic `GraphDb` (redb table strings kept
  as `"plateaus"`/`"bridges"` for on-disk compat), and the new garust-built
  `ga::reverse`/`ga::sandwich` helpers backing `transport`. AMP vocabulary moved to the
  new **`mp-domain`** crate (`PlateauNode`/`Bridge`/`Resource`/wizards/creatures verbatim
  + `impl Positioned`/`Rotored`, the `KnowledgeGraph` wrapper with private `geo` and pub
  `resources`/`wizards`/`reputation`, id aliases, thresholds, seed example). The three
  consumers (`mp-reputation`, `mp-crdt`, `mp-wasm`) repointed `mp_graph::{domain types}`
  → `mp_domain::…`; `mp-domain` re-exports the core (`ga`, `Mv`, `GraphError`, `GraphDb`,
  `GeoGraph`, `NodeId`/`EdgeId`, traits) so the change is a pure import-prefix rename + one
  Cargo dep swap. **AC4 guard** realized as `mp-domain/tests/persistence.rs`: flat-shape
  assertions on `PlateauNode`/`Bridge` serde JSON (exact key set, `position`/`rotor` as
  8-arrays) + a generic-`GraphDb` round-trip; a literal committed *bincode golden* was
  deemed impractical (non-deterministic `id`/`created_at` fields, and the flat-shape test
  pins the nesting regression AC4 actually forbids without widening the type's API for a
  test). All §4 gates green: `cargo test --workspace` (mp-crdt 12+6, mp-domain 16+3,
  mp-graph 16, mp-reputation 11+1, mp-wasm 13), `wasm-pack test --node` (web.rs 5),
  clippy `-D warnings` (host + `wasm32`), `cargo fmt --check`, `node --test
  apps/web/src/*.test.mjs` (26), and a fog-world browser smoke (Geometer persona lights
  1/8 plateaus over 9 bridges, companion active, **zero console errors/warnings**).
  Pending: QA sign-off on R-0008.
