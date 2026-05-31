//! Error type for the CRDT layer.
//!
//! Every fallible public `mp-crdt` operation returns `Result<_, CrdtError>`.
//! No panic crosses the public API (R-0004 AC8, CLAUDE.md §5).

use mp_graph::GraphError;

#[derive(thiserror::Error, Debug)]
pub enum CrdtError {
    /// An Automerge document / transaction operation failed.
    #[error("automerge error: {0}")]
    Automerge(#[from] automerge::AutomergeError),

    /// A sync message could not be decoded.
    #[error("sync decode error: {0}")]
    Sync(String),

    /// An entity blob failed to (de)serialize.
    #[error("entity JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),

    /// A decoded entity violated a graph invariant (Grade-1 / even-grade).
    #[error("invariant violated on load: {0}")]
    Invariant(#[from] GraphError),

    /// Backing storage (redb) failed.
    #[error("storage error: {0}")]
    Storage(String),

    /// The document is not shaped the way `mp-crdt` requires
    /// (e.g. a missing root map, or a value of the wrong type).
    #[error("malformed document: {0}")]
    Malformed(String),
}
