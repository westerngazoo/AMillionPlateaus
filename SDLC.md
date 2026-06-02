# SDLC — A Million Plateaus

## Methodology

**Incremental local-first.** Each phase produces a working, runnable artifact. No phase is "just planning." The graph is the integration point — all components connect through it.

---

## Phase 0 — Foundation (Weeks 1–2)

**Goal:** Cargo workspace compiles. garust linked. Core types defined.

### Tasks  — realized by SPEC-0001 (R-0001)

- [x] Init Cargo workspace with `[workspace]` in root `Cargo.toml`
- [x] Create crate skeletons: `mp-graph`, `mp-reputation`, `mp-crdt`, `mp-wasm`
- [x] Add `garust` as path dependency in workspace (`../garust`)
- [x] Implement all types in `GRAPH_SCHEMA.md` — compile-clean
- [x] Implement `KnowledgeGraph::add_plateau`, `add_bridge`, `plateau()`
- [x] Write redb persistence wrapper (`GraphDb`) — save/load round-trip
- [x] Unit test coverage on `PlateauNode` / `Bridge` construction invariants
- [x] Seed graph: 5 plateaus, 4 bridges (hardcoded, for testing)

> **Done 2026-05-30.** `cargo test --workspace` → 14 passed; `cargo clippy
> --workspace --all-targets -- -D warnings` clean; `cargo run -p mp-graph
> --example seed_graph` prints 5 plateaus + 4 bridges. garust's real API differs
> from GARUST_INTEGRATION.md — bridged by the `mp_graph::ga` adapter (see that
> doc's §8 note). Remaining: architect review of SPEC-0001 + `qa` sign-off on
> R-0001 before Phase 0 is formally closed.

### Deliverable

```
cargo test --workspace  → all green
cargo run --example seed_graph → prints plateau list + bridges
```

---

## Phase 1 — GA Reputation (Weeks 3–4)

**Goal:** Wizard rank computed via GA Eigentrust. Fog mechanic works.

### Tasks  — realized by SPEC-0002 (R-0002)

- [x] Implement `WizardReputation` with `HashMap<DomainId, Multivector>`
- [x] Implement `ReputationEngine::propagate()` — rotor sandwich transfer
- [x] Implement grade-collapse Sybil detection
- [x] Implement `KnowledgeGraph::is_reachable()` via inner product threshold
- [x] Implement `KnowledgeGraph::reachable_plateaus()` — fog query
- [x] Unit tests: Sybil cluster produces only scalar reputation (grade 0)
- [x] Unit tests: cross-domain wizard accumulates bivector components
- [x] Integration test: seed wizard traverses, fog lifts on aligned plateaus

### Deliverable

```
cargo test -p mp-reputation  → all green including Sybil test
cargo run --example fog_demo → prints reachable plateaus for test wizard
```

> **Done 2026-05-30.** R-0002 **Met** / SPEC-0002 **Implemented**. `cargo test
> --workspace` → 30 passed (18 mp-graph + 11 mp-reputation + 1 fog integration);
> clippy `-D warnings` clean; fmt clean. `fog_demo` prints 0 → 4 → 5 reachable
> (Music Theory correctly stays fogged after math-only work). Architect approved
> the design (APPROVE WITH CHANGES, all folded in); `qa` signed off on every
> AC1–AC8. Sybil resistance is doubly enforced: grade-collapse under the rotor
> sandwich *and* the fog projection (Hestenes `inner` zeroes scalar reputation).

---

## Phase 2 — WASM Bridge (Weeks 5–6)

**Goal:** Graph queryable from JavaScript in browser.

### Tasks  — realized by SPEC-0003 (R-0003)

- [x] Add `wasm-bindgen` + `serde-wasm-bindgen` to `mp-wasm`
- [x] Expose: `add_plateau()`, `add_bridge()`, `reachable_plateaus()`, `is_reachable()` (+ `plateau()`)
- [x] Build WASM target: `wasm-pack build mp-wasm --target web`
- [x] Write minimal HTML harness that loads WASM and calls graph functions
- [x] Verify bundle size < 5MB gzipped
- [x] Document JS API in `API_CONTRACTS.md`

### Deliverable

```
wasm-pack build → mp-wasm/pkg/ generated
open harness.html → browser console shows plateau list
```

> **Done 2026-05-30.** R-0003 **Met** / SPEC-0003 **Implemented**. `cargo test
> --workspace` → 41 passed (18 mp-graph + 11 mp-reputation + 1 fog + 11 mp-wasm);
> `wasm-pack test --node` → 3 wasm smoke tests pass; clippy `-D warnings` + fmt
> clean on host and the `wasm32-unknown-unknown` target. `wasm-pack build
> --target web` emits a 137 KB `.wasm` (63 KB gzipped, ≪ 5 MB) + JS glue + `.d.ts`.
> `www/harness.html` builds the 5-plateau seed and lifts fog in-browser: 0 →
> 4 reachable after a Linear-Algebra traversal (Music Theory stays fogged), and
> a magnitude-1000 scalar-only Sybil reputation still sees 0 — the Sybil/fog
> property holds client-side. Design split: pure host-testable `convert.rs` +
> thin `#[wasm_bindgen]` `lib.rs`. Architect approved the design; `qa` signed off
> on every AC1–AC8. One core fix: `mp_graph::types::now_unix` is now wasm-safe
> (`SystemTime::now()` panics on wasm32) to keep panics off the FFI.

---

## Phase 3 — CRDT Sync (Weeks 7–8)

**Goal:** Two clients sync graph state without central server.

### Tasks  — realized by SPEC-0004 (R-0004)

- [x] Implement `CrdtDoc` wrapping Automerge document
- [x] Implement plateau/bridge/resource as Automerge map entries
- [x] Implement `ResourceVote` as grow-only counter
- [x] Implement `SyncSession` — serialize changes, apply remote changes
- [x] Write two-process integration test: peer A adds plateau, peer B receives it
- [x] Verify conflict resolution: simultaneous edits merge correctly
- [x] Connect CRDT to redb: load from DB, merge incoming, persist result

### Deliverable

```
cargo test -p mp-crdt → all green including two-peer sync test
```

> **Done 2026-05-31.** R-0004 **Met** / SPEC-0004 **Implemented**. `cargo test
> --workspace` → 59 host tests green (18 mp-graph + 11 mp-reputation + 1 fog +
> 11 mp-wasm + 12 mp-crdt unit + 6 two-peer); clippy `-D warnings` + fmt clean.
> `CrdtDoc` wraps Automerge with exactly four root maps {plateaus, bridges,
> resources, votes} — reputation deliberately absent (CLAUDE.md §7;
> `mp-crdt` has no `mp-reputation` dep, asserted by a test). Two-peer sync
> converges over opaque byte messages; concurrent distinct edits merge to the
> union, order-independent (equal `get_heads()`). Persistence via a dedicated
> redb table (`CrdtStore`); load→merge→persist→reload round-trips. Two
> object-creation hazards solved: a deterministic genesis change (fixed actor,
> time 0) so independently-bootstrapped replicas share root object ids, and a
> flat composite-key `votes` map. `qa` caught one AC3 defect — same-wizard
> concurrent votes merged as Automerge LWW-by-actor and silently dropped the
> higher weight; fixed with single-writer per-`(resource,wizard,actor)` cells
> + max-on-read, then re-verified. Architect approved the design; `qa` signed
> off on AC1–AC8.

---

## POC — Web fog-world (vertical slice across Phases 0–3)

**Goal:** A playable, shareable static web page that makes the core idea legible:
the knowledge graph drawn *as geometry*, fog that lifts on traverse, and
serverless convergence between two browser tabs — all from the existing audited
Rust core. Pulled ahead of Phase 4 to stand up the first browser-CRDT plumbing.

### Tasks — realized by SPEC-0005 (R-0005)

- [x] Feature-gate `redb`/`CrdtStore` behind a default-on `storage` feature so
      `mp-crdt` builds for `wasm32` with `--no-default-features`
- [x] Expose the CRDT to JS: `WasmCrdtDoc` + `WasmSyncSession` bindings in
      `mp-wasm` (+ additive `WasmGraph::plateaus()/bridges()` and
      `add_bridge`/`seed_plateau`/`seed_bridge` for rendering + a non-doubling seed)
- [x] AC3 `wasm-bindgen-test`: two independent replicas converge over the byte API
- [x] `apps/web` static page: render geometry + labelled bridges, fog vs lit
- [x] Click-to-traverse lifts fog (local, un-synced demo reputation)
- [x] Two-tab sync over `BroadcastChannel` (CRDT bytes only)

### Deliverable

```
apps/web → open in two tabs; an edit in one converges in the other, no server
```

> **Done 2026-05-31.** R-0005 **Met** / SPEC-0005 **Implemented**. `cargo test
> --workspace` → 59 host tests green; `wasm-pack test --node` → 4 wasm tests
> (incl. the AC3 two-replica sync); clippy `-D warnings` clean on host **and**
> `wasm32` (mp-wasm + mp-crdt `--no-default-features`); fmt clean; `project.js`
> node unit test green. `redb`/`CrdtStore`/`CrdtError::Storage` gated behind a
> default-on `storage` feature (native API unchanged); wasm randomness flows
> through `uuid`'s `js` feature — no `getrandom` dep. `mp-wasm` stays a thin skin
> (all branching in the host-tested `convert.rs`); the CRDT reader routes through
> the audited `CrdtDoc::to_graph` → `WasmGraph`. Verified in-browser: the page
> loads clean, draws 5 plateaus + 5 labelled bridges with only the entry lit, fog
> lifts on traverse (1→3→5), and a fresh peer converges over `BroadcastChannel`
> to a **non-doubled** 6/6 map carrying only `Uint8Array` bytes — reputation never
> on the wire, `root_keys` == {bridges, plateaus, resources, votes} (CLAUDE.md §7).
> Architect approved the PR; `qa` signed off on AC1–AC8.

---

## Phase 4 — Alebrije Service (Weeks 9–10)

**Goal:** AI companion works with plateau-specific context.

### Tasks

- [ ] Init `apps/alebrije` — Node.js 20 + TypeScript + Anthropic SDK
- [ ] Implement `context-builder.ts` — builds system prompt from request
- [ ] Create `plateau-prompts.ts` with 10 initial plateau entries
- [ ] Implement `companion.ts` — Claude API call, 256 token response
- [ ] Implement `creature-voice.ts` — maps component archetypes to voice style
- [ ] Add REST endpoint: `POST /alebrije/ask`
- [ ] Test: 3 different plateaus produce distinct Alebrije voices
- [ ] Test: traversal history changes Alebrije suggestions

### Deliverable

```
cd apps/alebrije && npm run dev
curl -X POST /alebrije/ask -d '{"plateau_id":"geometric-algebra",...}'
→ short evocative response in alebrije voice
```

---

## Phase 5 — Multiplayer Presence (Weeks 11–12)

**Goal:** Two browsers show each other on the same plateau.

### Tasks

- [ ] Init `apps/server` — Colyseus + Express + TypeScript
- [ ] Implement `PlateauRoom` — join/leave, wizard presence state
- [ ] Implement `WildRoom` — open world, broadcast flight positions
- [ ] Implement REST: `GET /wizards/:domainId/top`
- [ ] Implement REST: `GET /plateaus/:id/presence`
- [ ] Connect Gun.js relay for CRDT byte sync between peers
- [ ] Client-side: display other wizard silhouettes (placeholder geometry)

### Deliverable

```
Two browser tabs open → both see each other's presence on same plateau
```

---

## Phase 6 — 3D World (Weeks 13–18)

**Goal:** Navigable 3D world in browser. Fog visible. Bridges visible.

### Tasks

- [ ] Init Godot 4 project in `apps/godot/`
- [ ] Implement `PlateauManager` scene — spawn island geometry per PlateauNode
- [ ] Implement `BridgeRenderer` — connect islands with bridge geometry + label
- [ ] Implement `FogController` — shader-based fog driven by reachability
- [ ] Implement `AlebrijeRig` — 3D creature with component-based mesh assembly
- [ ] Implement `ResourceLayer` — floating/crystallized resource objects
- [ ] Export Godot → WASM, serve from `apps/web`
- [ ] Connect Godot to mp-wasm via JS bridge
- [ ] Connect Godot to Colyseus client for presence
- [ ] Connect Godot to Alebrije REST API for companion dialogue

### Deliverable

```
Browser loads world → 5 plateaus visible/fogged → player flies between them
→ Alebrije speaks when player enters plateau
→ Resource objects visible on each plateau
```

---

## Phase 7 — Resource Crystallization UI (Weeks 19–20)

**Goal:** Players contribute and vote on resources. Visual state changes.

### Tasks

- [ ] Implement resource contribution UI (floating form in world)
- [ ] Implement vote mechanic — place glowing stone on resource object
- [ ] CRDT vote counter syncs between connected peers
- [ ] Resource visual size = log(weighted_vote_count) — grows in real-time
- [ ] State transition: Floating → Crystallizing → Crystallized — visual changes
- [ ] Archive flow for decayed resources

### Deliverable

```
Player contributes resource → other player sees it floating
Both vote → resource grows → threshold crossed → resource crystallizes into terrain
```

---

## Phase 8 — Nostr Identity + Signed Events (Weeks 21–22)

**Goal:** Wizard identity is a keypair. All actions are signed. Reputation is verifiable.

### Tasks

- [ ] Integrate `nostr-tools` in browser client — keygen, signing
- [ ] All traversal events signed → submitted to Nostr relay
- [ ] All resource votes signed → submitted to Nostr relay
- [ ] Reputation recomputed from Nostr event log — replaces synthetic rep
- [ ] Wizard discovery: query Nostr for top traversal events per domain
- [ ] Verify: Sybil cluster of fake keys cannot inflate grade > 0 reputation

### Deliverable

```
Fresh wizard key → traverses 3 plateaus → signs events
Another client receives events → computes same reputation multivector
Sybil cluster test: 10 colluding keys → all stuck at Grade 0
```

---

## Phase 9 — Polish + Beta (Weeks 23–26)

**Goal:** Playable, shareable, documented.

### Tasks

- [ ] Alebrije customization UI — pick creature components at evolution points
- [ ] Trail markers — place personal notes in 3D space
- [ ] Wizard profile page — reputation multivector visualization
- [ ] Onboarding flow — Alebrije guides new player through first plateau
- [ ] 20 plateaus in the seed graph with rich descriptions
- [ ] 40 bridge connections with concept labels
- [ ] Load testing: 50 concurrent Colyseus connections
- [ ] WASM bundle optimization — target < 3MB gzipped
- [ ] Accessibility: keyboard navigation, screen reader for Alebrije dialogue
- [ ] Deploy: Fly.io (server) + Cloudflare Pages (web) + Pinata (IPFS)

---

## Testing Strategy

| Layer | Framework | Coverage target |
|---|---|---|
| mp-graph (Rust) | `cargo test` | 85% |
| mp-reputation (Rust) | `cargo test` | 90% |
| mp-crdt (Rust) | `cargo test` | 80% |
| mp-wasm (integration) | Playwright | key user flows |
| apps/alebrije (Node) | Vitest | 70% |
| apps/server (Node) | Vitest | 75% |
| E2E (browser) | Playwright | 5 critical flows |

---

## Definition of Done (per phase)

1. All tasks checked
2. Tests pass at coverage target
3. No `unwrap()` without comment explaining why it's safe
4. PR description written as if handing to another engineer
5. CLAUDE.md updated with any new patterns or gotchas
