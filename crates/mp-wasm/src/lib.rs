//! mp-wasm — the WASM graph bridge (SPEC-0003, R-0003).
//!
//! A **thin** `#[wasm_bindgen]` skin over `mp-graph`: it owns no graph, GA, or
//! reputation logic. Every method parses its string arguments, delegates to
//! `mp-graph` (the audited Rust core), and marshals the result back across the
//! JS↔Rust boundary. All branching logic lives in the pure, host-testable
//! [`convert`] module; this file is just the binding.
//!
//! Errors surface as `JsError` (a thrown JS `Error`) via wasm-bindgen's blanket
//! `From<std::error::Error>` — no panic ever crosses the FFI.

mod convert;
mod error;

use mp_crdt::{CrdtDoc, SyncSession};
use mp_domain::{Bridge, KnowledgeGraph, PlateauNode, Resource};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

/// A knowledge graph usable from JavaScript. Wraps an `mp_domain::KnowledgeGraph`.
#[wasm_bindgen]
pub struct WasmGraph {
    inner: KnowledgeGraph,
}

impl WasmGraph {
    /// Wrap an already-built `KnowledgeGraph` (crate-internal, not exported to
    /// JS). Used by [`WasmCrdtDoc::to_graph`] to hand the projected replica back
    /// as a `WasmGraph` the web app can query for fog (SPEC-0005 §2.2).
    pub(crate) fn from_inner(inner: KnowledgeGraph) -> WasmGraph {
        WasmGraph { inner }
    }
}

#[wasm_bindgen]
impl WasmGraph {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmGraph {
        WasmGraph {
            inner: KnowledgeGraph::new(),
        }
    }

    /// AC1 — add a plateau, returning the engine-assigned UUID as a string.
    pub fn add_plateau(
        &mut self,
        name: &str,
        domain_id: &str,
        e1: f32,
        e2: f32,
        e3: f32,
    ) -> Result<String, JsError> {
        let domain = Uuid::parse_str(domain_id)?;
        let p = PlateauNode::new(name, domain, e1, e2, e3);
        let id = p.id.to_string();
        self.inner.add_plateau(p);
        Ok(id)
    }

    /// AC1 — add a bridge between two existing plateaus. The rotor/grade are
    /// derived in `mp-graph` (`Bridge::between`), never supplied by JS. An
    /// unknown endpoint or malformed UUID becomes a thrown JS `Error`.
    pub fn add_bridge(&mut self, from_id: &str, to_id: &str, concept: &str) -> Result<(), JsError> {
        let from = Uuid::parse_str(from_id)?;
        let to = Uuid::parse_str(to_id)?;
        let bridge = {
            let f = self
                .inner
                .plateau(&from)
                .ok_or_else(|| JsError::new("unknown from plateau"))?;
            let t = self
                .inner
                .plateau(&to)
                .ok_or_else(|| JsError::new("unknown to plateau"))?;
            // created_by = nil: no wizard identity in the WASM context yet
            // (Nostr identity is Phase 8).
            Bridge::between(f, t, concept, Uuid::nil())
        };
        self.inner.add_bridge(bridge)?;
        Ok(())
    }

    /// AC2 — a `PlateauDto` object for a known id, or JS `null` for an unknown id.
    pub fn plateau(&self, id: &str) -> Result<JsValue, JsError> {
        let pid = Uuid::parse_str(id)?;
        match self.inner.plateau(&pid) {
            Some(p) => Ok(serde_wasm_bindgen::to_value(&convert::plateau_dto(p))?),
            None => Ok(JsValue::NULL),
        }
    }

    /// AC3 — is a single plateau reachable for the given reputation?
    pub fn is_reachable(&self, plateau_id: &str, wizard_rep_json: &str) -> Result<bool, JsError> {
        Ok(convert::is_reachable_by_id(
            &self.inner,
            plateau_id,
            wizard_rep_json,
        )?)
    }

    /// AC4 — the set of plateau ids reachable for the given reputation.
    pub fn reachable_plateaus(&self, wizard_rep_json: &str) -> Result<Vec<String>, JsError> {
        Ok(convert::reachable_ids(&self.inner, wizard_rep_json)?)
    }

    /// All plateaus as a JS array of `PlateauDto` (R-0005 AC4). The render layer
    /// needs the full set — both lit and fogged — which `reachable_plateaus`
    /// (lit ids only) cannot supply.
    pub fn plateaus(&self) -> Result<JsValue, JsError> {
        Ok(serde_wasm_bindgen::to_value(&convert::all_plateau_dtos(
            &self.inner,
        ))?)
    }

