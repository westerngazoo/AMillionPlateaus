//! AC7 integration test: fog lifts after genuine traversal.
//!
//! A fresh wizard finds every seed plateau fogged. After a modest-depth
//! traversal of a math plateau, geometrically-aligned plateaus become
//! reachable, while a creative (e3-dominant) plateau the reputation does not
//! "face" stays in the fog.

use mp_domain::{KnowledgeGraph, PlateauNode, WizardReputation};
use mp_reputation::ReputationEngine;
use uuid::Uuid;

#[test]
fn fog_lifts_after_traversal() {
    let domain = Uuid::new_v4();

    let linear_algebra = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
    let symmetry = PlateauNode::new("Symmetry", domain, 0.5, 0.5, 0.5);
    let music_theory = PlateauNode::new("Music Theory", domain, 0.3, 0.4, 0.8);

    let la_pos = *linear_algebra.position();
    let symmetry_id = symmetry.id;
    let music_id = music_theory.id;

    let mut graph = KnowledgeGraph::new();
    graph.add_plateau(linear_algebra);
    graph.add_plateau(symmetry);
    graph.add_plateau(music_theory);

    let engine = ReputationEngine::default();
    let mut wizard = WizardReputation::new(Uuid::new_v4());

    // Fresh wizard: total fog.
    assert!(
        graph.reachable_plateaus(&wizard).is_empty(),
        "a fresh wizard must find every plateau fogged"
    );

    // Genuine math work, modest depth.
    engine.record_traversal(&mut wizard, domain, &la_pos, 0.35);

    let reachable = graph.reachable_plateaus(&wizard);
    assert!(
        !reachable.is_empty(),
        "traversal must lift the fog on at least one plateau"
    );
    // A previously-fogged, geometrically-aligned plateau is now reachable.
    assert!(
        reachable.contains(&symmetry_id),
        "Symmetry (aligned with Linear Algebra) should emerge from the fog"
    );
    // The creative plateau the reputation does not face stays fogged.
    assert!(
        !reachable.contains(&music_id),
        "Music Theory (e3-dominant) should remain fogged after only math work"
    );
}
