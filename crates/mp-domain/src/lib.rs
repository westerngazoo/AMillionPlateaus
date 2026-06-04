//! mp-domain — A Million Plateaus' knowledge-graph vocabulary over the generic
//! `mp-graph` geometric store (SPEC-0008, RFC-0001 Scope A).
//!
//! The geometric *store* — `GeoGraph`, the `Positioned`/`Rotored` traits, the
//! query surface, persistence, and the `ga` adapter — lives in `mp-graph` and
//! knows nothing of AMP. This crate owns AMP's domain types (plateaus, bridges,
//! wizards, reputation, resources, alebrijes) and the [`KnowledgeGraph`] that
//! binds them to the store.
//!
//! The core items consumers still need (`ga`, `Mv`, `GraphError`, `GraphDb`,
//! `GeoGraph`, the traits, the id aliases) are re-exported here, so a consumer
//! depends on `mp-domain` alone and reaches the store through it.

mod graph;
mod types;

pub use graph::KnowledgeGraph;
pub use types::*;

// Re-export the generic core so consumers reach it through mp-domain.
pub use mp_graph::{ga, EdgeId, GeoGraph, GraphDb, GraphError, Mv, NodeId, Positioned, Rotored};
