# SPEC-0005 — Web fog-world POC: CRDT-in-wasm + a 2D synced map

- **Status:** Implemented
- **Realizes:** R-0005
- **Author:** Claude
- **Created:** 2026-05-31
- **Depends on:** SPEC-0003, SPEC-0004
- **Module(s):** `crates/mp-crdt` (feature-gate), `crates/mp-wasm` (bindings), `apps/web` (the page)

## 1. Motivation

R-0005 wants a shareable web artifact that shows the graph *as geometry*, lifts
fog on traverse, and converges between two browser tabs with no server.
Everything the page renders already exists in the audited Rust core; what's
missing is (a) the CRDT sync engine compiled to and exposed through WASM, and (b)
a thin browser front-end that draws the graph and pumps sync bytes between tabs.
This spec adds exactly those two things and nothing else: no new graph/GA/CRDT
logic, no math in JavaScript.

## 2. Design

Three layers, dependencies pointing inward (CLAUDE.md §2): `apps/web` →
`mp-wasm` → {`mp-graph`, `mp-crdt` (no-storage)}.

### 2.1 `mp-crdt`: make the sync core wasm-buildable (AC1)

`redb` is native-only and won't link on `wasm32`. Gate it — and only it — behind
a default-on `storage` feature, leaving `CrdtDoc`, `SyncSession`, `ResourceVote`,
and `CrdtError` (minus its storage variant) always compiled:

```toml
# crates/mp-crdt/Cargo.toml
[features]
default = ["storage"]
storage = ["dep:redb"]

[dependencies]
redb = { workspace = true, optional = true }   # was: non-optional
# automerge, serde, serde_json, uuid, mp-graph, thiserror unchanged
```

```rust
// lib.rs
#[cfg(feature = "storage")] mod store;
#[cfg(feature = "storage")] pub use store::CrdtStore;

// error.rs — the only storage-specific variant is gated so -D warnings stays
// clean on wasm (no unused variant):
#[cfg(feature = "storage")]
#[error("storage error: {0}")]
Storage(String),
```

Because `storage` is **on by default**, the native crate and its public API are
unchanged (AC1, "native API unchanged"); `store.rs`'s tests come along with the
feature. The wasm consumer opts out with `default-features = false`.

**Checked invariants for the gate (architect confirmations).** `CrdtError::Storage`
is constructed only by `store::store_err`, and `tempfile` (a dev-dep) is used only
by `store.rs` tests — both already behind `mod store`'s feature gate — so the
`--no-default-features` wasm build pulls in neither and stays `-D warnings`-clean.
`automerge` is not target-gated (it builds for `wasm32`; its `rand`-using
`visualisation` module is non-default and inert). The very first wasm build runs
`cargo build -p mp-crdt --target wasm32-unknown-unknown --no-default-features`
(AC1) to confirm the transitive graph links — the one mechanical risk left open
(§5).

### 2.2 `mp-wasm`: expose the CRDT to JS (AC2, AC3)

Add the dependency. No new randomness backend is needed: `automerge 0.5`'s
`ActorId::random()` is implemented as `uuid::Uuid::new_v4()` (verified in
`automerge-0.5.12/src/types.rs`), and `mp-wasm` already enables `uuid`'s `js`
feature on `wasm32` (routing UUID entropy to Web Crypto). Cargo's cross-graph
feature unification means that one flag already covers automerge's actor RNG — so
adding a separate `getrandom` dep is both unnecessary and would trip an
unused-dependency lint:

```toml
# root Cargo.toml [workspace.dependencies] — add:
mp-crdt  = { path = "crates/mp-crdt" }

# crates/mp-wasm/Cargo.toml
[dependencies]
mp-crdt = { workspace = true, default-features = false }
# ...existing...

[target.'cfg(target_arch = "wasm32")'.dependencies]
uuid = { workspace = true, features = ["js"] }   # existing — also covers automerge's actor RNG
```

Two new `#[wasm_bindgen]` types, mirroring the thin-skin pattern of `WasmGraph`
(parse args, delegate to the core, marshal back; errors → `JsError`, never a
panic):

