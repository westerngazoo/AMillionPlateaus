//! mp-crdt — the shareable knowledge graph as a conflict-free replicated data
//! type, backed by Automerge.
//!
//! Realizes SPEC-0004 (R-0004). Two peers each hold a [`CrdtDoc`] replica, edit
//! offline, exchange byte messages via a [`SyncSession`], and converge — no
//! server arbitrates. [`ResourceVote`] is the grow-only vote counter;
//! [`CrdtStore`] persists a replica to redb.
//!
//! Reputation is **not** in the CRDT (CLAUDE.md §7): it is computed from a
//! signed event log, never synced as mutable shared state. `mp-crdt` therefore
//! does not depend on `mp-reputation` and the document has no reputation key.

mod doc;
mod error;
#[cfg(feature = "storage")]
mod store;
mod sync;
mod vote;

pub use doc::CrdtDoc;
pub use error::CrdtError;
#[cfg(feature = "storage")]
pub use store::CrdtStore;
pub use sync::SyncSession;
pub use vote::ResourceVote;