    /// All bridges as a JS array of `BridgeDto` (R-0005 AC4) — for drawing
    /// labelled edges between plateaus.
    pub fn bridges(&self) -> Result<JsValue, JsError> {
        Ok(serde_wasm_bindgen::to_value(&convert::all_bridge_dtos(
            &self.inner,
        ))?)
    }

    /// All resources (trail markers) as a JS array of `ResourceDto` (R-0014) —
    /// for drawing markers anchored to their plateaus.
    pub fn resources(&self) -> Result<JsValue, JsError> {
        Ok(serde_wasm_bindgen::to_value(&convert::all_resource_dtos(
            &self.inner,
        ))?)
    }

    /// R-0007 — top-`k` plateaus nearest the reputation's orientation, as a JS
    /// array of `NearestDto` (`{ id, name, score }`) ordered by descending
    /// projection score: the same GA projection the fog uses, exposed as a
    /// ranking for the companion's graph-grounded retrieval. Read-only.
    ///
    /// `k` arrives as a JS number and is validated here so no panic crosses the
    /// FFI (CLAUDE.md §5): a non-finite or negative `k` is a thrown `Error`, a
    /// fractional `k` is floored, and the result is naturally capped at the
    /// plateau count by the core.
    pub fn nearest_plateaus(&self, wizard_rep_json: &str, k: f64) -> Result<JsValue, JsError> {
        if !k.is_finite() || k < 0.0 {
            return Err(JsError::new("k must be a finite, non-negative number"));
        }
        let k = k.floor() as usize; // saturating cast; truncate() caps at len anyway
        Ok(serde_wasm_bindgen::to_value(&convert::nearest_dtos(
            &self.inner,
            wizard_rep_json,
            k,
        )?)?)
    }
}

impl Default for WasmGraph {
    fn default() -> Self {
        Self::new()
    }
}

/// A CRDT replica of the shareable graph, usable from JavaScript. A thin skin
/// over `mp_crdt::CrdtDoc`: each tab owns one, edits it offline, and exchanges
/// sync bytes with other tabs via a [`WasmSyncSession`] (SPEC-0005 §2.2, R-0005
/// AC2). Reputation is never stored here (CLAUDE.md §7) — the wire carries only
/// plateaus, bridges, resources and votes.
#[wasm_bindgen]
pub struct WasmCrdtDoc {
    inner: CrdtDoc,
}

#[wasm_bindgen]
impl WasmCrdtDoc {
    /// A fresh replica with the four empty root maps. Fallible — Automerge's
    /// genesis change can error — so this is a normal constructor, not a
    /// `#[wasm_bindgen(constructor)]` (which cannot return `Result`).
    pub fn new() -> Result<WasmCrdtDoc, JsError> {
        Ok(WasmCrdtDoc {
            inner: CrdtDoc::new()?,
        })
    }

    /// Add a plateau, returning the engine-assigned UUID string. Mirrors
    /// [`WasmGraph::add_plateau`] so the web app seeds either side identically.
    /// `description` is the plateau's authored Markdown body (R-0020); it rides
    /// the `description` field already serialized into the CRDT `plateaus` map,
    /// so it syncs and persists like the rest of the node. An empty string is the
    /// common case (no body) and is stored verbatim.
    pub fn add_plateau(
        &mut self,
        name: &str,
        domain_id: &str,
        e1: f32,
        e2: f32,
        e3: f32,
        description: &str,
    ) -> Result<String, JsError> {
        let domain = Uuid::parse_str(domain_id)?;
        let p = PlateauNode::new(name, domain, e1, e2, e3).with_description(description);
        let id = p.id.to_string();
        self.inner.add_plateau(&p)?;
        Ok(id)
    }

    /// Add a plateau with a **caller-supplied** id (still Grade-1-checked by
    /// `PlateauNode::new`). This is how the web app builds a *deterministic*
    /// seed: both tabs seed the identical id, so on sync the entries merge to one
    /// shared map instead of doubling (each tab seeds independently — there is no
    /// shared base). For user-authored plateaus use [`WasmCrdtDoc::add_plateau`],
    /// which assigns a fresh id.
    pub fn seed_plateau(
        &mut self,
        id: &str,
        name: &str,
        domain_id: &str,
        e1: f32,
        e2: f32,
        e3: f32,
    ) -> Result<(), JsError> {
        let id = Uuid::parse_str(id)?;
        let domain = Uuid::parse_str(domain_id)?;
        let mut p = PlateauNode::new(name, domain, e1, e2, e3);
        p.id = id; // deterministic seed id; Grade-1 invariant already enforced.
        self.inner.add_plateau(&p)?;
        Ok(())
    }

