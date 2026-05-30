//! Seed graph: 5 plateaus, 4 bridges. Phase 0 deliverable (R-0001 AC6).
//!
//!   cargo run -p mp-graph --example seed_graph

use mp_graph::{ga, Bridge, KnowledgeGraph, PlateauNode};
use uuid::Uuid;

fn main() {
    // Three meta-domains share one DomainId for this hardcoded seed.
    let domain = Uuid::new_v4();
    let author = Uuid::new_v4();

    // e1 = Formal/Mathematical, e2 = Physical/Empirical, e3 = Creative/Expressive.
    let linear_algebra = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0)
        .with_description("Vector spaces, transformations, eigenstructure.");
    let diff_geometry = PlateauNode::new("Differential Geometry", domain, 0.7, 0.5, 0.1)
        .with_description("Curvature, manifolds, connections.");
    let classical_mechanics = PlateauNode::new("Classical Mechanics", domain, 0.5, 0.8, 0.0)
        .with_description("Motion, force, Lagrangian and Hamiltonian dynamics.");
    let music_theory = PlateauNode::new("Music Theory", domain, 0.3, 0.4, 0.8)
        .with_description("Harmony, rhythm, the mathematics of sound.");
    let symmetry = PlateauNode::new("Symmetry", domain, 0.5, 0.5, 0.5)
        .with_description("Groups, invariance — where math, physics and art meet.");

    let mut graph = KnowledgeGraph::new();

    // Build bridges before the plateaus are moved into the graph.
    let bridges = vec![
        Bridge::between(
            &linear_algebra,
            &diff_geometry,
            "linear transformation",
            author,
        ),
        Bridge::between(
            &diff_geometry,
            &classical_mechanics,
            "geodesic motion",
            author,
        ),
        Bridge::between(&linear_algebra, &symmetry, "group representation", author),
        Bridge::between(&music_theory, &symmetry, "harmonic invariance", author),
    ];

    for plateau in [
        linear_algebra,
        diff_geometry,
        classical_mechanics,
        music_theory,
        symmetry,
    ] {
        graph.add_plateau(plateau);
    }

    for bridge in bridges {
        graph
            .add_bridge(bridge)
            .expect("seed bridge endpoints were added above");
    }

    println!("Knowledge graph seeded.\n");
    println!("Plateaus ({}):", graph.plateau_count());
    for p in graph.plateaus() {
        let pos = p.position();
        println!(
            "  • {:<24} grade {}  |position| {:.3}  — {}",
            p.name,
            ga::dominant_grade(pos),
            ga::norm(pos),
            p.description
        );
    }

    println!("\nBridges ({}):", graph.bridge_count());
    for b in graph.bridges() {
        let from = graph
            .plateau(&b.from)
            .map(|p| p.name.as_str())
            .unwrap_or("?");
        let to = graph.plateau(&b.to).map(|p| p.name.as_str()).unwrap_or("?");
        let arrow = if b.bidirectional { "<->" } else { "-->" };
        println!(
            "  • {:<22} {} {:<22} grade {}  [{}]",
            from, arrow, to, b.dominant_grade, b.concept_label
        );
    }
}
