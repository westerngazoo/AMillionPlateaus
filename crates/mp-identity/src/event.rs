//! Nostr events (NIP-01 shape) and their content payloads.
//!
//! An event id is the lowercase-hex SHA-256 of the canonical serialization
//! `[0, pubkey, created_at, kind, tags, content]`; the signature is BIP340
//! Schnorr by `pubkey` over the raw id bytes. The content payloads are
//! **self-contained** — a traversal carries its own position/depth and a vouch
//! carries its bridge endpoints — so [`crate::recompute`] needs no graph (AC8).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::IdError;
use crate::keys::Keypair;

/// Traversal kind (NIP parameterized-replaceable app-data range, 30000–39999).
pub const KIND_TRAVERSAL: u32 = 30078;
/// Vouch (reputation-bearing vote) kind.
pub const KIND_VOUCH: u32 = 30079;
/// Mastery kind (R-0030): "I have studied & self-tested this topic." A
/// completion claim, NOT reputation — `recompute` ignores it, so it never
/// changes the GA multivector (it sums only traversal/vouch).
pub const KIND_MASTERY: u32 = 30080;
/// Proof/solution artifact kind (R-0036): a shareable completion artifact (a
/// written proof, R-0032, or a CAS-checked solution, R-0034). Like
/// `KIND_MASTERY` it is NOT reputation — `recompute` ignores it (it sums only
/// traversal/vouch), so a published proof never changes reach.
pub const KIND_PROOF: u32 = 30081;

/// A Nostr event (NIP-01 shape).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NostrEvent {
    pub id: String,
    pub pubkey: String,
    pub created_at: u64,
    pub kind: u32,
    pub tags: Vec<Vec<String>>,
    pub content: String,
    pub sig: String,
}

/// Traversal content payload — self-contained so recompute needs no graph.
///
/// `e1/e2/e3` are the reached plateau's grade-1 position; `depth` scales the
/// recorded grade-1 contribution. `plateau` is an optional provenance hint
/// (unused by recompute today; the anti-fabrication hardening that resolves a
/// position *from* the graph is future work — SPEC-0010 §4).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Traversal {
    pub domain: Uuid,
    pub e1: f32,
    pub e2: f32,
    pub e3: f32,
    pub depth: f32,
    #[serde(default)]
    pub plateau: Option<Uuid>,
}

/// Vouch content payload.
///
/// The bridge rotor is rebuilt at recompute time via `Bridge::between` over two
/// synthetic grade-1 endpoints (`from`/`to`) — the only public path to a
/// `Bridge`, which preserves the even-grade rotor invariant (a raw rotor cannot
/// be injected).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vouch {
    pub domain: Uuid,
    /// The vouched wizard's x-only pubkey hex.
    pub vouched: String,
    pub from: [f32; 3],
    pub to: [f32; 3],
}

/// Mastery content payload (R-0030) — names the studied topic. Self-contained
/// and **not read by [`crate::recompute`]** (mastery is a completion claim, not
/// reputation): the only consumer is the client's derived "mastered" set.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mastery {
    pub plateau: Uuid,
}

/// Proof content payload (R-0036) — a shareable completion artifact: the topic,
/// the artifact `kind` ("proof" | "solution"), and the `body` text. Self-contained
/// and **not read by [`crate::recompute`]** (an artifact, not reputation): the only
/// consumers are the client's local store and the derived "published proofs" view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proof {
    pub plateau: Uuid,
    pub kind: String,
    pub body: String,
}

/// The canonical serialization whose SHA-256 is the event id (NIP-01):
/// `[0, pubkey, created_at, kind, tags, content]` as compact JSON.
fn canonical(
    pubkey: &str,
    created_at: u64,
    kind: u32,
    tags: &[Vec<String>],
    content: &str,
) -> Result<String, IdError> {
    let value = serde_json::json!([0, pubkey, created_at, kind, tags, content]);
    serde_json::to_string(&value).map_err(|e| IdError::Serde(e.to_string()))
}

/// The lowercase-hex SHA-256 event id for the given fields.
pub(crate) fn event_id(
    pubkey: &str,
    created_at: u64,
    kind: u32,
    tags: &[Vec<String>],
    content: &str,
) -> Result<String, IdError> {
    let canon = canonical(pubkey, created_at, kind, tags, content)?;
    Ok(hex::encode(Sha256::digest(canon.as_bytes())))
}

/// Build and sign a Nostr event with `kp`'s key. Returns the well-formed,
/// verifiable event (`verify` accepts it).
pub fn sign(
    kp: &Keypair,
    kind: u32,
    tags: Vec<Vec<String>>,
    content: &str,
    created_at: u64,
) -> Result<NostrEvent, IdError> {
    let pubkey = kp.pubkey_hex();
    let canon = canonical(&pubkey, created_at, kind, &tags, content)?;
    let hash = Sha256::digest(canon.as_bytes());
    let id = hex::encode(hash);
    let sig = kp.sign_hash(hash.as_slice())?;
    Ok(NostrEvent {
        id,
        pubkey,
        created_at,
        kind,
        tags,
        content: content.to_string(),
        sig,
    })
}