```rust
/// A syncable replica of the shareable graph state (wraps mp_crdt::CrdtDoc).
#[wasm_bindgen]
pub struct WasmCrdtDoc { inner: mp_crdt::CrdtDoc }

#[wasm_bindgen]
impl WasmCrdtDoc {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmCrdtDoc, JsError>;

    /// Add a plateau; returns the engine-assigned UUID (same signature as WasmGraph).
    pub fn add_plateau(&mut self, name:&str, domain:&str, e1:f32,e2:f32,e3:f32) -> Result<String,JsError>;
    /// Cast a grow-only vote (weight is caller-supplied f32 this phase, R-0004).
    pub fn vote(&mut self, resource:&str, wizard:&str, weight:f32) -> Result<(),JsError>;

    /// Project the replica into a queryable WasmGraph (for rendering + reachability).
    pub fn to_graph(&self) -> Result<WasmGraph, JsError>;
    /// The four root keys — for the AC7 "no reputation key" assertion in JS.
    pub fn root_keys(&self) -> Vec<String>;
    /// A resource's tally as a JS object { voters, weighted_sum }.
    pub fn resource_vote(&self, resource:&str) -> Result<JsValue, JsError>;

    /// The next sync message for the peer, or `undefined` at quiescence.
    pub fn generate_message(&mut self, s:&mut WasmSyncSession) -> Option<Vec<u8>>;
    /// Apply a peer's sync-message bytes.
    pub fn receive_message(&mut self, s:&mut WasmSyncSession, bytes:&[u8]) -> Result<(),JsError>;
}

/// One peer-pair's sync state (wraps mp_crdt::SyncSession).
#[wasm_bindgen]
pub struct WasmSyncSession { inner: mp_crdt::SyncSession }
#[wasm_bindgen]
impl WasmSyncSession { #[wasm_bindgen(constructor)] pub fn new() -> WasmSyncSession; }

// `new()` is infallible, so clippy's `new_without_default` fires under
// `-D warnings` (as it already does for `WasmGraph`). Provide a `Default`
// (mp_crdt::SyncSession already derives Default). `WasmCrdtDoc::new()` is
// *fallible* (-> Result), so the lint does not apply there.
impl Default for WasmSyncSession {
    fn default() -> Self { WasmSyncSession { inner: mp_crdt::SyncSession::default() } }
}
```

`generate_message`/`receive_message` take the session as an argument (rather than
the doc owning it) so a tab can hold one session per remote peer. `Vec<u8>`
crosses to JS as a `Uint8Array`; `&[u8]` accepts one back. `to_graph` reuses
`CrdtDoc::to_graph` (which already re-`validate()`s every entity) and wraps the
result in a `WasmGraph` via a new crate-internal `WasmGraph::from_inner(KnowledgeGraph)`
(not exported) — so rendering and the fog query run through the existing,
audited `WasmGraph::reachable_plateaus` path with **zero** duplicated logic.

**Two-tab transport model.** Automerge sync is point-to-point per `SyncSession`
state. With exactly two tabs over one `BroadcastChannel`, each tab keeps a single
`WasmSyncSession` and treats "the channel" as its one peer. Generalizing to N
peers (per-peer sessions keyed by peer id) is Phase 5; this POC asserts the
two-tab case only (matches AC3/AC6).

### 2.3 `apps/web`: the page (AC4–AC7)

Zero-build static ES modules (matching the existing `mp-wasm/www` harness), served
from the repo root or any static server. `wasm-pack build crates/mp-wasm --target
web --out-dir ../../apps/web/pkg` drops the bundle beside the app.

```
apps/web/
  index.html      ← canvas + a one-line "demo reputation is local, not real rank" note
  src/
    main.js       ← init wasm, build seed into a WasmCrdtDoc, wire render + input + sync
    project.js    ← pure: GA (e1,e2,e3) → 2D screen point (unit-testable, no wasm)
    render.js     ← draw plateaus (lit/fogged) + labelled bridges to <canvas>
    traverse.js   ← pure: accumulate the local demo reputation vector on click
    sync.js       ← BroadcastChannel ↔ WasmSyncSession pump
  pkg/            ← wasm-pack output (gitignored; produced by the build step)
```

**Projection (`project.js`, resolves R-0005 OQ "2D projection").** A fixed
isometric projection of the grade-1 position keeps all three GA axes visible and
is pure presentation — no graph invariant depends on it:

```
screen_x = cx + scale * ( e1 - 0.5 * e2 )
screen_y = cy + scale * ( e3 - 0.5 * e2 )      // y grows downward on canvas
```

(e1 → right, e3 → down, e2 → up-left depth.) `cx, cy, scale` fit the seed to the
canvas. Deterministic, so both tabs draw the same map.

