//! Error type for identity / event operations.

/// Errors from key handling, event signing, and (de)serialization.
///
/// `verify` itself never returns this — it collapses every failure mode to
/// `false` (an unverified event is simply inert, R-0010 AC2) — but the signing
/// and key-import paths surface precise causes to the wasm layer.
#[derive(thiserror::Error, Debug)]
pub enum IdError {
    #[error("invalid hex encoding: {0}")]
    Hex(String),
    #[error("invalid key: {0}")]
    Key(String),
    #[error("signing failed: {0}")]
    Sig(String),
    #[error("serialization failed: {0}")]
    Serde(String),
}
