# SPEC-0010 — Wizard identity: Nostr-signed events and recomputed, verifiable rank

- **Status:** Implemented
- **Realizes:** R-0010
- **Author:** Claude
- **Created:** 2026-06-02
- **Depends on:** SPEC-0002 (GA reputation + fog), SPEC-0003 (mp-wasm bridge), SPEC-0004 (mp-crdt), SPEC-0005 (web fog-world), SPEC-0006/0009 (persona orientation this rank earns past)
- **Module(s):** new crate `mp-identity` (pure); `mp-wasm` (thin exports); `apps/web` (transport + UI). **No change to `mp-graph`, `mp-reputation`, `mp-crdt`, `mp-domain` types.**

## 1. Motivation

Realizes R-0010. Today reach is **seeded**: `seedReputation(persona)` hands the
visitor a fixed-magnitude grade-1 multivector and the world lights. Phase 8 makes
rank **earned and verifiable**: the visitor holds a **Nostr keypair**, the
reputation-bearing actions (**traverse**, **vouch/vote**) are emitted as
**Nostr-signed events**, and reputation is **recomputed deterministically from
the verified event log** through the **unchanged** `mp-reputation` engine. The
recompute output is the **same `{domain_reps, synthesis}` JSON** that
`reachable_plateaus`/`nearest_plateaus` already consume — so everything
downstream of reputation is untouched; only its *source* changes from a synthetic
seed to a signed, verifiable history. Identities and events are **discoverable**
via a Nostr relay (publish/subscribe + top-traversers-per-domain), and the world
stays fully playable **offline**.

The decisive design facts (from the seam map):

- Reputation already crosses the wasm boundary as JSON
  (`convert::parse_reputation` → `WizardReputation`); the engine
  (`record_traversal`, `propagate`, `recompute_synthesis`) is pure Rust and
  domain-keyed by `Mv`. **Recompute can be a pure function over a verified event
  log that drives this engine and emits the same JSON.**
- The Sybil property (AC5) is exactly the **grade collapse** of mutual vouching
  already proven in `mp-reputation/src/sybil.rs`: a clique that only
  `propagate`s to one another never exceeds grade 0. A signed **vouch** event
  maps onto `propagate`; the Sybil test becomes "N fake keys signing mutual
  vouch events stay grade 0."
- `apps/web` is a **bundler-less static site** importing ES modules + a
  `wasm-pack` bundle. Vendoring a large JS crypto lib is avoidable: **all crypto
  (keygen, sign, verify) and recompute live in Rust** (`mp-identity`, exposed via
  `mp-wasm`); JS only ferries event JSON over transport and renders UI. This
  keeps the whole crypto+GA pipeline in **audited, host-testable Rust** and
  satisfies AC8's "pure mapping, no relay/network" tests.
- `Resource.signature: String` and `Bridge.created_by: WizardId` already exist as
  Phase-8 placeholders, and `CrdtDoc.root_keys()` already **asserts** exactly
  `{bridges, plateaus, resources, votes}` — the §7 guard rail is already in code.

## 2. Design

### 2.1 Crate boundary — `mp-identity` (new, pure, host-tested)

A pure crate (no wasm, no network, `cargo test`-able) that owns **everything
security- and reputation-critical**, so a forged event is rejected by audited
code and rank is computed by the audited engine:

