# REQUIREMENTS — A Million Plateaus

## 1. Functional Requirements

### 1.1 Knowledge Graph Core (mp-graph crate)

| ID | Requirement |
|---|---|
| KG-01 | System SHALL represent knowledge domains as `PlateauNode` entities with unique IDs, name, domain, and GA position multivector |
| KG-02 | System SHALL represent conceptual relationships as `Bridge` edges carrying a GA rotor encoding orientation and grade |
| KG-03 | System SHALL support bridge grades: Grade-1 (prerequisite/directed), Grade-2 (lateral/peer), Grade-3 (deep synthesis) |
| KG-04 | System SHALL expose BFS/DFS traversal filtered by wizard reputation projection |
| KG-05 | System SHALL compute plateau reachability via inner product of wizard reputation multivector against plateau domain vector |
| KG-06 | System SHALL support adding, removing, and updating plateaus and bridges |
| KG-07 | System SHALL persist graph state locally via `redb` embedded database |
| KG-08 | System SHALL serialize/deserialize full graph state via `serde` + `bincode` |
| KG-09 | System SHALL expose the graph via a WASM-compatible API for browser clients |

### 1.2 Geometric Algebra Layer (garust integration)

| ID | Requirement |
|---|---|
| GA-01 | All positional data in the knowledge graph SHALL use `garust` Multivector types in G(3,0,0) |
| GA-02 | Bridge orientation SHALL be encoded as a GA rotor |
| GA-03 | Wizard reputation SHALL be stored as a domain-scoped Multivector (not a scalar) |
| GA-04 | Reputation propagation SHALL use the rotor sandwich product: `R * reputation * R.reverse()` |
| GA-05 | Fog/reachability threshold SHALL be computed via `wizard_rep.inner_product(plateau_position).scalar_part()` |
| GA-06 | Plateau-to-plateau geodesic interpolation SHALL use rotor slerp for Alebrije flight paths |
| GA-07 | Grade filtering SHALL be used to classify bridge types (grade of dominant component) |

### 1.3 Reputation System (mp-reputation crate)

| ID | Requirement |
|---|---|
| REP-01 | Wizard reputation SHALL be a `HashMap<DomainId, Multivector>` — domain-scoped, not global |
| REP-02 | Reputation propagation SHALL implement GA-weighted Eigentrust: voucher's rotor rotates reputation before transfer |
| REP-03 | System SHALL detect and penalize Sybil clusters via grade-collapse detection (scalar-only reputation = low trust) |
| REP-04 | High-grade multivector components (bivector/trivector) SHALL only accumulate via genuine cross-domain contributions |
| REP-05 | Wizard rank SHALL be queryable per domain, returning a sorted list by scalar + grade-weighted norm |
| REP-06 | All reputation changes SHALL be logged as immutable events for auditability |

### 1.4 CRDT Sync Layer (mp-crdt crate)

| ID | Requirement |
|---|---|
| CRDT-01 | Graph state SHALL be represented as an Automerge CRDT document |
| CRDT-02 | System SHALL support offline-first operation — all reads/writes work without network |
| CRDT-03 | Sync SHALL be peer-to-peer, no central authority required |
| CRDT-04 | Conflict resolution SHALL be deterministic via CRDT merge semantics |
| CRDT-05 | Resource votes SHALL be CRDT-compatible (grow-only counter per resource) |
| CRDT-06 | Plateau additions SHALL be idempotent across peers |

### 1.5 Multiplayer Layer (apps/server)

| ID | Requirement |
|---|---|
| MP-01 | Server SHALL use Colyseus for authoritative room/state management |
| MP-02 | Players SHALL see other travelers as presence markers in the 3D world |
| MP-03 | Server SHALL broadcast plateau entry/exit events to room participants |
| MP-04 | Trail markers SHALL sync across connected peers via the CRDT layer |
| MP-05 | Wizard discovery (finding high-rank wizards in a domain) SHALL be server-queryable |

### 1.6 Alebrije AI Companion (apps/alebrije)

