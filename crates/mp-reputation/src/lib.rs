//! mp-reputation — GA Eigentrust reputation & fog reachability.
//!
//! Realizes SPEC-0002 (R-0002). The reputation *type* (`WizardReputation`) lives
//! in mp-graph; this crate holds the *algorithms* that operate on it:
//!   * [`ReputationEngine`] — traversal depth, rotor-sandwich Eigentrust
//!     propagation, and cross-domain wedge synthesis.
//!   * [`sybil`] — grade-collapse detection (Sybil resistance).
//!
//! Fog reachability itself is a graph query and lives on
//! `mp_domain::KnowledgeGraph` (`is_reachable` / `reachable_plateaus`), keeping
//! the dependency direction inward (mp-graph ← mp-reputation).

mod reputation;
pub mod sybil;

pub use reputation::ReputationEngine;