```rust
// mp-identity/src/lib.rs — pub use re-exports only
// keys.rs, event.rs, verify.rs, recompute.rs, error.rs, tests/

/// BIP340 Schnorr over secp256k1 (the Nostr scheme), via the pure-Rust k256.
pub struct Keypair { /* secret scalar + x-only pubkey */ }
impl Keypair {
    pub fn generate() -> Self;                       // getrandom
    pub fn from_secret_hex(hex: &str) -> Result<Self, IdError>;
    pub fn secret_hex(&self) -> String;              // LOCAL persistence only — never synced/logged
    pub fn pubkey_hex(&self) -> String;              // 32-byte x-only, the stable wizard id
}

/// A Nostr event (NIP-01 shape): id = sha256(canonical serialization),
/// sig = BIP340 Schnorr by `pubkey` over `id`.
pub struct NostrEvent {
    pub id: String, pub pubkey: String, pub created_at: u64,
    pub kind: u32, pub tags: Vec<Vec<String>>, pub content: String, pub sig: String,
}

/// Our two reputation-bearing kinds (NIP-ranged, app-specific).
pub const KIND_TRAVERSAL: u32 = 30078; // parameterized-replaceable app data range
pub const KIND_VOUCH: u32 = 30079;

/// content payloads (serde) — self-contained so recompute needs no graph (AC8):
///   Traversal { domain: Uuid, e1: f32, e2: f32, e3: f32, depth: f32, plateau: Option<Uuid> }
///   Vouch     { domain: Uuid, vouched: String /*pubkey hex*/, from: [f32;3], to: [f32;3] }
/// The vouch's bridge is rebuilt via `Bridge::between(&from_node, &to_node, ..)`
/// over two synthetic grade-1 endpoints — the ONLY public path to a Bridge, which
/// preserves the even-grade rotor invariant (a raw rotor cannot be injected). The
/// rotor that `propagate` sandwiches is thus always a valid normalized even-grade
/// versor, exactly as a real graph bridge would produce.

pub fn sign(kp: &Keypair, kind: u32, tags: Vec<Vec<String>>, content: &str, created_at: u64) -> NostrEvent;

/// Verify id == sha256(canonical) AND sig is a valid BIP340 sig by pubkey over id.
/// The ONLY trust gate: an event failing this contributes nothing.
pub fn verify(ev: &NostrEvent) -> bool;

/// PURE, DETERMINISTIC core (R-0010 AC3/AC4/AC5/AC8): verify every event, drop
/// the invalid/malformed, group by pubkey (canonical lowercase x-only hex), drive
/// the UNCHANGED ReputationEngine in the fixed two-phase order below, return one
/// WizardReputation per wizard. Empty log ⇒ empty map (no free seed).
pub fn recompute(events: &[NostrEvent]) -> BTreeMap<String /*pubkey*/, WizardReputation>;

/// Discovery (AC7): verified traversal reach per wizard in `domain`, ranked desc.
pub fn rank_by_domain(events: &[NostrEvent], domain: Uuid, k: usize) -> Vec<(String /*pubkey*/, f32 /*reach*/)>;
```

**pubkey → WizardId.** `WizardReputation` is keyed internally by `WizardId`
(`Uuid`); the event layer is keyed by the pubkey as **canonical lowercase 32-byte
x-only hex** (so two peers key bit-identically — AC4). `recompute` derives
`WizardId = Uuid::new_v5(MP_NAMESPACE, pubkey_bytes)` deterministically, so the
existing `WizardReputation` type is untouched.

**Recompute algorithm — fixed two-phase order (the determinism contract for AC4).**
`propagate` reads the *voucher's current* `domain_reps` (`reputation.rs:60-67`),
so it is **stateful** and order-sensitive; `record_traversal` only *adds* a grade-1
term, so traversals **commute** (vector addition), and `synthesis` is derived once
at the end — so traversal order is irrelevant *because addition commutes*, not
because the engine is stateless. To make the whole recompute reproducible on any
peer regardless of arrival order, the algorithm is pinned to **one deterministic
pass, no fixpoint/multi-round**:

1. `let valid = events.iter().filter(|e| verify(e))` — verified only; malformed
   `content` is skipped (`filter_map`/`let … else { continue }`, never `?`).
2. **Phase A — all traversals first.** For every `KIND_TRAVERSAL`:
   `engine.record_traversal(&mut rep[wiz], domain, &Mv::vector(e1,e2,e3), depth)`.
   Order-independent (grade-1 addition commutes).
3. **Phase B — vouches, single pass, applied in a global stable sort by
   `(created_at, id)`.** For each `KIND_VOUCH`: reconstruct the even-grade rotor
   from `bridge_rotor`, `engine.propagate(&rep[voucher], &bridge, &mut rep[vouched],
   &domain)`. **Exactly one pass — no re-propagation of already-vouched reputation,
   no convergence loop.** A vouch reads the voucher's *post-Phase-A + any
   earlier-in-sort vouch* state; the fixed sort makes that reproducible. (This is
   the AMP rule; it is *not* `sybil.rs`'s multi-round propagation, which is a test
   harness, not the recompute contract.)
4. `engine.recompute_synthesis(&mut rep[wiz])` for every wizard.
   `ReputationEngine::default()` (trust_decay 0.5) — identical to today. The same
   verified log thus yields the identical multivector on any peer (AC4). A test
   shuffles a vouch chain A→B→C and asserts identical output.

