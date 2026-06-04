use crate::geo::NodeId;

#[derive(thiserror::Error, Debug)]
pub enum GraphError {
    #[error("Edge references unknown node: {0}")]
    UnknownEndpoint(NodeId),

    #[error("Invariant violated: {0}")]
    Invariant(String),

    #[error("Persistence error: {0}")]
    Db(String),
}
