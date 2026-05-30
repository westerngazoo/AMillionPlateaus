# SDLC — A Million Plateaus

## Methodology

**Incremental local-first.** Each phase produces a working, runnable artifact. No phase is "just planning." The graph is the integration point — all components connect through it.

---

## Phase 0 — Foundation (Weeks 1–2)

**Goal:** Cargo workspace compiles. garust linked. Core types defined.

### Tasks

- [ ] Init Cargo workspace with `[workspace]` in root `Cargo.toml`
- [ ] Create crate skeletons: `mp-graph`, `mp-reputation`, `mp-crdt`, `mp-wasm`
- [ ] Add `garust` as path dependency in workspace
- [ ] Implement all types in `GRAPH_SCHEMA.md` — compile-clean
- [ ] Implement `KnowledgeGraph::add_plateau`, `add_bridge`, `plateau()`
- [ ] Write redb persistence wrapper (`GraphDb`) — save/load round-trip
- [ ] 100% unit test coverage on `PlateauNode` construction invariants
- [ ] Seed graph: 5 plateaus, 4 bridges (hardcoded, for testing)

### Deliverable

```
cargo test --workspace  → all green
cargo run --example seed_graph → prints plateau list + bridges
```

---

## Phase 1 — GA Reputation (Weeks 3–4)

**Goal:** Wizard rank computed via GA Eigentrust. Fog mechanic works.

### Tasks

- [ ] Implement `WizardReputation` with `HashMap<DomainId, Multivector>`
- [ ] Implement `ReputationEngine::propagate()` — rotor sandwich transfer
- [ ] Implement grade-collapse Sybil detection
- [ ] Implement `KnowledgeGraph::is_reachable()` via inner product threshold
- [ ] Implement `KnowledgeGraph::reachable_plateaus()` — fog query
- [ ] Unit tests: Sybil cluster produces only scalar reputation (grade 0)
- [ ] Unit tests: cross-domain wizard accumulates bivector components
- [ ] Integration test: seed wizard traverses 3 plateaus, fog lifts on 3 others

### Deliverable

```
cargo test -p mp-reputation  → all green including Sybil test
cargo run --example fog_demo → prints reachable plateaus for test wizard
```

---

## Phase 2 — WASM Bridge (Weeks 5–6)

**Goal:** Graph queryable from JavaScript in browser.

### Tasks

- [ ] Add `wasm-bindgen` + `serde-wasm-bindgen` to `mp-wasm`
- [ ] Expose: `add_plateau()`, `add_bridge()`, `reachable_plateaus()`, `is_reachable()`
- [ ] Build WASM target: `wasm-pack build mp-wasm --target web`
- [ ] Write minimal HTML harness that loads WASM and calls graph functions
- [ ] Verify bundle size < 5MB gzipped
- [ ] Document JS API in `specs/API_CONTRACTS.md`

### Deliverable

```
wasm-pack build → mp-wasm/pkg/ generated
open harness.html → browser console shows plateau list
```

---

## Phase 3 — CRDT Sync (Weeks 7–8)

**Goal:** Two clients sync graph state without central server.

### Tasks

- [ ] Implement `CrdtDoc` wrapping Automerge document
- [ ] Implement plateau/bridge/resource as Automerge map entries
- [ ] Implement `ResourceVote` as grow-only counter
- [ ] Implement `SyncSession` — serialize changes, apply remote changes
- [ ] Write two-process integration test: peer A adds plateau, peer B receives it
- [ ] Verify conflict resolution: simultaneous edits merge correctly
- [ ] Connect CRDT to redb: load from DB, merge incoming, persist result

### Deliverable

```
cargo test -p mp-crdt → all green including two-peer sync test
```

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