**Render loop.** On any state change: `graph = doc.to_graph()`; compute
`reachable = graph.reachable_plateaus(localRepJson)`; draw each bridge as a line +
concept label, then each plateau as a disc at its projected point — **lit** if in
`reachable`, **fogged** (dimmed/low-alpha) otherwise.

**Traverse (`traverse.js`, AC5).** Click hit-tests the nearest lit plateau;
`traverse.js` adds `k * normalize(position)` into the tab-local reputation
multivector's grade-1 components (the same `{ domain_reps: { … : [8 floats] } }`
shape the Phase-2 harness builds by hand), then the render loop re-queries
reachability and fog lifts on newly-aligned plateaus. This vector is **local and
never synced** — an explicit Phase-8 stand-in, labelled in the UI.

**Sync (`sync.js`, AC6/AC7).** A single `BroadcastChannel("mp-graph-sync")`. A
small pump, identical in both tabs:

```js
function pump() {                       // after any local edit, and on each message
  let msg;
  while ((msg = doc.generate_message(session)) !== undefined)
    channel.postMessage(msg);           // Uint8Array — structured-clone transferable
}
channel.onmessage = (e) => { doc.receive_message(session, e.data); pump(); render(); };
```

The channel carries **only** `doc`-produced CRDT bytes (graph state). The local
reputation/fog state is never posted (AC7). After a local "add plateau" or "vote"
in tab A, `pump()` ships the change; tab B applies it, re-projects, re-renders;
both converge to the same plateau set and tally. A `doc.root_keys()` assertion in
`main.js` (logged once) confirms the synced doc carries exactly the four data
maps — no reputation key (AC7).

### 2.4 Data flow summary

```
click ─▶ traverse.js (local rep++) ─▶ render (reachability query)        [never synced]
add/vote ─▶ WasmCrdtDoc edit ─▶ pump() ─▶ BroadcastChannel ─▶ other tab  [CRDT bytes only]
                                   ▲                              │
                                   └──────── render ◀── receive ──┘
```

## 3. Code outline

```rust
// mp-wasm/src/lib.rs — representative
#[wasm_bindgen]
impl WasmCrdtDoc {
    pub fn to_graph(&self) -> Result<WasmGraph, JsError> {
        Ok(WasmGraph::from_inner(self.inner.to_graph()?))   // reuse audited projection
    }
    pub fn generate_message(&mut self, s: &mut WasmSyncSession) -> Option<Vec<u8>> {
        s.inner.generate_message(&mut self.inner)           // delegates to mp_crdt
    }
    pub fn receive_message(&mut self, s: &mut WasmSyncSession, bytes: &[u8]) -> Result<(), JsError> {
        s.inner.receive_message(&mut self.inner, bytes)?;
        Ok(())
    }
}

impl WasmGraph {
    pub(crate) fn from_inner(inner: KnowledgeGraph) -> WasmGraph { WasmGraph { inner } }
}
```

```rust
// mp-wasm/tests/web.rs — AC3, runs under `wasm-bindgen-test --node`
#[wasm_bindgen_test]
fn two_independent_replicas_sync_a_plateau_to_quiescence() {
    // Independently constructed (no shared base): this proves SPEC-0004's
    // deterministic genesis lets two fresh tabs converge — the non-obvious thing.
    let (mut a, mut b) = (WasmCrdtDoc::new().unwrap(), WasmCrdtDoc::new().unwrap());
    let (mut sa, mut sb) = (WasmSyncSession::new(), WasmSyncSession::new());
    let id = a.add_plateau("Linear Algebra", DOMAIN, 0.9, 0.1, 0.0).unwrap();
    for _ in 0..100 {                         // bounded pump
        let mut moved = false;
        if let Some(m) = a.generate_message(&mut sa) { b.receive_message(&mut sb, &m).unwrap(); moved = true; }
        if let Some(m) = b.generate_message(&mut sb) { a.receive_message(&mut sa, &m).unwrap(); moved = true; }
        if !moved { break; }
    }
    // `WasmGraph::plateau` returns a `JsValue` that is `NULL` for an unknown id
    // (it is not an `Option`), so the convergence predicate is "B's projection
    // contains A's plateau", mirroring mp-crdt `two_peer.rs`.
    let bg = b.to_graph().unwrap();
    assert!(!bg.plateau(&id).unwrap().is_null(), "B received A's plateau");
    assert_eq!(a.root_keys(), b.root_keys());   // same four data maps, converged shape
}
```
*(`unwrap()` is permitted in `#[cfg(test)]` / `tests/` per CLAUDE.md §5 — the no-unwrap rule governs library code.)*

