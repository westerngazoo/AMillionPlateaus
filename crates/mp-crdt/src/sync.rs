//! `SyncSession` — drives the Automerge sync protocol, transport-agnostically.
//!
//! A peer keeps one `SyncSession` per remote peer plus its own [`CrdtDoc`]. The
//! caller pumps [`SyncSession::generate_message`] / [`SyncSession::receive_message`]
//! until both sides yield `None` (quiescence) — at which point the two replicas
//! have converged. Bytes are the only currency: there is no networking and no
//! async here, so the loop is fully host-testable. The real transport (a Gun.js
//! relay) injects later in Phase 5 (SPEC-0004 §2.4, R-0004 §4 non-goals).

use automerge::sync::{Message, State, SyncDoc};

use crate::doc::CrdtDoc;
use crate::error::CrdtError;

/// One peer's view of an ongoing sync with a single remote.
#[derive(Default)]
pub struct SyncSession {
    state: State,
}

impl SyncSession {
    pub fn new() -> Self {
        Self::default()
    }

    /// The next sync message to send to the remote, or `None` if there is
    /// nothing left to send given everything received so far (quiescence).
    pub fn generate_message(&mut self, doc: &mut CrdtDoc) -> Option<Vec<u8>> {
        doc.doc
            .sync()
            .generate_sync_message(&mut self.state)
            .map(|msg| msg.encode())
    }

    /// Apply a sync message received from the remote.
    pub fn receive_message(&mut self, doc: &mut CrdtDoc, bytes: &[u8]) -> Result<(), CrdtError> {
        let msg = Message::decode(bytes).map_err(|e| CrdtError::Sync(e.to_string()))?;
        doc.doc.sync().receive_sync_message(&mut self.state, msg)?;
        Ok(())
    }
}
