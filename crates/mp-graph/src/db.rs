//! redb-backed persistence for the geometric graph store.
//!
//! Nodes and edges are bincode-serialized, keyed by UUID bytes. A
//! save → load round-trip reconstructs an equivalent [`GeoGraph`]. Because the
//! *stored* type is the caller's own node/edge struct (the store never wraps
//! it), the bincode rows are byte-identical to what a non-generic store would
//! write — this is what preserves on-disk compatibility (SPEC-0008 §2.4).
//! Loaded records are re-validated against their geometric invariants.

use std::path::Path;

use redb::{Database, ReadableTable, TableDefinition};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::GraphError;
use crate::geo::{GeoGraph, Positioned, Rotored};

// Legacy table names kept verbatim so existing redb files keep loading
// (R-0008 AC4). The store is node/edge-generic; the strings are an opaque
// on-disk detail, not domain vocabulary.
const NODES: TableDefinition<&[u8], &[u8]> = TableDefinition::new("plateaus");
const EDGES: TableDefinition<&[u8], &[u8]> = TableDefinition::new("bridges");

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

    /// Persist every node and edge in one write transaction.
    pub fn save<N, E>(&self, graph: &GeoGraph<N, E>) -> Result<(), GraphError>
    where
        N: Positioned + Serialize,
        E: Rotored + Serialize,
    {
        let txn = self.db.begin_write().map_err(db_err)?;
        {
            let mut nodes = txn.open_table(NODES).map_err(db_err)?;
            for n in graph.nodes() {
                let value = bincode::serialize(n).map_err(ser_err)?;
                nodes
                    .insert(n.node_id().as_bytes().as_slice(), value.as_slice())
                    .map_err(db_err)?;
            }
            let mut edges = txn.open_table(EDGES).map_err(db_err)?;
            for e in graph.edges() {
                let value = bincode::serialize(e).map_err(ser_err)?;
                edges
                    .insert(e.edge_id().as_bytes().as_slice(), value.as_slice())
                    .map_err(db_err)?;
            }
        }
        txn.commit().map_err(db_err)?;
        Ok(())
    }

    /// Reconstruct a graph from disk, validating every record's invariants.
    pub fn load<N, E>(&self) -> Result<GeoGraph<N, E>, GraphError>
    where
        N: Positioned + DeserializeOwned,
        E: Rotored + DeserializeOwned,
    {
        let mut graph = GeoGraph::new();
        let txn = self.db.begin_read().map_err(db_err)?;

        let nodes = txn.open_table(NODES).map_err(db_err)?;
        for entry in nodes.iter().map_err(db_err)? {
            let (_, value) = entry.map_err(db_err)?;
            let node: N = bincode::deserialize(value.value()).map_err(ser_err)?;
            node.validate_position()?;
            graph.add_node(node);
        }

        let edges = txn.open_table(EDGES).map_err(db_err)?;
        for entry in edges.iter().map_err(db_err)? {
            let (_, value) = entry.map_err(db_err)?;
            let edge: E = bincode::deserialize(value.value()).map_err(ser_err)?;
            edge.validate_rotor()?;
            graph.add_edge(edge)?;
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
    use crate::ga::{self, Mv};
    use crate::geo::{EdgeId, NodeId};
    use serde::{Deserialize, Serialize};
    use std::collections::HashSet;
    use uuid::Uuid;

    #[derive(Serialize, Deserialize)]
    struct TestNode {
        id: NodeId,
        #[serde(with = "crate::ga::serde_mv")]
        pos: Mv,
    }

    impl Positioned for TestNode {
        fn node_id(&self) -> NodeId {
            self.id
        }
        fn position(&self) -> &Mv {
            &self.pos
        }
        fn validate_position(&self) -> Result<(), GraphError> {
            if ga::dominant_grade(&self.pos) != 1 {
                return Err(GraphError::Invariant("not grade-1".into()));
            }
            Ok(())
        }
    }

    #[derive(Serialize, Deserialize)]
    struct TestEdge {
        id: EdgeId,
        from: NodeId,
        to: NodeId,
        #[serde(with = "crate::ga::serde_mv")]
        rotor: Mv,
    }

    impl Rotored for TestEdge {
        fn edge_id(&self) -> EdgeId {
            self.id
        }
        fn endpoints(&self) -> (NodeId, NodeId) {
            (self.from, self.to)
        }
        fn rotor(&self) -> &Mv {
            &self.rotor
        }
        fn validate_rotor(&self) -> Result<(), GraphError> {
            if !ga::is_even_grade(&self.rotor) {
                return Err(GraphError::Invariant("not even-grade".into()));
            }
            Ok(())
        }
    }

    #[test]
    fn db_round_trip_preserves_generic_graph() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("graph.redb");

        let a = TestNode {
            id: Uuid::new_v4(),
            pos: ga::vector(0.9, 0.1, 0.0),
        };
        let b = TestNode {
            id: Uuid::new_v4(),
            pos: ga::vector(0.7, 0.3, 0.2),
        };
        let rotor = ga::normalize(&ga::even_grade(&(a.pos * b.pos)));
        let edge = TestEdge {
            id: Uuid::new_v4(),
            from: a.id,
            to: b.id,
            rotor,
        };
        let (a_id, b_id, edge_id) = (a.id, b.id, edge.id);

        let mut original: GeoGraph<TestNode, TestEdge> = GeoGraph::new();
        original.add_node(a);
        original.add_node(b);
        original.add_edge(edge).expect("endpoints exist");

        let db = GraphDb::create(&path).expect("create db");
        db.save(&original).expect("save");
        let loaded: GeoGraph<TestNode, TestEdge> = db.load().expect("load");

        let original_ids: HashSet<_> = original.nodes().map(|n| n.id).collect();
        let loaded_ids: HashSet<_> = loaded.nodes().map(|n| n.id).collect();
        assert_eq!(original_ids, loaded_ids);
        assert!(loaded_ids.contains(&a_id) && loaded_ids.contains(&b_id));

        assert_eq!(loaded.edge_count(), 1);
        let loaded_edge = loaded.edges().next().expect("one edge");
        assert_eq!(loaded_edge.id, edge_id);
        assert_eq!(loaded_edge.from, a_id);
        assert_eq!(loaded_edge.to, b_id);

        let a_back = loaded.node(&a_id).expect("a present");
        assert_eq!(a_back.pos.coeffs, ga::vector(0.9, 0.1, 0.0).coeffs);
    }
}