    /// Add a bridge between two plateaus already in this replica. The rotor and
    /// grade are derived in `mp-graph` (`Bridge::between`), never supplied by JS;
    /// an unknown endpoint or malformed UUID becomes a thrown `JsError`. The
    /// bridge lands in the doc's `bridges` map and so syncs to peers (R-0005 AC4).
    pub fn add_bridge(&mut self, from_id: &str, to_id: &str, concept: &str) -> Result<(), JsError> {
        let from = Uuid::parse_str(from_id)?;
        let to = Uuid::parse_str(to_id)?;
        let f = self
            .inner
            .plateau(&from)?
            .ok_or_else(|| JsError::new("unknown from plateau"))?;
        let t = self
            .inner
            .plateau(&to)?
            .ok_or_else(|| JsError::new("unknown to plateau"))?;
        // created_by = nil: no wizard identity in the WASM context yet (Phase 8).
        let bridge = Bridge::between(&f, &t, concept, Uuid::nil());
        self.inner.add_bridge(&bridge)?;
        Ok(())
    }

    /// Seed a bridge with a **caller-supplied** id (deterministic seed twin of
    /// [`WasmCrdtDoc::seed_plateau`]): both tabs seed the same bridge id so the
    /// `bridges` map merges to one entry instead of doubling. The rotor/grade are
    /// still derived in `mp-graph`. For user edits use
    /// [`WasmCrdtDoc::add_bridge`], which assigns a fresh id.
    pub fn seed_bridge(
        &mut self,
        id: &str,
        from_id: &str,
        to_id: &str,
        concept: &str,
    ) -> Result<(), JsError> {
        let id = Uuid::parse_str(id)?;
        let from = Uuid::parse_str(from_id)?;
        let to = Uuid::parse_str(to_id)?;
        let f = self
            .inner
            .plateau(&from)?
            .ok_or_else(|| JsError::new("unknown from plateau"))?;
        let t = self
            .inner
            .plateau(&to)?
            .ok_or_else(|| JsError::new("unknown to plateau"))?;
        let mut bridge = Bridge::between(&f, &t, concept, Uuid::nil());
        bridge.id = id; // deterministic seed id.
        self.inner.add_bridge(&bridge)?;
        Ok(())
    }

    /// Record `wizard`'s grow-only vote on `resource` at `weight`.
    pub fn vote(&mut self, resource: &str, wizard: &str, weight: f32) -> Result<(), JsError> {
        let resource = Uuid::parse_str(resource)?;
        let wizard = Uuid::parse_str(wizard)?;
        self.inner.vote(resource, wizard, weight)?;
        Ok(())
    }

    /// Anchor a resource (a trail marker) to an existing plateau, returning the
    /// engine-assigned id. `kind` is a human label ("Note", "Article", …) parsed
    /// to `ResourceKind` (unknown → Note). The marker starts `Floating` with zero
    /// votes; `contributor` is nil (attribution deferred, R-0014 AC5). A missing
    /// plateau anchor is a thrown `JsError` (mirrors `add_bridge`), so a marker
    /// can never reference a non-existent plateau.
    pub fn add_resource(
        &mut self,
        plateau_id: &str,
        title: &str,
        kind: &str,
        uri: &str,
    ) -> Result<String, JsError> {
        let pid = Uuid::parse_str(plateau_id)?;
        self.inner
            .plateau(&pid)?
            .ok_or_else(|| JsError::new("unknown plateau"))?;
        let r = Resource::new(
            pid,
            title,
            convert::parse_resource_kind(kind),
            uri,
            Uuid::nil(),
        );
        let id = r.id.to_string();
        self.inner.add_resource(&r)?;
        Ok(id)
    }

    /// Project this replica into a queryable [`WasmGraph`] (re-validating every
    /// decoded entity's GA invariants). This is how the fog-world renders the
    /// synced state.
    pub fn to_graph(&self) -> Result<WasmGraph, JsError> {
        Ok(WasmGraph::from_inner(self.inner.to_graph()?))
    }

