use crate::types::PlateauId;

#[derive(thiserror::Error, Debug)]
pub enum GraphError {
    #[error("Plateau {0} not found")]
    PlateauNotFound(PlateauId),

    #[error("Bridge references unknown plateau: {0}")]
    InvalidBridgeEndpoint(PlateauId),

    #[error("Invariant violated: {0}")]
    Invariant(String),

    #[error("Persistence error: {0}")]
    Db(String),
}
