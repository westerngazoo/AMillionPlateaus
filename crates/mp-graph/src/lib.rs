//! mp-graph — a domain-agnostic geometric graph store (RFC-0001 Scope A).
//!
//! Realizes SPEC-0001 + SPEC-0008. All geometry flows through garust; the [`ga`]
//! module is the thin adapter over garust's concrete G(3,0,0) f32 algebra.
//! [`GeoGraph<N, E>`] positions caller-owned node/edge types (constrained by the
//! [`Positioned`] / [`Rotored`] traits) in the algebra and answers geometric
//! queries; AMP's domain vocabulary — plateaus, bridges, wizards, reputation —
//! lives in the `mp-domain` crate, which consumes this store.

pub mod ga;

mod db;
mod error;
mod geo;

pub use db::GraphDb;
pub use error::GraphError;
pub use ga::Mv;
pub use geo::{EdgeId, GeoGraph, NodeId, Positioned, Rotored};