    /// The document's top-level keys, sorted — exactly the four data maps. The
    /// web app asserts this is `["bridges","plateaus","resources","votes"]` so a
    /// reputation key can never sneak onto the wire (R-0005 AC7).
    pub fn root_keys(&self) -> Vec<String> {
        self.inner.root_keys()
    }

    /// The vote tally for `resource` as a `ResourceVoteDto`
    /// (`{ voters, weighted_sum, weights }`).
    pub fn resource_vote(&self, resource: &str) -> Result<JsValue, JsError> {
        let resource = Uuid::parse_str(resource)?;
        let tally = self.inner.resource_vote(&resource)?;
        Ok(serde_wasm_bindgen::to_value(&convert::resource_vote_dto(
            &tally,
        ))?)
    }

    /// The next sync message to send to a peer over `session`, or `undefined`
    /// when there is nothing left to send (quiescence). The session is passed in
    /// rather than owned so one tab can hold one session per remote peer
    /// (SPEC-0004 §2.4, SPEC-0005 §2.2).
    pub fn generate_message(&mut self, session: &mut WasmSyncSession) -> Option<Vec<u8>> {
        session.inner.generate_message(&mut self.inner)
    }

    /// Apply a sync message received from a peer over `session`.
    pub fn receive_message(
        &mut self,
        session: &mut WasmSyncSession,
        bytes: &[u8],
    ) -> Result<(), JsError> {
        session.inner.receive_message(&mut self.inner, bytes)?;
        Ok(())
    }

    /// Serialize the whole CRDT doc to bytes for durable storage (R-0012 AC1).
    /// Delegates to the audited core; `&mut` because Automerge commits pending
    /// ops before serializing. The web app persists these bytes to IndexedDB
    /// (the browser analogue of the native redb `CrdtStore` — same save-blob,
    /// different backing, since redb does not target wasm32).
    pub fn save(&mut self) -> Vec<u8> {
        self.inner.save()
    }

    /// Reconstruct a replica from bytes produced by [`WasmCrdtDoc::save`]
    /// (R-0012 AC1). A corrupt or stale blob is a thrown JS `Error`, so the
    /// caller can fall back to a fresh seed (R-0012 AC7, discard-and-reseed).
    pub fn load(bytes: &[u8]) -> Result<WasmCrdtDoc, JsError> {
        Ok(WasmCrdtDoc {
            inner: CrdtDoc::load(bytes)?,
        })
    }

    /// Merge a save-blob (e.g. `mp-host import`'s output, or any
    /// [`WasmCrdtDoc::save`] bytes) INTO this replica — a CRDT **union**, not a
    /// replace (R-0021 AC6, "Import a world"). Convergent + idempotent: re-merging
    /// the same blob is a no-op (R-0004). A corrupt/non-Automerge blob is a thrown
    /// JS `Error` via `CrdtDoc::load`, never a panic — so the caller shows an
    /// inline error and the world keeps working.
    pub fn merge_bytes(&mut self, bytes: &[u8]) -> Result<(), JsError> {
        let mut incoming = CrdtDoc::load(bytes)?;
        self.inner.merge(&mut incoming)?;
        Ok(())
    }
}

/// One peer's view of an ongoing sync with a single remote — a thin skin over
/// `mp_crdt::SyncSession`. Held alongside a [`WasmCrdtDoc`] and pumped via
/// [`WasmCrdtDoc::generate_message`] / [`WasmCrdtDoc::receive_message`].
#[wasm_bindgen]
pub struct WasmSyncSession {
    inner: SyncSession,
}

#[wasm_bindgen]
impl WasmSyncSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmSyncSession {
        WasmSyncSession {
            inner: SyncSession::new(),
        }
    }
}

impl Default for WasmSyncSession {
    fn default() -> Self {
        Self::new()
    }
}

// ─── SPEC-0010 — wizard identity, signed events, recomputed rank ─────────────
//
// Thin skin over the pure `mp-identity` core: keygen/sign/verify and the
// event-log → reputation recompute all live in audited Rust. JS only ferries
// event JSON and renders. The secret key never leaves this process except via
// `secret()` for LOCAL persistence; it is never synced, relayed, or logged.