```js
// apps/web/src/project.js — pure, unit-testable without wasm
export const project = ({e1, e2, e3}, {cx, cy, scale}) => ({
  x: cx + scale * (e1 - 0.5 * e2),
  y: cy + scale * (e3 - 0.5 * e2),
});
```

## 4. Non-goals

- 3D / Godot (Phase 6); AI companion (Phase 4); real relay/WebSocket/`tokio`
  networking (Phase 5 — `BroadcastChannel` is the two-tab stand-in); Nostr
  identity & real reputation (Phase 8); browser persistence (no IndexedDB/redb in
  the page); styling/accessibility/mobile/bundle-size polish (Phase 9).
- N-tab (>2) sync, per-peer session routing — Phase 5.
- Any change to `mp-graph`/`mp-reputation`. The only Rust edits are the `mp-crdt`
  feature-gate and the additive `mp-wasm` bindings.

## 5. Open questions

- **getrandom transitivity.** If `automerge 0.5` does not surface `getrandom`
  directly, the `js` feature may need enabling on the transitive crate (or via a
  `[patch]`/feature on `automerge`). Confirm at first wasm build; the fix is a
  one-line feature, not a design change. *(Mechanical; resolved in implementation.)*
- **`pkg/` in VCS.** Commit the generated `apps/web/pkg/` for a clone-and-open
  demo, or `.gitignore` it and document the `wasm-pack` build step? Lean
  `.gitignore` + a README build line; revisit if a hosted demo is wanted.

## 6. Acceptance criteria

- [ ] **AC1** → `cargo build -p mp-crdt --target wasm32-unknown-unknown
  --no-default-features` succeeds; native `cargo test --workspace` unchanged/green;
  `storage` default-on keeps the native API intact.
- [ ] **AC2** → `WasmCrdtDoc`/`WasmSyncSession` expose add/vote/read/root_keys/
  generate/receive; bad input → thrown `JsError`, no panic across the FFI.
- [ ] **AC3** → `wasm-bindgen-test` two-replica sync test: B ends with A's
  plateau, replicas agree. Runs under `wasm-bindgen-test --node`.
- [ ] **AC4** → `apps/web` loads wasm, builds the seed, draws plateaus at
  projected GA positions + labelled bridges; fogged vs lit driven by
  `reachable_plateaus`. Verified by load (no console errors) + a `project.js` unit
  test.
- [ ] **AC5** → clicking a lit plateau accumulates local reputation and clears fog
  on newly-reachable plateaus; reputation labelled a demo stand-in and not synced.
- [ ] **AC6** → two tabs converge after an edit in one; only CRDT bytes cross the
  `BroadcastChannel`; no server, no shared JS state.
- [ ] **AC7** → reputation never posted to the channel; `doc.root_keys()` ==
  {bridges, plateaus, resources, votes}.
- [ ] **AC8** → `cargo test --workspace` + `wasm-bindgen-test` green; clippy
  `-D warnings` clean on host **and** `wasm32-unknown-unknown`; fmt clean; no
  unwrap-without-SAFETY in library code; no panic across the WASM API; page loads
  clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Gate `redb`/`CrdtStore` behind a default-on `storage` feature (and gate `CrdtError::Storage`) rather than splitting `mp-crdt` | Lets wasm depend on the sync core with `--no-default-features` while the native API/crate boundary and `-D warnings` cleanliness are untouched (R-0005 OQ "binding feasibility") |
