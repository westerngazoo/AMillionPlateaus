//! Regression guard for the SPEC-0008 move (R-0008 AC4): the *serialized shape*
//! of the domain types — the CRDT JSON wire contract and the redb/bincode disk
//! contract — must not change when the types move onto the generic store. If
//! anyone nests today's flat fields under a payload (the rejected `Node<M>`
//! form), or reorders/renames, these tests fail.

use mp_domain::{ga, Bridge, GeoGraph, GraphDb, PlateauNode};
use uuid::Uuid;

/// A fully deterministic `PlateauNode` fixture: every otherwise-random or
/// wall-clock field is pinned, so its serialized bytes are reproducible and can
/// be asserted against a literal golden. `position` (the only private field) is
/// set deterministically by `new` from the e1/e2/e3 args.
fn fixed_plateau() -> PlateauNode {
    let mut p = PlateauNode::new("Linear Algebra", Uuid::nil(), 0.9, 0.1, 0.0)
        .with_description("vector spaces");
    p.id = Uuid::nil();
    p.created_at = 0;
    p.fog = true;
    p
}

/// The CRDT wire contract: `mp-crdt` stores each plateau as a serde-JSON string.
/// Its object must stay flat with exactly these keys, and `position` an 8-array.
#[test]
fn plateau_json_shape_is_flat_and_stable() {
    let p = PlateauNode::new("Linear Algebra", Uuid::nil(), 0.9, 0.1, 0.0)
        .with_description("vector spaces");
    let json = serde_json::to_value(&p).expect("serialize");
    let obj = json
        .as_object()
        .expect("plateau is a JSON object (flat, not nested)");

    let mut keys: Vec<&str> = obj.keys().map(String::as_str).collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "created_at",
            "description",
            "domain_id",
            "fog",
            "id",
            "name",
            "position",
        ],
        "plateau serde keys must stay flat and unchanged"
    );

    let pos = obj["position"].as_array().expect("position is an array");
    assert_eq!(pos.len(), 8, "position is the 8-coeff multivector array");
    // Pin the FULL blade layout `[1, e1, e2, e12, e3, e13, e23, e123]`, not just
    // the key set: a reorder of the coeff array (e.g. e3 moving off index 4)
    // would silently change every persisted byte yet still be an 8-array. The
    // interleaved e3 slot (index 4) is the layout position most prone to drift.
    let coeffs: Vec<f64> = pos.iter().map(|c| c.as_f64().unwrap()).collect();
    let expected = [0.0, 0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0];
    for (i, (got, want)) in coeffs.iter().zip(expected.iter()).enumerate() {
        assert!(
            (got - want).abs() < 1e-6,
            "position[{i}] = {got}, expected {want} \
             (blade layout [1,e1,e2,e12,e3,e13,e23,e123] must be stable)"
        );
    }
    assert_eq!(obj["name"], "Linear Algebra");
}