/// Current wall-clock seconds for stamping signed events. Browser `Date.now()`
/// on wasm; `SystemTime` on the host (so `cargo test --workspace` needs no
/// js-sys and the convert helpers stay pure).
#[cfg(target_arch = "wasm32")]
fn now_secs() -> u64 {
    (js_sys::Date::now() / 1000.0) as u64
}
#[cfg(not(target_arch = "wasm32"))]
fn now_secs() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// A wizard's Nostr keypair, usable from JavaScript. Wraps an
/// `mp_identity::Keypair`; the secret stays inside the wasm instance.
#[wasm_bindgen]
pub struct WasmIdentity {
    inner: mp_identity::Keypair,
}

#[wasm_bindgen]
impl WasmIdentity {
    /// AC1 — mint a fresh BIP340 keypair from browser entropy.
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmIdentity {
        WasmIdentity {
            inner: mp_identity::Keypair::generate(),
        }
    }

    /// AC1 — rebuild a keypair from a 32-byte secret hex (local persistence).
    pub fn from_secret(hex: &str) -> Result<WasmIdentity, JsError> {
        Ok(WasmIdentity {
            inner: mp_identity::Keypair::from_secret_hex(hex)?,
        })
    }

    /// The x-only public key hex — the stable wizard id (safe to display/share).
    pub fn pubkey(&self) -> String {
        self.inner.pubkey_hex()
    }

    /// The secret key hex. **LOCAL persistence only** — never sync, relay, or log.
    pub fn secret(&self) -> String {
        self.inner.secret_hex()
    }

    /// AC2/AC3 — sign a traversal event; returns the NostrEvent JSON.
    pub fn sign_traversal(
        &self,
        domain: &str,
        e1: f32,
        e2: f32,
        e3: f32,
        depth: f32,
        plateau: Option<String>,
    ) -> Result<String, JsError> {
        Ok(convert::sign_traversal_json(
            &self.inner,
            domain,
            [e1, e2, e3],
            depth,
            plateau,
            now_secs(),
        )?)
    }

    /// AC2/AC5 — sign a vouch event for `vouched_pubkey`; returns NostrEvent JSON.
    pub fn sign_vouch(
        &self,
        domain: &str,
        vouched_pubkey: &str,
        from: &[f32],
        to: &[f32],
    ) -> Result<String, JsError> {
        Ok(convert::sign_vouch_json(
            &self.inner,
            domain,
            vouched_pubkey,
            from,
            to,
            now_secs(),
        )?)
    }
}

impl Default for WasmIdentity {
    fn default() -> Self {
        Self::new()
    }
}

/// AC2 — verify an event's id self-consistency and BIP340 signature. Malformed
/// JSON or a bad signature returns `false`; an unverified event is inert.
#[wasm_bindgen]
pub fn verify_event(event_json: &str) -> bool {
    match serde_json::from_str::<mp_identity::NostrEvent>(event_json) {
        Ok(ev) => mp_identity::verify(&ev),
        Err(_) => false,
    }
}

/// AC3/AC4 — recompute `pubkey`'s reputation from a JSON array of events,
/// returning the `{domain_reps, synthesis}` JSON the fog queries consume. An
/// absent/empty log reaches nothing (no free seed).
#[wasm_bindgen]
pub fn recompute_reputation(events_json: &str, pubkey: &str) -> Result<String, JsError> {
    Ok(convert::recompute_reputation_json(events_json, pubkey)?)
}

/// AC7 — discovery: top-`k` traversers in `domain`, ranked by verified reach.
/// Returns a JS array of `{ pubkey, reach }`.
#[wasm_bindgen]
pub fn rank_wizards(events_json: &str, domain: &str, k: usize) -> Result<JsValue, JsError> {
    Ok(serde_wasm_bindgen::to_value(
        &convert::rank_wizards_entries(events_json, domain, k)?,
    )?)
}

/// R-0015 — the weighted-vote sum at which a resource crystallizes. Exposed so
/// the web app shows "n / threshold" without hardcoding the constant.
#[wasm_bindgen]
pub fn crystallize_threshold() -> f32 {
    mp_domain::CRYSTALLIZE_THRESHOLD
}

/// R-0015 — the canonical wizard id for a Nostr pubkey: the SAME `Uuid::new_v5`
/// mapping reputation and discovery use (`mp_identity::wizard_id_of`). Exposed so
/// a vote is keyed by the wizard's real identity, not a parallel/truncated id —
/// the only sanctioned pubkey→WizardId path for the web app (R-0015 AC6).
#[wasm_bindgen]
pub fn wizard_id_of(pubkey: &str) -> String {
    mp_identity::wizard_id_of(pubkey).to_string()
}