**Sybil & rank-forgery (AC5) — scoped precisely.** The property AC5 guarantees is
the **mutual-vouch grade collapse**: a clique that signs *only* vouches for one
another (no real traversals) has co-linear/scalar reputations whose `propagate`
sandwich stays **grade 0** — the exact `sybil.rs` property, now over signed
events. Signatures gate authorship: you cannot forge *another* wizard's history
without their secret. **What AC5 does NOT claim** (and the test must not assert):
that a fake key can never reach grade > 0. With **self-contained traversal events**
(§2, open Q4-resolved), a *single* signed key can fabricate traversals along three
orthogonal directions and `recompute_synthesis` will legitimately wedge them into a
**grade-3 synthesis** — single-actor rank-fabrication. That is an **accepted POC
risk** (named in §4 non-goals: traversal events are not yet bound to authenticated
graph plateaus); the later hardening (resolve a traversal's position from the
synced graph and reject unknown plateaus) closes it. Therefore the AC5 test asserts
**only** the mutual-vouch grade-0 collapse, never "fake keys cannot exceed grade 0."

**Dependency:** `k256` with `schnorr` (BIP340) + `sha2` + `getrandom` (`js`
feature on wasm32). Pure Rust, wasm-friendly, **not** a graph-math lib (CLAUDE.md
§1 is about garust for *geometry*; crypto is orthogonal). `uuid` already uses
`getrandom`'s js feature. **No C/secp256k1-sys, no glam/nalgebra.**

**Crate-graph hygiene.** Add `mp-identity` to the workspace `[workspace] members`
(`Cargo.toml`). Allowed dependency direction: `mp-identity → mp-reputation →
mp-domain → garust` (so recompute can drive the audited engine). **`mp-crdt` must
depend on neither `mp-reputation` nor `mp-identity`** — the existing "CRDT has no
reputation" guard test (`mp-crdt/src/doc.rs:435`) is mirrored: a sibling guard
asserts `mp-crdt`'s manifest names no reputation/identity crate, keeping §7's "no
reputation in the CRDT" enforced at the dependency level too.

### 2.2 `mp-wasm` — thin exports only (CLAUDE.md: wrappers, no logic)

```rust
#[wasm_bindgen] pub struct WasmIdentity { inner: Keypair }
#[wasm_bindgen] impl WasmIdentity {
    #[wasm_bindgen(constructor)] pub fn new() -> WasmIdentity;          // generate
    pub fn from_secret(hex: &str) -> Result<WasmIdentity, JsError>;
    pub fn pubkey(&self) -> String;
    pub fn secret(&self) -> String;                                     // local persistence ONLY
    pub fn sign_traversal(&self, domain: &str, e1: f32, e2: f32, e3: f32, depth: f32, plateau: Option<String>) -> Result<String /*event json*/, JsError>;
    pub fn sign_vouch(&self, domain: &str, vouched_pubkey: &str, from: &[f32], to: &[f32]) -> Result<String, JsError>;
}
// Free functions: events arrive as a JSON array of NostrEvent.
#[wasm_bindgen] pub fn verify_event(event_json: &str) -> bool;
#[wasm_bindgen] pub fn recompute_reputation(events_json: &str, pubkey: &str) -> Result<String /*{domain_reps,synthesis} JSON*/, JsError>;
#[wasm_bindgen] pub fn rank_wizards(events_json: &str, domain: &str, k: usize) -> Result<JsValue, JsError>;
```

`recompute_reputation` returns **exactly the JSON shape `seedReputation`
produces** (`convert.rs` already round-trips it), so `reachable_plateaus` /
`nearest_plateaus` consume it unchanged. **No new reputation marshalling** beyond
event (de)serialization. `WasmGraph`/`WasmCrdtDoc`/`WasmSyncSession` and
`root_keys()` are **untouched**.

### 2.3 `apps/web` — transport + UI (no GA, no crypto in JS)

- **Identity (AC1).** On load, mint a `WasmIdentity` (or rebuild via
  `from_secret`); persist **only the secret hex** to `localStorage` under
  `mp.wizardSecret`, mirroring the audited `mp.modelConfig` pattern. **Never**
  synced, **never** logged, **never** in a URL. The pubkey is shown in the HUD.