/// The redb/bincode disk contract, pinned to the byte: a fully deterministic
/// `PlateauNode` fixture must serialize to a stable bincode byte string. This is
/// the literal "golden" the SPEC-0008 changelog deferred for the *random*-id
/// case — pinning id/created_at makes it reproducible. If the serde layout
/// changes (field reorder, nesting under `meta`, coeff-array reorder), the bytes
/// change and existing redb files / CRDT docs stop round-tripping (R-0008 AC4).
#[test]
fn plateau_bincode_bytes_are_stable_golden() {
    let p = fixed_plateau();
    let bytes = bincode::serialize(&p).expect("bincode serialize");

    // Golden captured from the post-SPEC-0008 flat layout. bincode is
    // length-prefixed and non-self-describing, so any shape change moves bytes.
    // NB: `Uuid`'s serde impl emits `serialize_bytes`, which bincode encodes as a
    // u64 length (16) prefix FOLLOWED by the 16 raw bytes — so each UUID is 24
    // bytes, not 16. A field reorder, a nesting under `meta`, or a coeff-array
    // reorder all move these bytes.
    let golden: &[u8] = &[
        // id: u64 len(16) + 16 nil bytes
        16, 0, 0, 0, 0, 0, 0, 0, //
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, // name: u64 len(14) + "Linear Algebra"
        14, 0, 0, 0, 0, 0, 0, 0, b'L', b'i', b'n', b'e', b'a', b'r', b' ', b'A', b'l', b'g', b'e',
        b'b', b'r', b'a', // description: u64 len(13) + "vector spaces"
        13, 0, 0, 0, 0, 0, 0, 0, b'v', b'e', b'c', b't', b'o', b'r', b' ', b's', b'p', b'a', b'c',
        b'e', b's', // domain_id: u64 len(16) + 16 nil bytes
        16, 0, 0, 0, 0, 0, 0, 0, //
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, // position: 8 f32 LE = [0,0.9,0.1,0,0,0,0,0]
        0x00, 0x00, 0x00, 0x00, // 0.0
        0x66, 0x66, 0x66, 0x3f, // 0.9
        0xcd, 0xcc, 0xcc, 0x3d, // 0.1
        0x00, 0x00, 0x00, 0x00, // 0.0
        0x00, 0x00, 0x00, 0x00, // 0.0 (e3)
        0x00, 0x00, 0x00, 0x00, // 0.0
        0x00, 0x00, 0x00, 0x00, // 0.0
        0x00, 0x00, 0x00, 0x00, // 0.0
        // fog: true
        1, // created_at: u64 = 0
        0, 0, 0, 0, 0, 0, 0, 0,
    ];

    assert_eq!(
        bytes, golden,
        "PlateauNode bincode bytes changed — the redb/CRDT serde contract (R-0008 AC4) is broken"
    );

    // Round-trips back to an equal value.
    let back: PlateauNode = bincode::deserialize(&bytes).expect("deserialize");
    assert_eq!(back.id, p.id);
    assert_eq!(back.name, p.name);
    assert_eq!(back.position().coeffs, p.position().coeffs);
}

/// The bridge wire contract: flat object, rotor an 8-array.
#[test]
fn bridge_json_shape_is_flat_and_stable() {
    let a = PlateauNode::new("A", Uuid::nil(), 0.9, 0.1, 0.0);
    let b = PlateauNode::new("B", Uuid::nil(), 0.3, 0.4, 0.8);
    let bridge = Bridge::between(&a, &b, "symmetry", Uuid::nil());
    let json = serde_json::to_value(&bridge).expect("serialize");
    let obj = json.as_object().expect("bridge is a JSON object");

    let mut keys: Vec<&str> = obj.keys().map(String::as_str).collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "bidirectional",
            "concept_label",
            "created_by",
            "dominant_grade",
            "from",
            "id",
            "rotor",
            "to",
        ],
        "bridge serde keys must stay flat and unchanged"
    );
    assert_eq!(obj["rotor"].as_array().expect("rotor array").len(), 8);
}

/// The disk contract: PlateauNode/Bridge round-trip through the generic GraphDb
/// (redb + bincode) intact, and the load path re-validates GA invariants.
#[test]
fn graphdb_round_trip_preserves_domain_graph() {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("graph.redb");

    let domain = Uuid::new_v4();
    let a = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
    let b = PlateauNode::new("Topology", domain, 0.7, 0.3, 0.2);
    let bridge = Bridge::between(&a, &b, "continuity", Uuid::new_v4());
    let (a_id, b_id, bridge_id) = (a.id, b.id, bridge.id);

    let mut original: GeoGraph<PlateauNode, Bridge> = GeoGraph::new();
    original.add_node(a);
    original.add_node(b);
    original.add_edge(bridge).expect("endpoints exist");

    let db = GraphDb::create(&path).expect("create db");
    db.save(&original).expect("save");
    let loaded: GeoGraph<PlateauNode, Bridge> = db.load().expect("load");

    assert_eq!(loaded.node_count(), 2);
    assert_eq!(loaded.edge_count(), 1);

    let a_back = loaded.node(&a_id).expect("a present");
    assert_eq!(a_back.name, "Linear Algebra");
    assert_eq!(a_back.position().coeffs, ga::vector(0.9, 0.1, 0.0).coeffs);

    let edge_back = loaded.edges().next().expect("one edge");
    assert_eq!(edge_back.id, bridge_id);
    assert_eq!(edge_back.from, a_id);
    assert_eq!(edge_back.to, b_id);
    assert_eq!(edge_back.concept_label, "continuity");

    assert!(loaded.node(&b_id).is_some());
}
