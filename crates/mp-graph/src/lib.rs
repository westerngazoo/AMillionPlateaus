//! mp-graph — the knowledge graph core. The graph is the platform.
//!
//! Realizes SPEC-0001 (R-0001). All geometry flows through garust; the [`ga`]
//! module is the thin adapter over garust's concrete G(3,0,0) f32 algebra.

pub mod ga;

mod db;
mod error;
mod graph;
mod types;

pub use db::GraphDb;
pub use error::GraphError;
pub use ga::Mv;
pub use graph::KnowledgeGraph;
pub use types::*;