- **Event log (local, verified).** A new `events.js` keeps an in-memory array of
  verified `NostrEvent`s plus a `localStorage` mirror (`mp.eventLog`, local-only).
  `addEvent(json)` calls `verify_event` and drops invalid events. Reputation =
  `JSON.parse(recompute_reputation(JSON.stringify(log), myPubkey))` → replaces the
  old `localRep = seedReputation(...)` (AC3). `traverse.js`'s JS `accumulate` is
  **removed** — traversal reputation now comes from Rust recompute (less JS math,
  more §1-compliant).
- **Traverse → sign (AC2/AC3).** The click-to-reveal handler (main.js ~496), on
  reaching a plateau, calls `identity.sign_traversal(domain, e1,e2,e3, depth, plateauId)`,
  appends to the log, recomputes, re-lights — **no reload**. Depth/position come
  from the plateau the visitor reached (self-contained content).
- **Vouch/vote → sign (AC2/AC5).** A minimal "vouch" affordance signs a
  `KIND_VOUCH` event (used by the Sybil demonstration and by discovery). Resource
  votes in the CRDT stay a separate quality signal (unchanged); reputation-bearing
  vouches are the signed-event path. *(Exact UI surface = open Q5.)*
- **Transport (AC4/AC7), two channels, CRDT untouched:**
  - *Relay (AC7):* `relay.js` opens a `WebSocket` to a configurable relay URL
    (`mp.relayUrl`, local-only like model config), `["EVENT", e]` to publish,
    `["REQ", subId, {kinds:[30078,30079]}]` to subscribe, feeds each received
    event through `addEvent` (verify → recompute). On socket error/closed it sets
    an **offline** HUD flag and the world keeps working from the local log
    (offline-safe). Discovery (AC7): `["REQ", …, {kinds:[30078]}]` filtered by a
    domain tag, then `rank_wizards(log, domain, k)` ranks **client-side** from
    *verified* events (never trust relay ordering).
  - *Local cross-tab (AC4):* a **second** `BroadcastChannel("mp-nostr-events")`
    carries signed-event JSON between tabs so two local clients converge with no
    relay. The existing CRDT `BroadcastChannel("mp-graph-sync")` is **untouched**
    and still carries only Automerge bytes.
- **Seed → earned transition (AC3) — concrete encoding.** Today
  `seedReputation` bakes the fixed `SEED = 0.16` magnitude *into the reputation
  vector itself* (`persona.js:128-130`), and reachability is grade-1 magnitude vs
  `REACHABILITY_THRESHOLD = 0.15` — that baked magnitude is the "free seed" being
  removed. In Phase 8 the persona's `orient` is **no longer fed to
  `seedReputation` at all** for the live reputation: reputation is **only**
  `recompute_reputation(verified log)`. The persona's `orient` survives **purely
  as a UI/orientation hint** (where the camera faces, which domain's trailhead is
  offered) and **never becomes a reputation vector** — so there is no magnitude to
  accidentally re-introduce. A fresh key with an empty log therefore has an
  **empty `domain_reps`** and **reaches nothing**. To give a navigable start
  without a free magnitude, the **origin plateau of each faced domain is always
  drawn as a trailhead** (a render-layer affordance gated on persona orientation,
  *not* on reputation); reaching it signs the first traversal, and reach grows
  from real signed history. *(Trailhead mechanism = open Q3; the invariant it must
  preserve — "empty log ⇒ empty `domain_reps` ⇒ reaches nothing" — is fixed here.)*

### 2.4 What stays exactly as-is (CLAUDE.md §7 / §1)

- `CrdtDoc` root keys stay `{bridges, plateaus, resources, votes}`; **no**
  reputation/key/sig/rank field added (`root_keys()` assertion still holds, HUD
  re-checks it). Signed **events** ride the relay + the *separate* event
  BroadcastChannel — **never** the Automerge doc. The **secret key** rides no
  channel and is never logged.
- All GA math (projection, grade, rotor sandwich, wedge) stays in garust via the
  unchanged engine; JS gains **no** GA and **no** crypto code.

## 3. Code outline

