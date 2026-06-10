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

pub mod import;
use import::RawNote;

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

/// Counts from an `import` run (SPEC-0021).
pub struct ImportStats {
    pub notes: usize,
    pub bridges: usize,
    pub resources: usize,
}

/// Errors from `import`: filesystem I/O or CRDT assembly. Library error style
/// (CLAUDE.md) — never panics across the call.
#[derive(thiserror::Error, Debug)]
pub enum ImportError {
    #[error("vault read error: {0}")]
    Io(#[from] std::io::Error),
    #[error("crdt error: {0}")]
    Crdt(#[from] CrdtError),
}

/// `import <vault-dir> <out.bin>` — walk `*.md` under `vault-dir`, map the vault
/// to a knowledge graph (notes→plateaus with bodies, `[[links]]`→bridges,
/// pdf/external links→resources; deterministic GA positions + UUIDv5 ids), and
/// write a `CrdtDoc::save()` blob to `out`. The blob is browser-loadable ("Import
/// a world") and composes with `merge` for the durable redb store. Pure mapping
/// lives in `import.rs`; the only I/O is the directory walk + the blob write.
pub fn import(vault_dir: &Path, out: &Path) -> Result<ImportStats, ImportError> {
    let mut notes = Vec::new();
    read_notes(vault_dir, vault_dir, &mut notes)?;

    let g = import::build_graph(&notes);

    let mut doc = CrdtDoc::new()?;
    // Sort each set by id before adding, so the emitted blob is byte-reproducible
    // across runs (the graph's `resources` is a HashMap with random iteration
    // order). Convergence is already id-keyed; sorting just makes the bytes stable.
    let mut plateaus: Vec<&PlateauNode> = g.plateaus().collect();
    plateaus.sort_by_key(|p| p.id);
    for p in &plateaus {
        doc.add_plateau(p)?;
    }
    let mut bridges: Vec<&Bridge> = g.bridges().collect();
    bridges.sort_by_key(|b| b.id);
    for b in &bridges {
        doc.add_bridge(b)?;
    }
    let mut resources: Vec<_> = g.resources.values().collect();
    resources.sort_by_key(|r| r.id);
    for r in &resources {
        doc.add_resource(r)?;
    }
    std::fs::write(out, doc.save())?;

    Ok(ImportStats {
        notes: plateaus.len(),
        bridges: bridges.len(),
        resources: resources.len(),
    })
}

/// Recursively collect `*.md` notes under `root`, skipping dot-directories
/// (`.obsidian`, `.trash`, `.git`). `rel` keeps each note's path RELATIVE to the
/// vault root — the stable key for its plateau id (SPEC-0021 §2.4). The only
/// filesystem reads in the importer; a read error surfaces, never silently drops.
fn read_notes(root: &Path, dir: &Path, out: &mut Vec<RawNote>) -> Result<(), std::io::Error> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)?.collect::<Result<_, _>>()?;
    entries.sort_by_key(|e| e.path()); // deterministic walk order
    for entry in entries {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if path.is_dir() {
            if name.starts_with('.') {
                continue; // skip .obsidian / .trash / .git
            }
            read_notes(root, &path, out)?;
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .map(str::to_ascii_lowercase)
            == Some("md".to_string())
        {
            let rel_path = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            let body = std::fs::read_to_string(&path)?;
            out.push(RawNote {
                rel_path,
                stem,
                body,
            });
        }
    }
    Ok(())
}
