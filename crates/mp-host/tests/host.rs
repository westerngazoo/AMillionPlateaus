//! Integration tests for the native graph host (SPEC-0017 §6, R-0017 AC7).
//! Exercises seed/stats/merge via the library against real redb tempfiles —
//! each call opens its own CrdtStore and drops it, so a later `stats` is a
//! genuine fresh-process-style reopen (durable round-trip).

use std::path::PathBuf;

use mp_crdt::CrdtDoc;
use mp_domain::PlateauNode;
use uuid::Uuid;

fn tmp_db() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("graph.redb");
    (dir, path)
}

#[test]
fn seed_then_stats_reports_the_world() {
    let (_d, db) = tmp_db();
    mp_host::seed(&db).expect("seed");
    let s = mp_host::stats(&db).expect("stats");
    assert_eq!(s.plateaus, 4, "seed has 4 plateaus");
    assert_eq!(s.bridges, 3, "seed has 3 bridges");
    assert_eq!(s.resources, 0);
    assert_eq!(s.crystallized, 0);
}

#[test]
fn re_seed_is_idempotent() {
    let (_d, db) = tmp_db();
    mp_host::seed(&db).expect("seed 1");
    mp_host::seed(&db).expect("seed 2"); // fixed ids ⇒ upsert, no duplication
    mp_host::seed(&db).expect("seed 3");
    let s = mp_host::stats(&db).expect("stats");
    assert_eq!(s.plateaus, 4, "re-seeding does not duplicate");
    assert_eq!(s.bridges, 3);
}

#[test]
fn stats_on_absent_store_is_zero_and_creates_no_file() {
    let dir = tempfile::tempdir().expect("tempdir");
    let db = dir.path().join("absent.redb");
    let s = mp_host::stats(&db).expect("stats on absent");
    assert_eq!(s.plateaus, 0);
    assert_eq!(s.bridges, 0);
    assert!(!db.exists(), "read-only stats must not materialise a file");
}

#[test]
fn merge_ingests_a_save_blob_and_is_idempotent() {
    let (_d, db) = tmp_db();
    mp_host::seed(&db).expect("seed");
    let before = mp_host::stats(&db).expect("stats before");

    // A browser-style snapshot: an independently-bootstrapped CrdtDoc with one
    // extra plateau (fresh random id), serialized exactly as WasmCrdtDoc.save().
    let mut snap = CrdtDoc::new().expect("snapshot doc");
    let extra = PlateauNode::new("Extra", Uuid::new_v4(), 1.0, 0.0, 0.0);
    snap.add_plateau(&extra).expect("add extra");
    let bytes = snap.save();

    mp_host::merge(&db, &bytes).expect("merge");
    let after = mp_host::stats(&db).expect("stats after");
    assert_eq!(
        after.plateaus,
        before.plateaus + 1,
        "merge unions the snapshot's plateau into the durable store"
    );

    // Re-merging the same snapshot changes nothing (CRDT idempotent).
    mp_host::merge(&db, &bytes).expect("re-merge");
    assert_eq!(mp_host::stats(&db).expect("stats").plateaus, after.plateaus);
}

#[test]
fn durable_round_trip_across_fresh_opens() {
    let (_d, db) = tmp_db();
    mp_host::seed(&db).expect("seed");
    // Each lib call opens + drops its own CrdtStore, so this stats() is a fresh
    // open of the persisted redb file — the durable round-trip.
    let s = mp_host::stats(&db).expect("reopen stats");
    assert_eq!(s.plateaus, 4);
    assert_eq!(s.bridges, 3);
}

#[test]
fn merge_of_a_corrupt_blob_errors_not_panics() {
    let (_d, db) = tmp_db();
    mp_host::seed(&db).expect("seed");
    let err = mp_host::merge(&db, b"not an automerge blob");
    assert!(err.is_err(), "a corrupt snapshot must error, never panic");
    // The store is still intact and readable after the failed merge.
    assert_eq!(mp_host::stats(&db).expect("stats").plateaus, 4);
}