```rust
// mp-identity/src/recompute.rs  (the pure heart — host-tested, AC3/4/5/8)
pub fn recompute(events: &[NostrEvent]) -> BTreeMap<String, WizardReputation> {
    let engine = ReputationEngine::default();
    let mut reps: BTreeMap<String, WizardReputation> = BTreeMap::new();
    let valid: Vec<&NostrEvent> = events.iter().filter(|e| verify(e)).collect();

    // Phase A — traversals (commute; order-independent). Malformed content is
    // SKIPPED, not propagated as an error (note: `let … else { continue }`, not `?`,
    // since this fn returns a map, not a Result — AC8 "malformed event is inert").
    for e in valid.iter().filter(|e| e.kind == KIND_TRAVERSAL) {
        let Ok(t) = serde_json::from_str::<Traversal>(&e.content) else { continue };
        let rep = reps.entry(e.pubkey.clone())
            .or_insert_with(|| WizardReputation::new(wizard_id_of(&e.pubkey)));
        engine.record_traversal(rep, t.domain, &Mv::vector(t.e1, t.e2, t.e3), t.depth);
    }

    // Phase B — vouches: ONE pass, global stable sort by (created_at, id), no
    // multi-round (the determinism contract for AC4). Each drives engine.propagate.
    let mut vouches: Vec<&&NostrEvent> =
        valid.iter().filter(|e| e.kind == KIND_VOUCH).collect();
    vouches.sort_by(|a, b| (a.created_at, &a.id).cmp(&(b.created_at, &b.id)));
    for e in vouches {
        let Ok(v) = serde_json::from_str::<Vouch>(&e.content) else { continue };
        // reconstruct the even-grade rotor from v.bridge_rotor; look up/clone the
        // voucher rep; engine.propagate(&voucher, &bridge, &mut reps[vouched], &v.domain);
    }

    for (_pk, rep) in reps.iter_mut() { engine.recompute_synthesis(rep); }
    reps
}
```

```js
// apps/web/src/events.js  (verify-gated local log; reputation source)
export function makeLog(wasm, myPubkey) {
  const evs = loadEventLog();                  // localStorage mirror, local-only
  const add = (json) => { if (wasm.verify_event(json)) evs.push(JSON.parse(json)); saveEventLog(evs); };
  const reputation = () =>
    JSON.parse(wasm.recompute_reputation(JSON.stringify(evs), myPubkey));  // ⇒ {domain_reps,synthesis}
  return { add, reputation, all: () => evs };
}
```

## 4. Non-goals

- Key recovery / rotation / multi-device sync / custody UX (later hardening).
- Full NIP coverage, authed/paid relays, running our own relay (use one endpoint).
- On-chain / tokens / payments; social graph / profiles / DMs.
- Back-dating old synthetic-seed sessions into signed history.
- Binding traversal events to authenticated graph plateaus (anti-fabrication
  beyond signature + grade geometry) — POC uses self-contained content; provenance
  hardening is future work. **Consequence (accepted POC risk):** because a
  traversal's `position` is self-asserted, a *single* signed key can fabricate
  traversals along orthogonal directions and earn a real grade-3 synthesis
  (single-actor rank fabrication). This is distinct from the Sybil case (mutual
  vouching still collapses to grade 0). AC5 is scoped accordingly (§2.1).
- Filling `Bridge.created_by` / `Resource.signature` into the CRDT from the wizard
  key — additive and out of this spec's critical path (reputation events only).

## 5. Open questions (settle before Accepted)

1. **Crypto stack.** `k256` (pure-Rust BIP340 Schnorr, wasm-friendly — chosen) vs
   `secp256k1`/`-sys` (C, the bitcoin-canonical lib but heavier on wasm). Confirm
   `k256`.
2. **Crypto location.** All in Rust (`mp-identity` via `mp-wasm` — chosen, keeps
   verify+recompute+GA in audited host-tested code, avoids vendoring JS crypto into
   a bundler-less site) vs JS `nostr-tools` for sign/verify. Confirm Rust.
3. **Trailhead / start.** Always-visible origin plateau per faced domain (chosen)
   vs persona orientation makes the single nearest plateau reachable as a
   zero-cost entry vs require the visitor to import/seed a first event. Must keep
   "empty log ⇒ reaches nothing" true (no free *magnitude*).
4. **Event content.** Self-contained `{domain, e1,e2,e3, depth, plateau?}` (chosen
   — pure recompute, no graph dependency, clean AC8 host test) vs id-only with
   position resolved from the synced graph (stronger anti-fabrication, but couples
   recompute to graph availability and complicates discovery of unknown plateaus).
   **Resolved with an explicit risk statement** (§2.1 "Sybil & rank-forgery", §4):
   self-contained content means a single key can fabricate a grade-3 synthesis;
   accepted for the POC, hardened later by graph-bound position resolution.
