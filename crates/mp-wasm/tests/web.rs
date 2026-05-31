//! `#[wasm_bindgen_test]` smoke tests for the `WasmGraph` binding surface
//! (SPEC-0003 §3, AC6). These exercise the parts that genuinely need the
//! wasm/JS runtime — `JsValue` marshalling, thrown `JsError`. The pure
//! conversion logic is covered host-side in `src/convert.rs`.
//!
//! Gated to wasm32 so the host `cargo test --workspace` gate stays green; run
//! these with `wasm-pack test --node crates/mp-wasm`.
#![cfg(target_arch = "wasm32")]

use mp_wasm::WasmGraph;
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
