//! `#[wasm_bindgen_test]` smoke tests for the `WasmGraph` binding surface
//! (SPEC-0003 §3, AC6). These exercise the parts that genuinely need the
//! wasm/JS runtime — `JsValue` marshalling, thrown `JsError`. The pure
//! conversion logic is covered host-side in `src/convert.rs`.
//!
//! Gated to wasm32 so the host `cargo test --workspace` gate stays green; run
//! these with `wasm-pack test --node crates/mp-wasm`.
#![cfg(target_arch = "wasm32")]

use mp_wasm::{WasmCrdtDoc, WasmGraph, WasmSyncSession};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

/// AC1 — build a graph with two plateaus and a bridge end-to-end.
#[wasm_bindgen_test]
fn build_graph_smoke() {
    let domain = "00000000-0000-0000-0000-000000000001";
    let mut g = WasmGraph::new();
    let a = g.add_plateau("A", domain, 1.0, 0.0, 0.0).expect("add A");
    let b = g.add_plateau("B", domain, 0.0, 0.0, 1.0).expect("add B");
    g.add_bridge(&a, &b, "concept").expect("bridge A→B");

    // An unknown endpoint is a thrown JS Error, not a silent success.
    assert!(g
        .add_bridge(&a, "11111111-0000-0000-0000-000000000000", "x")
        .is_err());
    // A malformed UUID is rejected too.
    assert!(g.add_plateau("bad", "not-a-uuid", 1.0, 0.0, 0.0).is_err());
}

/// AC2 — plateau() returns a JS object for a known id and null for unknown.
#[wasm_bindgen_test]
fn plateau_roundtrip() {
    let domain = "00000000-0000-0000-0000-000000000001";
    let mut g = WasmGraph::new();
    let a = g
        .add_plateau("Linear Algebra", domain, 0.9, 0.2, 0.5)
        .expect("add");

    let val = g.plateau(&a).expect("known id");
    assert!(!val.is_null(), "known plateau must marshal to a JS object");

    let unknown = g
        .plateau("99999999-0000-0000-0000-000000000000")
        .expect("unknown id is Ok(null)");
    assert_eq!(unknown, JsValue::NULL);
}

/// AC3/AC4 — fog queries cross the boundary and the Sybil property holds.
#[wasm_bindgen_test]
fn fog_queries_smoke() {
    let domain = "00000000-0000-0000-0000-000000000001";
    let mut g = WasmGraph::new();
    let a = g.add_plateau("A", domain, 1.0, 0.0, 0.0).expect("add A");

    // Aligned, strong reputation reaches A.
    let rep = format!(
        r#"{{ "domain_reps": {{ "{domain}": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
    );
    assert!(g.is_reachable(&a, &rep).expect("query"));
    assert!(g.reachable_plateaus(&rep).expect("query").contains(&a));

    // Scalar-only (Sybil) reputation sees only fog.
    let sybil = format!(
        r#"{{ "domain_reps": {{ "{domain}": [1000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
    );
    assert!(!g.is_reachable(&a, &sybil).expect("query"));
    assert!(g.reachable_plateaus(&sybil).expect("query").is_empty());
}

/// R-0007 — the graph-grounded retrieval ranking crosses the boundary: rows
/// come back ordered by descending projection score, and an invalid `k` is a
/// graceful thrown `Error`, never a panic across the FFI.
#[wasm_bindgen_test]
fn nearest_plateaus_ranks_and_validates_k() {
    #[derive(serde::Deserialize)]
    struct NearestRow {
        id: String,
        #[allow(dead_code)]
        name: String,
        score: f32,
    }

    let domain = "00000000-0000-0000-0000-000000000001";
    let mut g = WasmGraph::new();
    let a = g.add_plateau("A", domain, 1.0, 0.0, 0.0).expect("add A");
    let _b = g.add_plateau("B", domain, 0.0, 0.0, 1.0).expect("add B");
    // Reputation faces A (e1).
    let rep = format!(
        r#"{{ "domain_reps": {{ "{domain}": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
    );

    let val = g.nearest_plateaus(&rep, 2.0).expect("nearest query");
    let rows: Vec<NearestRow> = serde_wasm_bindgen::from_value(val).expect("decode rows");
    assert_eq!(rows.len(), 2, "k rows returned");
    assert_eq!(rows[0].id, a, "A (e1) is nearest the e1 orientation");
    assert!(
        rows[0].score >= rows[1].score,
        "rows are descending by score"
    );

    // Invalid k crosses the FFI as a graceful Err, not a panic.
    assert!(g.nearest_plateaus(&rep, -1.0).is_err(), "negative k errors");
    assert!(g.nearest_plateaus(&rep, f64::NAN).is_err(), "NaN k errors");
}

/// R-0005 AC3 — two **independently constructed** CRDT replicas, each with its
/// own sync session, converge on a plateau over the wasm/JS runtime: exactly the
/// shape the two-tab BroadcastChannel POC drives. Replica A adds a plateau; we
/// pump byte messages both ways until quiescence; B must then see the plateau,
/// and both replicas must agree on the four root keys (no reputation key on the
/// wire — AC7). This is the binding-level guarantee under R-0004's convergence.
#[wasm_bindgen_test]
fn two_independent_replicas_sync_a_plateau_to_quiescence() {
    let domain = "00000000-0000-0000-0000-000000000001";

    let mut a = WasmCrdtDoc::new().expect("replica A");
    let mut b = WasmCrdtDoc::new().expect("replica B");
    let mut sa = WasmSyncSession::new();
    let mut sb = WasmSyncSession::new();

    let id = a
        .add_plateau("Linear Algebra", domain, 0.9, 0.2, 0.5)
        .expect("A adds a plateau");

    // Pump A↔B until neither side has anything left to send (convergence).
    let mut quiet = false;
    let mut guard = 0;
    while !quiet {
        quiet = true;
        if let Some(msg) = a.generate_message(&mut sa) {
            b.receive_message(&mut sb, &msg).expect("B applies A's msg");
            quiet = false;
        }
        if let Some(msg) = b.generate_message(&mut sb) {
            a.receive_message(&mut sa, &msg).expect("A applies B's msg");
            quiet = false;
        }
        guard += 1;
        assert!(guard < 100, "sync did not reach quiescence");
    }

    // B now sees the plateau A authored.
    let bg = b.to_graph().expect("project B");
    let seen = bg.plateau(&id).expect("query B for the plateau");
    assert!(!seen.is_null(), "B must see the plateau A authored");

    // Both replicas agree on exactly the four data maps — no reputation key.
    assert_eq!(a.root_keys(), b.root_keys());
    assert_eq!(
        a.root_keys(),
        vec!["bridges", "plateaus", "resources", "votes"]
    );
}
