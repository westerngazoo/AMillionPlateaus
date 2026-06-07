//! mp-host — a durable native graph host over the redb-backed `CrdtStore`
//! (SPEC-0017 / R-0017). The first application to actually use the native
//! durable store (GA_DB.md §6: redb built + tested but, until now, unwired).
//!
//! Three commands: `seed` a canonical world into a redb store, `stats` the
//! persisted graph, and `merge` an Automerge save-blob (a browser's
//! `WasmCrdtDoc.save()` / IndexedDB snapshot) into the durable store — making
//! "one save-blob, two backings" concrete with no network transport.
//!
//! The host persists ONLY the CRDT document (the four data maps `{bridges,
//! plateaus, resources, votes}`). It stores no reputation (recomputed from the
//! signed-event log elsewhere, never here) and computes nothing authoritative:
//! `stats` derives its counts via `to_graph` (crystallization included). It is a
//! durable holder of the graph, not a second authority (CLAUDE.md §6/§7).

use std::path::Path;

use mp_crdt::{CrdtDoc, CrdtError, CrdtStore};
use mp_domain::{Bridge, KnowledgeGraph, PlateauNode, ResourceState};
use uuid::Uuid;

// `CrdtStore::create` is redb's create-if-missing: it opens an existing valid
// store without error and initialises a new one only when absent/empty — so it
// IS an open-or-create, and the write paths call it directly (no `.exists()`
// race). `CrdtStore::open` (read-only `stats`) requires an existing file.

/// The seed world: a small set of plateaus + bridges with FIXED ids, so
/// re-seeding is an idempotent CRDT upsert (no duplication, R-0017 AC2). A
/// reduced variant of the `seed_graph` example, kept inline so this crate is
/// self-contained (a shared `seed_graph()` builder is a future tidy).
fn seed_graph() -> KnowledgeGraph {
    let domain = Uuid::from_u128(0x0d00);
    // Plateau with a FIXED id: `new` sets the (private) Grade-1 position; the id
    // override never touches it, so the invariant holds.
    let p = |n: u128, name: &str, e1, e2, e3| {
        let mut pl = PlateauNode::new(name, domain, e1, e2, e3);
        pl.id = Uuid::from_u128(n);
        pl
    };
    let la = p(0xa1, "Linear Algebra", 0.9, 0.1, 0.0);
    let dg = p(0xa2, "Differential Geometry", 0.7, 0.5, 0.1);
    let mt = p(0xc1, "Music Theory", 0.3, 0.4, 0.8);
    let sym = p(0xa3, "Symmetry", 0.5, 0.5, 0.5);
    // Bridge with a FIXED id: `Bridge::between` derives the even-grade rotor from
    // the real positions before the id override.
    let b = |n: u128, from: &PlateauNode, to: &PlateauNode, concept: &str| {
        let mut br = Bridge::between(from, to, concept, Uuid::nil());
        br.id = Uuid::from_u128(n);
        br
    };
    let bridges = [
        b(0xb1, &la, &dg, "linear transformation"),
        b(0xb2, &la, &sym, "group representation"),
        b(0xb3, &mt, &sym, "harmonic invariance"),
    ];

    let mut g = KnowledgeGraph::new();
    for pl in [la, dg, mt, sym] {
        g.add_plateau(pl);
    }
    for br in bridges {
        // Endpoints were added immediately above — a construction-time invariant,
        // not fallible I/O (matches the seed_graph example).
        g.add_bridge(br)
            .expect("seed bridge endpoints were added above");
    }
    g
}

/// `seed <db>` — persist the seed world to the redb store; convergent on re-run
/// (fixed ids ⇒ idempotent upsert, R-0004).
pub fn seed(path: &Path) -> Result<(), CrdtError> {
    let store = CrdtStore::create(path)?; // create-if-missing (opens existing)
    let mut doc = store.load()?.unwrap_or(CrdtDoc::new()?);
    let g = seed_graph();
    for plateau in g.plateaus() {
        doc.add_plateau(plateau)?;
    }
    for bridge in g.bridges() {
        doc.add_bridge(bridge)?;
    }
    store.persist(&mut doc)?;
    Ok(())
}

/// Counts derived from the persisted graph (never a side table).
pub struct Stats {
    pub plateaus: usize,
    pub bridges: usize,
    pub resources: usize,
    pub voted: usize,
    pub crystallized: usize,
}

impl Stats {
    fn zero() -> Self {
        Stats {
            plateaus: 0,
            bridges: 0,
            resources: 0,
            voted: 0,
            crystallized: 0,
        }
    }
}

/// `stats <db>` — counts derived from the persisted CRDT via `to_graph`
/// (vote_count + crystallization are derived, R-0015). Read-only: an absent
/// store reports all-zero WITHOUT creating a file.
pub fn stats(path: &Path) -> Result<Stats, CrdtError> {
    if !path.exists() {
        return Ok(Stats::zero());
    }
    let store = CrdtStore::open(path)?;
    let Some(doc) = store.load()? else {
        return Ok(Stats::zero());
    };
    let g = doc.to_graph()?;
    let resources: Vec<_> = g.resources.values().collect();
    Ok(Stats {
        plateaus: g.plateaus().count(),
        bridges: g.bridges().count(),
        resources: resources.len(),
        voted: resources.iter().filter(|r| r.vote_count > 0.0).count(),
        crystallized: resources
            .iter()
            .filter(|r| matches!(r.state, ResourceState::Crystallized))
            .count(),
    })
}

/// `merge <db> <snapshot>` — merge an Automerge save-blob (a browser
/// `WasmCrdtDoc.save()` / IndexedDB snapshot) into the durable store. The merge
/// is convergent and idempotent (R-0004): the browser↔native bridge, no
/// transport. A corrupt or non-Automerge blob errors via `CrdtDoc::load`, never
/// panics.
pub fn merge(path: &Path, snapshot: &[u8]) -> Result<(), CrdtError> {
    let store = CrdtStore::create(path)?;
    let mut doc = store.load()?.unwrap_or(CrdtDoc::new()?);
    let mut incoming = CrdtDoc::load(snapshot)?;
    doc.merge(&mut incoming)?;
    store.persist(&mut doc)?;
    Ok(())
}
