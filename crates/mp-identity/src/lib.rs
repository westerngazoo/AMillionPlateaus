//! mp-identity — Nostr wizard identity, signed events, and verifiable rank.
//!
//! Realizes SPEC-0010 (R-0010). A pure, host-testable crate that owns
//! everything security- and reputation-critical for Phase 8:
//!
//!   * [`Keypair`] — a BIP340 Schnorr keypair (the Nostr scheme), via pure-Rust
//!     `k256`. The secret stays local; the x-only pubkey is the stable wizard id.
//!   * [`NostrEvent`] + [`sign`] — NIP-01-shaped, signed traversal/vouch events.
//!   * [`verify`] — the single trust gate: an event whose id or signature does
//!     not check out contributes nothing.
//!   * [`recompute`] — the pure, deterministic event-log → reputation mapping
//!     that drives the **unchanged** `mp-reputation` engine (CLAUDE.md §1: no GA
//!     math here; we only marshal events and call the audited engine).
//!   * [`rank_by_domain`] — discovery: top traversers per domain, ranked from
//!     *verified* events only.
//!
//! No network, no wasm, no relay live here — that is `mp-wasm` + `apps/web`.
//! Reputation is recomputed, never stored; the secret key is never synced or
//! logged (CLAUDE.md §7).

mod error;
mod event;
mod keys;
mod recompute;
mod verify;

pub use error::IdError;
pub use event::{
    sign, Mastery, NostrEvent, PathDoc, Proof, Traversal, Vouch, KIND_MASTERY, KIND_PATH, KIND_PROOF, KIND_TRAVERSAL,
    KIND_VOUCH,
};
pub use keys::Keypair;
pub use recompute::{rank_by_domain, recompute, wizard_id_of};
pub use verify::verify;
