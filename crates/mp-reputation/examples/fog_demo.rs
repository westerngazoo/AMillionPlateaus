//! Fog lift demo (R-0002 AC7).
//!
//!   cargo run -p mp-reputation --example fog_demo
//!
//! A fresh wizard sees only fog. Recording traversals grows a Grade-1 domain
//! reputation; plateaus the reputation "faces" (high inner-product projection)
//! emerge from the fog, while geometrically distant ones stay hidden.

use mp_graph::{Bridge, KnowledgeGraph, PlateauNode, WizardReputation};
use mp_reputation::ReputationEngine;
use uuid::Uuid;

fn print_reachable(graph: &KnowledgeGraph, wizard: &WizardReputation, caption: &str) {
    let reachable = graph.reachable_plateaus(wizard);
    println!("\n{caption}");
    println!(
        "  reachable: {} / {} plateaus",
        reachable.len(),
        graph.plateau_count()
    );
    for p in graph.plateaus() {
        let visible = reachable.contains(&p.id);
        let proj = wizard
            .domain_reps
            .values()
            .map(|rep| mp_graph::ga::project(rep, p.position()))
            .fold(f32::NEG_INFINITY, f32::max);
        let proj = if proj.is_finite() { proj } else { 0.0 };
        println!(
            "    {} {:<24} projection {:+.3}",
            if visible { "[ visible ]" } else { "[  fog   ]" },
            p.name,
            proj
        );
    }
}

fn main() {
    let domain = Uuid::new_v4();
    let author = Uuid::new_v4();

    // e1 = Formal/Mathematical, e2 = Physical/Empirical, e3 = Creative/Expressive.
    let linear_algebra = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
    let diff_geometry = PlateauNode::new("Differential Geometry", domain, 0.7, 0.5, 0.1);
    let classical_mechanics = PlateauNode::new("Classical Mechanics", domain, 0.5, 0.8, 0.0);
    let music_theory = PlateauNode::new("Music Theory", domain, 0.3, 0.4, 0.8);
    let symmetry = PlateauNode::new("Symmetry", domain, 0.5, 0.5, 0.5);

    // Capture what we'll traverse before the nodes move into the graph.
    let la_pos = *linear_algebra.position();
    let music_pos = *music_theory.position();

    let mut graph = KnowledgeGraph::new();
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

    let engine = ReputationEngine::default();
    let mut wizard = WizardReputation::new(Uuid::new_v4());

    print_reachable(&graph, &wizard, "A fresh wizard (empty reputation):");

    // Genuine math work: a modest-depth traversal of Linear Algebra. This lifts
    // the math-aligned cluster — but the creative Music Theory plateau, facing
    // away in the e3 direction, stays fogged.
    engine.record_traversal(&mut wizard, domain, &la_pos, 0.35);
    print_reachable(
        &graph,
        &wizard,
        "After traversing Linear Algebra (math reputation grows):",
    );

    // Now genuine creative work: traversing Music Theory lifts the fog on the
    // creative side too.
    engine.record_traversal(&mut wizard, domain, &music_pos, 0.6);
    print_reachable(
        &graph,
        &wizard,
        "After also traversing Music Theory (creative reputation grows):",
    );
}