5. **Vote vs vouch semantics.** The reputation-bearing "vote" = a **vouch** event
   driving `propagate` (chosen — it is exactly the R-0002 Sybil grade-collapse
   path and reuses `sybil.rs`); CRDT resource votes remain a separate quality
   signal. Confirm, and confirm the minimal vouch UI surface for the POC.
6. **Event transport for cross-tab convergence.** A second
   `BroadcastChannel("mp-nostr-events")` (chosen — keeps the CRDT channel pure) vs
   tagging messages on the existing graph-sync channel. Confirm the second channel.
7. **WizardId derivation.** `Uuid::new_v5(MP_NAMESPACE, pubkey)` (chosen,
   deterministic, keeps `WizardReputation` keyed by `Uuid`) vs widening the type.

## 6. Acceptance criteria (map to R-0010)

- [ ] **AC1** — `WasmIdentity::new()` mints a BIP340 keypair; `pubkey()` stable;
  secret persisted only to `localStorage` (`mp.wizardSecret`), never synced/logged
  (grep the wire + a HUD assertion). → R-0010 AC1.
- [ ] **AC2** — `sign_traversal`/`sign_vouch` produce events that `verify_event`
  accepts; a mutated id/sig/content/pubkey is **rejected** and contributes nothing
  (host unit test: valid accepted, each tamper rejected). → AC2.
- [ ] **AC3** — `recompute(events)` is deterministic; empty log ⇒ empty reputation
  (reaches nothing); a Math-traversal log lights the same set the engine would for
  that grade-1 accrual; the seed is gone (no `seedReputation` magnitude in the live
  path). → AC3.
- [ ] **AC4** — two logs with the same verified events ⇒ component-wise-equal
  multivector (within EPSILON 1e-4) regardless of arrival order. The decisive test
  includes a **vouch chain A→B→C** presented in shuffled order and asserts the
  fixed two-phase recompute (§2.1) yields identical output (catches the stateful
  `propagate` ordering). Browser: two tabs converge via the event channel with no
  relay. → AC4.
- [ ] **AC5** — **The asserted property is mutual-vouch grade collapse only:** N
  colluding fake keys signing *only* mutual vouch events stay
  `dominant_grade() == 0` (host test mirroring `sybil.rs`), and forging another
  wizard's event without the secret fails `verify`. The test **must not** assert
  "a fake key cannot exceed grade 0" in general — under self-contained events a
  single key can fabricate a grade-3 synthesis (accepted POC risk, §2.1/§4). → AC5.
- [ ] **AC6** — `CrdtDoc.root_keys() == {bridges,plateaus,resources,votes}`
  (unchanged, asserted); no reputation/key/sig/rank in the synced doc; secret on no
  channel (HUD + grep). → AC6.
- [ ] **AC7** — connect to a relay (configurable URL, local-only); publish + receive
  signed events; `rank_wizards(log, domain, k)` ranks top traversers per domain from
  verified events; relay down ⇒ offline flag, world stays playable. → AC7.
- [ ] **AC8** — `mp-identity` pure tests (recompute determinism, empty-log,
  tamper-rejection, Sybil grade-0) green under `cargo test`; `cargo test
  --workspace`, `wasm-pack test --node`, clippy `-D warnings` (host + wasm32),
  `cargo fmt --check`, `node --test apps/web/src/*.test.mjs` all green; page mints a
  key, signs a traversal, recomputes rank with no uncaught console errors. → AC8.

## 7. Designs considered (and why this one)

- **Chosen — pure `mp-identity` (k256) owns keygen+sign+verify+recompute, exposed
  via thin `mp-wasm`; JS only transports event JSON + renders.** Keeps the entire
  crypto+GA trust pipeline in audited, host-testable Rust; reuses the unchanged
  reputation engine and the existing reputation-JSON seam; avoids vendoring a large
  JS crypto lib into a bundler-less site; CRDT untouched.
- **Rejected — JS `nostr-tools` for sign/verify (+ JS recompute).** Puts GA
  reputation recompute and the trust gate in JS (violates §1), needs a vendored
  crypto bundle, and is not host-testable (AC8).
- **Rejected — events inside the Automerge CRDT doc.** Would change `root_keys`
  and risk reputation-adjacent data entering the synced doc (violates §7). Events
  ride a relay + a separate event channel; reputation is recomputed locally and
  never synced.
