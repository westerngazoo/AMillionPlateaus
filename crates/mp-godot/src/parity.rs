//! C5 — binding parity. Assert the native (`mp-godot`) DTO JSON shapes match the
//! shared contract the web binding (`mp-wasm`) emits.
//!
//! The two bindings **cannot import each other** — a binding→binding edge would
//! invert the topology (SPEC-0025 §2.1). So equivalence is asserted STRUCTURALLY
//! against the same expected key sets, duplicated verbatim in `mp-wasm`'s own
//! `parity` module. The `*_KEYS` contracts below are the single source of truth
//! for "what a plateau / bridge / resource / path / nearest row / reachable set
//! looks like on the wire"; if the two copies ever drift, the web and Godot
//! clients would silently disagree, so both are kept byte-identical by hand and
//! guarded by these tests. Test-only (`#[cfg(test)]`); no engine, no GA.

#![cfg(test)]

use mp_domain::{Bridge, KnowledgeGraph, PlateauNode, Resource, ResourceKind};
use uuid::Uuid;

use crate::dto::{bridge_dto, path_dto, plateau_dto, resource_dto, NearestDto};

// ─── The shared DTO contract — MUST stay byte-identical to mp-wasm::parity ────
const PLATEAU_KEYS: [&str; 5] = ["description", "domain_id", "id", "name", "position"];
const POSITION_KEYS: [&str; 3] = ["e1", "e2", "e3"];
const BRIDGE_KEYS: [&str; 4] = ["concept", "from", "id", "to"];
const RESOURCE_KEYS: [&str; 7] = ["id", "kind", "plateau_id", "state", "title", "uri", "vote_count"];
const PATH_KEYS: [&str; 5] = ["domains", "goal", "id", "steps", "title"];
const NEAREST_KEYS: [&str; 3] = ["id", "name", "score"];

fn sorted_keys(v: &serde_json::Value) -> Vec<String> {
    let mut keys: Vec<String> = v.as_object().expect("object").keys().cloned().collect();
    keys.sort();
    keys
}

#[test]
fn plateau_shape_matches_contract() {
    let p = PlateauNode::new("Calc", Uuid::new_v4(), 0.9, 0.1, 0.2);
    let v = serde_json::to_value(plateau_dto(&p)).expect("serialise");
    assert_eq!(sorted_keys(&v), PLATEAU_KEYS);
    assert_eq!(sorted_keys(&v["position"]), POSITION_KEYS);
}

#[test]
fn bridge_shape_matches_contract() {
    let d = Uuid::new_v4();
    let a = PlateauNode::new("A", d, 0.9, 0.1, 0.0);
    let b = PlateauNode::new("B", d, 0.6, 0.5, 0.1);
    let bridge = Bridge::between(&a, &b, "concept", Uuid::nil());
    let v = serde_json::to_value(bridge_dto(&bridge)).expect("serialise");
    assert_eq!(sorted_keys(&v), BRIDGE_KEYS);
}

#[test]
fn resource_shape_matches_contract() {
    let r = Resource::new(Uuid::new_v4(), "T", ResourceKind::Article, "u", Uuid::nil());
    let v = serde_json::to_value(resource_dto(&r)).expect("serialise");
    assert_eq!(sorted_keys(&v), RESOURCE_KEYS);
}

#[test]
fn path_shape_matches_contract() {
    let dto = path_dto(
        &Uuid::new_v4().to_string(),
        "T",
        "G",
        &[Uuid::new_v4().to_string()],
        &[Uuid::new_v4().to_string()],
    );
    let v = serde_json::to_value(dto).expect("serialise");
    assert_eq!(sorted_keys(&v), PATH_KEYS);
}

#[test]
fn nearest_shape_matches_contract() {
    let dto = NearestDto {
        id: "x".into(),
        name: "n".into(),
        score: 1.0,
    };
    let v = serde_json::to_value(dto).expect("serialise");
    assert_eq!(sorted_keys(&v), NEAREST_KEYS);
}

#[test]
fn reachable_is_a_flat_array_of_id_strings() {
    // The fog set is a flat JSON array of plateau-id strings — no object keys.
    let domain = Uuid::new_v4();
    let mut g = KnowledgeGraph::new();
    let p = PlateauNode::new("A", domain, 1.0, 0.0, 0.0);
    let pid = p.id;
    g.add_plateau(p);
    let json = format!(
        r#"{{ "domain_reps": {{ "{domain}": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
    );
    let ids = crate::reputation::reachable_ids(&g, &json).expect("reachable");
    let v = serde_json::to_value(&ids).expect("serialise");
    let arr = v.as_array().expect("array");
    assert!(arr.iter().all(|e| e.is_string()), "all elements are strings");
    assert!(ids.contains(&pid.to_string()));
}
