//! Boundary error types for the WASM bridge (SPEC-0003 §Errors).
//!
//! These are plain `std::error::Error` enums. `wasm-bindgen` provides a blanket
//! `impl<E: std::error::Error> From<E> for JsError`, so a `#[wasm_bindgen]`
//! method returning `Result<T, JsError>` can `?` any of these — the error
//! message becomes the thrown JS `Error`. No panic ever crosses the FFI.

/// Failure decoding the `wizard_rep_json` reputation string.
#[derive(thiserror::Error, Debug)]
pub enum ReputationParseError {
    #[error("reputation JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
    #[error("domain id is not a valid UUID: {0}")]
    DomainId(#[from] uuid::Error),
}

/// Failure signing, parsing, or recomputing from Nostr events (SPEC-0010).
///
/// `verify_event` never returns this — an unverifiable event is simply inert
/// (`false`) — but signing and recompute/discovery surface precise causes.
#[derive(thiserror::Error, Debug)]
pub enum EventError {
    #[error("event JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
    #[error("id is not a valid UUID: {0}")]
    Uuid(#[from] uuid::Error),
    #[error("identity error: {0}")]
    Identity(#[from] mp_identity::IdError),
}

/// Failure answering a single-plateau fog query by id string.
#[derive(thiserror::Error, Debug)]
pub enum QueryError {
    #[error(transparent)]
    Reputation(#[from] ReputationParseError),
    #[error("plateau id is not a valid UUID: {0}")]
    PlateauId(uuid::Error),
    #[error("unknown plateau: {0}")]
    UnknownPlateau(String),
}
