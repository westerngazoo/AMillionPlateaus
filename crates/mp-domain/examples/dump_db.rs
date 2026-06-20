//! Dump a real GA db: seed a tiny graph, persist it to a redb file, then show
//! what is actually on disk — the redb tables, the row count, and a hexdump of
//! one plateau's bincode bytes. A tangible "sample of the db".
//!
//!   cargo run -p mp-domain --example dump_db
//!
//! Ids/created_at are pinned to nil/0 so the bytes are reproducible run-to-run
//! and match the golden in `tests/persistence.rs`.

use mp_domain::{ga, Bridge, GeoGraph, GraphDb, PlateauNode};
use std::fs;
use uuid::Uuid;

fn main() {
    // One deterministic plateau (matches the persistence.rs golden fixture) plus
    // a second so we also persist a bridge (an even-grade rotor).
    let mut la = PlateauNode::new("Linear Algebra", Uuid::nil(), 0.9, 0.1, 0.0)
        .with_description("vector spaces");
    la.id = Uuid::nil();
    la.created_at = 0;
    la.fog = true;

    let mut sym = PlateauNode::new("Symmetry", Uuid::nil(), 0.5, 0.5, 0.5)
        .with_description("groups, invariance");
    sym.id = Uuid::from_u128(1);
    sym.created_at = 0;
    sym.fog = true;

    let mut bridge = Bridge::between(&la, &sym, "group representation", Uuid::nil());
    bridge.id = Uuid::from_u128(2);

    let rotor = *bridge.rotor();
    println!("garust geometric product → rotor:");
    println!(
        "  coeffs [1,e1,e2,e12,e3,e13,e23,e123] = {:?}",
        rotor.coeffs
    );
    println!(
        "  dominant grade {}  (even-grade rotor; |R| = {:.3})\n",
        bridge.dominant_grade,
        ga::norm(&rotor)
    );

    let mut graph: GeoGraph<PlateauNode, Bridge> = GeoGraph::new();
    let la_id = la.id;
    graph.add_node(la);
    graph.add_node(sym);
    graph.add_edge(bridge).expect("endpoints exist");

    // Persist to a real redb file.
    let path = std::env::temp_dir().join("mp-sample.redb");
    let _ = fs::remove_file(&path);
    let db = GraphDb::create(&path).expect("create db");
    db.save(&graph).expect("save");

    let bytes = fs::read(&path).expect("read db file");
    println!("redb file: {}", path.display());
    println!("  total size on disk: {} bytes", bytes.len());
    println!("  tables: \"plateaus\" (nodes), \"bridges\" (edges)\n");

    // Show the exact bincode row the store wrote for the Linear Algebra node.
    let loaded: GeoGraph<PlateauNode, Bridge> = db.load().expect("load");
    let row = loaded.node(&la_id).expect("node present");
    let row_bytes = bincode::serialize(row).expect("serialize row");
    println!(
        "\"plateaus\" row  key = {} ({} bincode value bytes):",
        la_id,
        row_bytes.len()
    );
    hexdump(&row_bytes);

    // Prove load re-validated the GA invariant (grade-1 position).
    println!(
        "\nloaded back: {:<16} grade {}  |position| {:.3}",
        row.name,
        ga::dominant_grade(row.position()),
        ga::norm(row.position())
    );
}

fn hexdump(bytes: &[u8]) {
    for (i, chunk) in bytes.chunks(16).enumerate() {
        let hex: Vec<String> = chunk.iter().map(|b| format!("{b:02x}")).collect();
        let ascii: String = chunk
            .iter()
            .map(|&b| {
                if (0x20..0x7f).contains(&b) {
                    b as char
                } else {
                    '.'
                }
            })
            .collect();
        println!("  {:04x}  {:<48}  {}", i * 16, hex.join(" "), ascii);
    }
}
