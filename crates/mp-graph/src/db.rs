//! redb-backed persistence for the knowledge graph.
//!
//! Plateaus and bridges are bincode-serialized, keyed by UUID bytes. A
//! save → load round-trip reconstructs an equivalent `KnowledgeGraph`
//! (R-0001 AC5). Loaded records are validated against their GA invariants.

use std::path::Path;

use redb::{Database, ReadableTable, TableDefinition};

use crate::error::GraphError;
use crate::graph::KnowledgeGraph;
use crate::types::{Bridge, PlateauNode};

const PLATEAUS: TableDefinition<&[u8], &[u8]> = TableDefinition::new("plateaus");
const BRIDGES: TableDefinition<&[u8], &[u8]> = TableDefinition::new("bridges");

pub struct GraphDb {
    db: Database,
}

impl GraphDb {
    pub fn create<P: AsRef<Path>>(path: P) -> Result<Self, GraphError> {
        let db = Database::create(path).map_err(db_err)?;
        Ok(Self { db })
    }

    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, GraphError> {
        let db = Database::open(path).map_err(db_err)?;
        Ok(Self { db })
    }

    /// Persist every plateau and bridge in one write transaction.
    pub fn save(&self, graph: &KnowledgeGraph) -> Result<(), GraphError> {
        let txn = self.db.begin_write().map_err(db_err)?;
        {
            let mut plateaus = txn.open_table(PLATEAUS).map_err(db_err)?;
            for p in graph.plateaus() {
                let value = bincode::serialize(p).map_err(ser_err)?;
                plateaus
                    .insert(p.id.as_bytes().as_slice(), value.as_slice())
                    .map_err(db_err)?;
            }
            let mut bridges = txn.open_table(BRIDGES).map_err(db_err)?;
            for b in graph.bridges() {
                let value = bincode::serialize(b).map_err(ser_err)?;
                bridges
                    .insert(b.id.as_bytes().as_slice(), value.as_slice())
                    .map_err(db_err)?;
            }
        }
        txn.commit().map_err(db_err)?;
        Ok(())
    }

    /// Reconstruct a graph from disk, validating every record's invariants.
    pub fn load(&self) -> Result<KnowledgeGraph, GraphError> {
        let mut graph = KnowledgeGraph::new();
        let txn = self.db.begin_read().map_err(db_err)?;

        let plateaus = txn.open_table(PLATEAUS).map_err(db_err)?;
        for entry in plateaus.iter().map_err(db_err)? {
            let (_, value) = entry.map_err(db_err)?;
            let plateau: PlateauNode = bincode::deserialize(value.value()).map_err(ser_err)?;
            plateau.validate()?;
            graph.add_plateau(plateau);
        }

        let bridges = txn.open_table(BRIDGES).map_err(db_err)?;
        for entry in bridges.iter().map_err(db_err)? {
            let (_, value) = entry.map_err(db_err)?;
            let bridge: Bridge = bincode::deserialize(value.value()).map_err(ser_err)?;
            bridge.validate()?;
            graph.add_bridge(bridge)?;
        }

        Ok(graph)
    }
}

fn db_err<E: std::fmt::Display>(e: E) -> GraphError {
    GraphError::Db(e.to_string())
}

fn ser_err(e: bincode::Error) -> GraphError {
    GraphError::Db(format!("bincode: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::PlateauNode;
    use std::collections::HashSet;
    use uuid::Uuid;

    #[test]
    fn db_round_trip_preserves_graph() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("graph.redb");

        let domain = Uuid::new_v4();
        let a = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("Topology", domain, 0.7, 0.3, 0.2);
        let bridge = Bridge::between(&a, &b, "continuity", Uuid::new_v4());
        let (a_id, b_id, bridge_id) = (a.id, b.id, bridge.id);

        let mut original = KnowledgeGraph::new();
        original.add_plateau(a);
        original.add_plateau(b);
        original.add_bridge(bridge).expect("bridge endpoints exist");

        let db = GraphDb::create(&path).expect("create db");
        db.save(&original).expect("save");
        let loaded = db.load().expect("load");

        let original_ids: HashSet<_> = original.plateaus().map(|p| p.id).collect();
        let loaded_ids: HashSet<_> = loaded.plateaus().map(|p| p.id).collect();
        assert_eq!(original_ids, loaded_ids);
        assert!(loaded_ids.contains(&a_id) && loaded_ids.contains(&b_id));

        assert_eq!(loaded.bridge_count(), 1);
        let loaded_bridge = loaded.bridges().next().expect("one bridge");
        assert_eq!(loaded_bridge.id, bridge_id);
        assert_eq!(loaded_bridge.from, a_id);
        assert_eq!(loaded_bridge.to, b_id);

        // AC5 lists names AND positions among the preserved fields — assert the
        // full (id, name, position coeffs) tuple survives the round-trip, not
        // just the id set.
        let coeffs = |p: &PlateauNode| p.position().coeffs;
        let a_orig = original.plateau(&a_id).expect("a in original");
        let a_back = loaded.plateau(&a_id).expect("a in loaded");
        assert_eq!(a_back.name, a_orig.name);
        assert_eq!(coeffs(a_back), coeffs(a_orig));
        assert_eq!(a_back.name, "Linear Algebra");

        let b_orig = original.plateau(&b_id).expect("b in original");
        let b_back = loaded.plateau(&b_id).expect("b in loaded");
        assert_eq!(b_back.name, b_orig.name);
        assert_eq!(coeffs(b_back), coeffs(b_orig));
        assert_eq!(b_back.name, "Topology");

        // Bridge geometry (the rotor) must survive too.
        let orig_bridge = original.bridges().next().expect("orig bridge");
        assert_eq!(loaded_bridge.rotor().coeffs, orig_bridge.rotor().coeffs);
        assert_eq!(loaded_bridge.concept_label, "continuity");
    }
}