| 2026-05-31 | New `WasmCrdtDoc` + `WasmSyncSession` types; CRDT readers route through `to_graph()` → `WasmGraph` | The replica has sync lifecycle distinct from the query-only `WasmGraph`; projecting to a `WasmGraph` reuses the audited reachability path with no duplicated logic (R-0005 OQ "binding shape") |
| 2026-05-31 | Wasm entropy flows through `uuid`'s existing `js` feature; **no** new `getrandom` dep (architect finding) | `automerge 0.5`'s `ActorId::random()` is `uuid::Uuid::new_v4()`; `mp-wasm` already enables `uuid/js` on `wasm32`, and cargo feature-unification covers automerge's RNG. A separate `getrandom` dep is unnecessary and would trip an unused-dep lint (R-0005 OQ "wasm randomness") |
| 2026-05-31 | `WasmSyncSession` gets a `Default` impl (architect finding) | Its `new()` is infallible, so clippy `new_without_default` fires under `-D warnings` on host and `wasm32`; `WasmCrdtDoc::new()` is fallible so the lint does not apply there |
| 2026-05-31 | Fixed isometric projection `x=e1−0.5e2`, `y=e3−0.5e2` | Shows all three GA axes, deterministic across tabs, pure presentation — no invariant depends on it (R-0005 OQ "2D projection") |
| 2026-05-31 | `apps/web` is zero-build static ES modules; `wasm-pack --out-dir apps/web/pkg` | Matches the existing harness, no toolchain to maintain for a POC; `apps/web` is the roadmap's eventual served-world home (R-0005 OQ "app home & build") |
| 2026-05-31 | Two-tab transport via one `BroadcastChannel` + one `WasmSyncSession` per tab | Same-origin, serverless stand-in for the Phase-5 relay; exercises the real sync protocol (the AC3 path); N-peer routing deferred |
| 2026-05-31 (impl) | `mp-crdt` itself enables `uuid`'s `js` feature on `wasm32` (target-gated), in addition to `mp-wasm` | Makes AC1's `cargo build -p mp-crdt --target wasm32-unknown-unknown --no-default-features` link *standalone* (its `Uuid::new_v4`/`ActorId::random` need a wasm entropy source even without the `mp-wasm` consumer present). One target-gated line in `mp-crdt/Cargo.toml`; native builds unaffected |
| 2026-05-31 (impl) | Added additive marshalling to satisfy AC4 not covered by the original method list: `WasmGraph::plateaus()`/`bridges()` (enumerate the full set as DTOs), `WasmCrdtDoc::add_bridge(from,to,concept)` (seed bridges into the synced `bridges` map) | AC4 requires drawing *all* plateaus (lit **and** fogged) + labelled bridges from the synced state, but the accepted surface exposed only `reachable_plateaus` (lit ids) and no bridge writer/reader on the doc. These are thin DTO marshalling wrappers (no new graph/GA logic), consistent with §2.2's thin-skin pattern |
| 2026-05-31 (impl) | Deterministic seed: `WasmCrdtDoc::seed_plateau(id,…)` / `seed_bridge(id,…)` take a caller-supplied id; the page seeds a fixed id set | Both tabs seed independently (no shared base); with random ids the seed would *double* on merge. Caller-supplied ids make the seed entries identical keys so they merge to one shared map. `PlateauNode::new`/`Bridge::between` still enforce the GA invariants; user-authored adds keep using `add_plateau`/`add_bridge` (fresh ids). Verified in-browser: a fresh peer converged to exactly 6 plateaus / 6 bridges, no doubling |

## Changelog

- 2026-05-31 created (Draft) — pending architect design review, then status → Accepted
- 2026-05-31 architect design review → APPROVE WITH CHANGES. Folded in: (1) dropped
  the unnecessary `getrandom` dep — automerge's actor RNG flows through `uuid`'s
  existing `js` feature; (2) corrected the AC3 test sketch (`WasmGraph::plateau`
  returns a `JsValue` that is `NULL` for unknown ids, so assert `!is_null()` +
  independent-replica framing); (3) added `Default for WasmSyncSession`
  (`new_without_default` under `-D warnings`). Confirmations (no design change):
  `CrdtError::Storage`/`tempfile` gate cleanliness, automerge wasm build, §7
  fidelity via `root_keys()` + the data-flow separation. Status Draft → Accepted
- 2026-05-31 implemented — `mp-crdt` `storage` feature-gate; `mp-wasm` gains
  `WasmCrdtDoc` + `WasmSyncSession` (+ additive `WasmGraph::plateaus()/bridges()`,
  doc `add_bridge`/`seed_plateau`/`seed_bridge` for AC4 + a non-doubling seed);
  `apps/web` fog-world page. Gates green: native `cargo test --workspace` (59
  tests), `wasm-pack test --node` (4, incl. the AC3 two-replica sync), clippy
  `-D warnings` on host **and** `wasm32` (mp-wasm + mp-crdt `--no-default-features`),
  fmt, `project.js` unit test (node). In-browser verification (AC4–AC7): page
  loads clean (no console errors), renders 5 plateaus + 5 labelled bridges with
  only the entry plateau lit, traverse lifts fog 1→3→5, a fresh peer converged
  over the real `BroadcastChannel` to 6/6 with no doubling, and the channel
  carried only `Uint8Array` CRDT bytes with `root_keys` == the four data maps.
  See decision-log `(impl)` rows. Pending architect PR review + QA sign-off.