- **Rejected — a free persona magnitude that is also signed as "genesis."**
  Re-introduces a gifted magnitude under a signature; contradicts "no free seed"
  (AC3). Persona = orientation only; magnitude is earned by signed traversal.

## 8. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | New pure crate `mp-identity`; all crypto + recompute in Rust, thin `mp-wasm` exports; JS only transports events + renders | Keeps verify+recompute+GA in audited host-tested code (§1, AC8); reuses the existing reputation-JSON seam; no JS crypto vendoring; CRDT untouched (§7) |
| 2026-06-02 | `k256` BIP340 Schnorr + `sha2` (pure Rust, wasm-friendly) for the Nostr scheme | Wasm-compatible, no C deps, not a graph-math lib (§1 unaffected) |
| 2026-06-02 | Recompute drives the **unchanged** `ReputationEngine`; traversal→`record_traversal`, vouch→`propagate`; output is the existing `{domain_reps,synthesis}` JSON | No new GA/reputation logic; Sybil = the proven `sybil.rs` grade-collapse over signed vouches; downstream lighting unchanged |
| 2026-06-02 | Persona = orientation only; magnitude earned; empty log ⇒ reaches nothing; navigable start via an always-visible trailhead affordance | Rank is earned geometry, not gifted (§4, AC3) |
| 2026-06-02 | Events ride the relay + a **second** `BroadcastChannel`; the CRDT graph-sync channel and root keys are untouched; secret key on no channel, never logged | §7 + key hygiene; offline-safe two-tab convergence (AC4) without a relay |
| 2026-06-02 | Recompute pinned to a **fixed two-phase order** (all traversals, then vouches in one pass sorted by `(created_at,id)`, no multi-round) | `propagate` is stateful/order-sensitive; a stable sort alone is insufficient — phasing is the AC4 determinism contract |
| 2026-06-02 | AC5 scoped to **mutual-vouch grade-0 collapse only**; single-actor grade-3 fabrication via self-asserted positions is an accepted POC risk | Self-contained events (Q4) make positions unverifiable; honest scoping beats a false "fake keys can't exceed grade 0" claim — hardened later by graph-bound positions |

## Changelog

- 2026-06-02 created (Draft) — pending architect design review, then R-0010 → Accepted.
- 2026-06-02 architect design review → **APPROVE-WITH-NITS**; folded findings in and **Status → Accepted**.
  Verified against the real code: `record_traversal`/`propagate`/`recompute_synthesis`
  signatures + semantics (`reputation.rs`), the `sybil.rs` mutual-vouch grade-collapse,
  the `{domain_reps,synthesis}` JSON round-trip (`convert.rs`) so recompute output feeds
  `reachable_plateaus`/`nearest_plateaus` unchanged, `CrdtDoc.root_keys()` asserting exactly
  `{bridges,plateaus,resources,votes}` (`doc.rs`), and the `apps/web` seams. §1/§7 confirmed
  clean (k256/sha2 are crypto not graph-geometry math; no GA in JS; events ride a *separate*
  channel, reputation never enters the CRDT). Must-fixes folded in: (1) the §3 `recompute`
  outline no longer uses `?` in a map-returning fn — malformed content is *skipped*
  (`let … else { continue }`); (2) a **fixed two-phase recompute order** (traversals first;
  vouches one pass, stable `(created_at,id)` sort, no multi-round) pins AC4 determinism around
  the stateful `propagate`, with a shuffled vouch-chain A→B→C test; (3) the determinism
  justification corrected (traversals commute via grade-1 *addition*; synthesis derived once);
  (4) **AC5 re-scoped** to mutual-vouch grade-0 only, with the single-actor grade-3
  fabrication named as an accepted POC risk (self-contained positions, Q4) to be closed by
  graph-bound position resolution. Nits folded: canonical lowercase x-only-hex pubkey keys,
  orientation-only persona encoding (orient is a UI hint, never a reputation vector, so
  empty log ⇒ empty `domain_reps` ⇒ reaches nothing), and crate-graph hygiene (`mp-identity`
  in workspace members; `mp-crdt` depends on neither `mp-reputation` nor `mp-identity`).
- 2026-06-04 implemented (commit 8d9d622) and **QA sign-off → PASS** (all AC1–AC8 met; every
  gate green; secret never on any wire/log, reputation never in the CRDT; live-relay via a
  faked-socket proxy per the non-goals). **Status → Implemented.**