| ID | Requirement |
|---|---|
| AL-01 | Each player SHALL have one Alebrije with persistent local state |
| AL-02 | Alebrije SHALL be visually assembled from combinatorial creature components |
| AL-03 | Alebrije visual state SHALL evolve based on traversal history (new features per plateau mastered) |
| AL-04 | Alebrije AI SHALL call Claude API with: current plateau system prompt + player traversal history context |
| AL-05 | Alebrije SHALL speak in-world voice, not chatbot voice |
| AL-06 | Alebrije SHALL suggest next plateaus based on player's current reputation multivector shape |
| AL-07 | Alebrije state (creature config, traversal log, local graph) SHALL be local-first, player-owned |
| AL-08 | Players SHALL be able to combine, customize, and name their Alebrije |

### 1.7 3D World Renderer (apps/web)

| ID | Requirement |
|---|---|
| WEB-01 | Browser client SHALL render plateaus as floating island geometry via Three.js |
| WEB-02 | Bridges SHALL be rendered as visible connecting structures with concept labels |
| WEB-03 | Fog SHALL obscure unreachable plateaus with distance-based rendering |
| WEB-04 | Resources SHALL be rendered as 3D objects whose visual mass grows with vote count |
| WEB-05 | Alebrije SHALL be rendered as a 3D customizable creature accompanying the player |
| WEB-06 | Godot WASM export SHALL be the primary 3D engine target |
| WEB-07 | Client SHALL load graph state from local CRDT store, not a central API |

### 1.8 Resource Crystallization

| ID | Requirement |
|---|---|
| RES-01 | Any wizard SHALL be able to contribute a resource (link, text, video, interactive) to a plateau |
| RES-02 | Resources SHALL start as uncrystallized (floating, low visibility) |
| RES-03 | Votes (stone placements) SHALL increment a CRDT grow-only counter |
| RES-04 | Resources crossing a vote threshold SHALL transition to crystallized state (permanent terrain) |
| RES-05 | Resources below a decay threshold SHALL dissolve (archived, not deleted) |
| RES-06 | Resource quality score SHALL factor voter wizard rank (weighted by domain reputation) |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| ID | Requirement |
|---|---|
| PERF-01 | Graph traversal (BFS to depth 3) SHALL complete in < 10ms for graphs up to 10,000 nodes |
| PERF-02 | GA operations (rotor sandwich, inner product) SHALL use garust's existing optimized paths |
| PERF-03 | WASM bundle SHALL be < 5MB gzipped for browser delivery |
| PERF-04 | Local DB read latency SHALL be < 1ms for single node lookup (redb) |
| PERF-05 | 3D renderer SHALL maintain 60fps for scenes up to 500 simultaneous plateau objects |

### 2.2 Reliability

| ID | Requirement |
|---|---|
| REL-01 | System SHALL operate fully offline — no network = no data loss |
| REL-02 | CRDT merges SHALL never produce data loss on reconnect |
| REL-03 | All Rust crates SHALL have > 80% test coverage on public API |
| REL-04 | Graph serialization SHALL be versioned for forward compatibility |

### 2.3 Security

| ID | Requirement |
|---|---|
| SEC-01 | Wizard identity SHALL use public-key cryptography (Nostr keypair or similar) |
| SEC-02 | Resource contributions SHALL be signed by contributor's key |
| SEC-03 | Reputation multivectors SHALL not be directly user-writable — computed only from signed events |
| SEC-04 | Sybil resistance SHALL be enforced via grade-collapse detection in mp-reputation |

### 2.4 Portability

| ID | Requirement |
|---|---|
| PORT-01 | mp-graph, mp-crdt, mp-reputation SHALL compile to WASM (wasm32-unknown-unknown) |
| PORT-02 | apps/server SHALL run on Node.js 20+ |
| PORT-03 | apps/web SHALL run in any WebGL2-capable browser |
| PORT-04 | VR export SHALL be achievable via Godot OpenXR without core architecture changes |

### 2.5 Extensibility

| ID | Requirement |
|---|---|
| EXT-01 | New plateau domains SHALL be addable without code changes (data-driven) |
| EXT-02 | New Alebrije creature components SHALL be addable via asset + config |
| EXT-03 | Alternative renderers (mobile 2D map, terminal) SHALL be implementable against the same graph API |
| EXT-04 | The reputation algorithm SHALL be swappable via trait object |
