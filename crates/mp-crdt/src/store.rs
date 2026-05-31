//! `CrdtStore` — redb-backed persistence for a replica.
//!
//! The stored artifact is one opaque Automerge save blob (not the per-entity
//! bincode rows `mp-graph`'s `GraphDb` manages), so the CRDT owns its own redb
//! table rather than extending `GraphDb` (SPEC-0004 §2.5). The canonical cycle
//! is: [`CrdtStore::load`] → [`CrdtDoc::merge`] an incoming replica →
//! [`CrdtStore::persist`]; the reloaded document equals the merged one
//! (R-0004 AC7).

use std::path::Path;

use redb::{Database, ReadableTable, TableDefinition};

use crate::doc::CrdtDoc;
use crate::error::CrdtError;

const DOC: TableDefinition<&str, &[u8]> = TableDefinition::new("crdt_doc");
const SNAPSHOT: &str = "snapshot";

/// A redb database holding a single CRDT document snapshot.
pub struct CrdtStore {
    db: Database,
}

impl CrdtStore {
    /// Create a new store (errors if the file already exists per redb's rules).
    pub fn create<P: AsRef<Path>>(path: P) -> Result<Self, CrdtError> {
        let db = Database::create(path).map_err(store_err)?;
        Ok(Self { db })
    }

    /// Open an existing store.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, CrdtError> {
        let db = Database::open(path).map_err(store_err)?;
        Ok(Self { db })
    }

    /// Load the stored replica, or `None` if nothing has been persisted yet.
    pub fn load(&self) -> Result<Option<CrdtDoc>, CrdtError> {
        let txn = self.db.begin_read().map_err(store_err)?;
        let table = match txn.open_table(DOC) {
            Ok(t) => t,
            // No table yet → nothing persisted.
            Err(redb::TableError::TableDoesNotExist(_)) => return Ok(None),
            Err(e) => return Err(store_err(e)),
        };
        // Copy the snapshot out so the redb access guard is dropped before we
        // build (and possibly error on) the document.
        let bytes: Option<Vec<u8>> = table
            .get(SNAPSHOT)
            .map_err(store_err)?
            .map(|guard| guard.value().to_vec());
        match bytes {
            Some(bytes) => Ok(Some(CrdtDoc::load(&bytes)?)),
            None => Ok(None),
        }
    }

    /// Persist the replica, overwriting any previous snapshot.
    pub fn persist(&self, doc: &mut CrdtDoc) -> Result<(), CrdtError> {
        let bytes = doc.save();
        let txn = self.db.begin_write().map_err(store_err)?;
        {
            let mut table = txn.open_table(DOC).map_err(store_err)?;
            table
                .insert(SNAPSHOT, bytes.as_slice())
                .map_err(store_err)?;
        }
        txn.commit().map_err(store_err)?;
        Ok(())
    }
}

fn store_err<E: std::fmt::Display>(e: E) -> CrdtError {
    CrdtError::Storage(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use mp_graph::{KnowledgeGraph, PlateauNode};
    use uuid::Uuid;

    #[test]
    fn empty_store_loads_none() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = CrdtStore::create(dir.path().join("c.redb")).expect("create");
        assert!(store.load().expect("load").is_none());
    }

    #[test]
    fn load_merge_persist_round_trips() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("c.redb");
        let domain = Uuid::new_v4();

        // Seed an initial replica on disk.
        let mut base = KnowledgeGraph::new();
        let p1 = PlateauNode::new("Group Theory", domain, 0.8, 0.2, 0.1);
        let p1_id = p1.id;
        base.add_plateau(p1);
        {
            let store = CrdtStore::create(&path).expect("create");
            let mut doc = CrdtDoc::from_graph(&base).expect("hydrate");
            store.persist(&mut doc).expect("persist");
        }

        // An incoming replica carries a second plateau.
        let p2 = PlateauNode::new("Symmetry", domain, 0.5, 0.4, 0.3);
        let p2_id = p2.id;
        let mut incoming = CrdtDoc::new().expect("new");
        incoming.add_plateau(&p2).expect("add");

        // load → merge → persist
        let store = CrdtStore::open(&path).expect("open");
        let mut doc = store.load().expect("load").expect("present");
        doc.merge(&mut incoming).expect("merge");
        store.persist(&mut doc).expect("persist");

        // Reload equals the merged doc and projects to the union.
        let mut reloaded = store.load().expect("reload").expect("present");
        assert_eq!(reloaded.heads(), doc.heads());
        let g = reloaded.to_graph().expect("project");
        assert_eq!(g.plateau_count(), 2);
        assert!(g.plateau(&p1_id).is_some());
        assert!(g.plateau(&p2_id).is_some());
    }
}
