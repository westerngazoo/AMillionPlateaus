//! Two-peer sync + conflict-resolution integration tests (R-0004 AC4, AC5).
//!
//! Two replicas exchange only byte messages through their [`SyncSession`]s,
//! pumping until quiescence. These tests are the heart of the convergence
//! guarantee: after sync the replicas agree, whatever the order of edits or
//! message delivery.

use std::collections::HashSet;

use mp_crdt::{CrdtDoc, SyncSession};
use mp_graph::{Bridge, PlateauNode};
use uuid::Uuid;

/// Pump both peers to quiescence: each generates messages, the other applies
/// them, until neither has anything left to send.
fn sync_to_quiescence(
    a: &mut CrdtDoc,
    sa: &mut SyncSession,
    b: &mut CrdtDoc,
    sb: &mut SyncSession,
) {
    // Bounded loop guards against a protocol bug spinning forever.
    for _ in 0..1000 {
        let mut progressed = false;
        if let Some(msg) = sa.generate_message(a) {
            sb.receive_message(b, &msg).expect("a->b apply");
            progressed = true;
        }
        if let Some(msg) = sb.generate_message(b) {
            sa.receive_message(a, &msg).expect("b->a apply");
            progressed = true;
        }
        if !progressed {
            return;
        }
    }
    panic!("sync did not reach quiescence within bound");
}

fn plateau_ids(doc: &CrdtDoc) -> HashSet<Uuid> {
    doc.to_graph()
        .expect("project")
        .plateaus()
        .map(|p| p.id)
        .collect()
}

#[test]
fn peer_b_receives_peer_a_plateau() {
    // AC4: A adds a plateau, the two sync, B then has it.
    let mut a = CrdtDoc::new().expect("new a");
    let mut b = CrdtDoc::new().expect("new b");
    let mut sa = SyncSession::new();
    let mut sb = SyncSession::new();

    let domain = Uuid::new_v4();
    let p = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
    let p_id = p.id;
    a.add_plateau(&p).expect("add");

    sync_to_quiescence(&mut a, &mut sa, &mut b, &mut sb);

    let got = b.plateau(&p_id).expect("read").expect("present on B");
    assert_eq!(got.name, "Linear Algebra");
    assert_eq!(got.position().coeffs, p.position().coeffs);
    got.validate().expect("grade-1 survives the wire");
}

#[test]
fn concurrent_edits_and_votes_converge_to_the_union() {
    // AC5: starting from a shared base, A and B each make a different concurrent
    // edit (a new plateau + a vote on a shared resource by a different wizard),
    // then fully sync. Afterwards both replicas are equal and hold the union.
    let domain = Uuid::new_v4();

    // Shared base: one plateau + one resource id both peers vote on.
    let base_plateau = PlateauNode::new("Differential Geometry", domain, 0.7, 0.5, 0.1);
    let base_id = base_plateau.id;
    let resource = Uuid::new_v4();

    let mut a = CrdtDoc::new().expect("new a");
    a.add_plateau(&base_plateau).expect("add base");

    // Establish the shared base on B by syncing once.
    let mut b = CrdtDoc::new().expect("new b");
    {
        let mut sa = SyncSession::new();
        let mut sb = SyncSession::new();
        sync_to_quiescence(&mut a, &mut sa, &mut b, &mut sb);
    }
    assert!(b.plateau(&base_id).expect("read").is_some());

    // Concurrent, independent edits (no sync in between).
    let pa = PlateauNode::new("Symmetry", domain, 0.5, 0.4, 0.3);
    let pa_id = pa.id;
    let wizard_a = Uuid::new_v4();
    a.add_plateau(&pa).expect("A adds plateau");
    a.vote(resource, wizard_a, 4.0).expect("A votes");

    let pb = PlateauNode::new("Music Theory", domain, 0.2, 0.1, 0.9);
    let pb_id = pb.id;
    let wizard_b = Uuid::new_v4();
    b.add_plateau(&pb).expect("B adds plateau");
    b.vote(resource, wizard_b, 6.0).expect("B votes");

    // Fresh sessions for the post-divergence reconciliation.
    let mut sa = SyncSession::new();
    let mut sb = SyncSession::new();
    sync_to_quiescence(&mut a, &mut sa, &mut b, &mut sb);

    // Convergence by a stable predicate: equal heads (not raw save() bytes).
    assert_eq!(a.heads(), b.heads(), "replicas converged to the same heads");

    // Both replicas hold the union of plateaus.
    let expected: HashSet<Uuid> = [base_id, pa_id, pb_id].into_iter().collect();
    assert_eq!(plateau_ids(&a), expected);
    assert_eq!(plateau_ids(&b), expected);

    // Both wizards' votes survived on both replicas — the grow-only union.
    for doc in [&a, &b] {
        let tally = doc.resource_vote(&resource).expect("tally");
        assert_eq!(tally.voters(), 2);
        assert_eq!(tally.weight_of(&wizard_a), 4.0);
        assert_eq!(tally.weight_of(&wizard_b), 6.0);
        assert_eq!(tally.weighted_sum(), 10.0);
    }
}

#[test]
fn same_wizard_concurrent_votes_converge_to_the_max() {
    // AC3: the grow-only counter is correct under concurrency for the *same*
    // wizard. Two peers each record a vote by the same wizard on the same
    // resource at different weights, then sync. Both replicas must converge to
    // the larger weight (max), never lose the voter, and agree.
    let resource = Uuid::new_v4();
    let wizard = Uuid::new_v4();

    let mut a = CrdtDoc::new().expect("new a");
    let mut b = CrdtDoc::new().expect("new b");

    // Concurrent same-wizard writes at different weights (no sync between).
    a.vote(resource, wizard, 3.0).expect("A votes low");
    b.vote(resource, wizard, 7.0).expect("B votes high");

    let mut sa = SyncSession::new();
    let mut sb = SyncSession::new();
    sync_to_quiescence(&mut a, &mut sa, &mut b, &mut sb);

    assert_eq!(a.heads(), b.heads(), "same-wizard merge converged");
    for doc in [&a, &b] {
        let tally = doc.resource_vote(&resource).expect("tally");
        assert_eq!(tally.voters(), 1, "still exactly one voter, not duplicated");
        assert_eq!(
            tally.weight_of(&wizard),
            7.0,
            "converges to the max weight, never shrinks"
        );
        assert_eq!(tally.weighted_sum(), 7.0);
    }
}

#[test]
fn no_reputation_key_appears_after_edits() {
    // AC6 / CLAUDE.md §7: even after real edits and a merge, the document's
    // top-level keys are exactly the four data maps — no reputation/wizard key.
    let domain = Uuid::new_v4();
    let mut a = CrdtDoc::new().expect("a");
    a.add_plateau(&PlateauNode::new("Topology", domain, 0.6, 0.3, 0.2))
        .expect("add");
    a.vote(Uuid::new_v4(), Uuid::new_v4(), 1.0).expect("vote");

    let mut b = CrdtDoc::new().expect("b");
    b.add_plateau(&PlateauNode::new("Symmetry", domain, 0.5, 0.4, 0.3))
        .expect("add");
    a.merge(&mut b).expect("merge");

    assert_eq!(
        a.root_keys(),
        vec!["bridges", "plateaus", "resources", "votes"],
        "exactly the four data maps; no reputation/wizard key"
    );
}

#[test]
fn merge_order_does_not_change_the_result() {
    // AC5: convergence is order-independent. Build the same two concurrent edits
    // and reconcile them in both directions; the resulting graphs match.
    let domain = Uuid::new_v4();
    let pa = PlateauNode::new("Topology", domain, 0.6, 0.3, 0.2);
    let pb = PlateauNode::new("Category Theory", domain, 0.85, 0.15, 0.05);

    // Direction 1: merge B into A.
    let mut a1 = CrdtDoc::new().expect("a1");
    let mut b1 = CrdtDoc::new().expect("b1");
    a1.add_plateau(&pa).expect("a1 add");
    b1.add_plateau(&pb).expect("b1 add");
    a1.merge(&mut b1).expect("merge b1->a1");

    // Direction 2: merge A into B.
    let mut a2 = CrdtDoc::new().expect("a2");
    let mut b2 = CrdtDoc::new().expect("b2");
    a2.add_plateau(&pa).expect("a2 add");
    b2.add_plateau(&pb).expect("b2 add");
    b2.merge(&mut a2).expect("merge a2->b2");

    assert_eq!(plateau_ids(&a1), plateau_ids(&b2));
    assert_eq!(plateau_ids(&a1), [pa.id, pb.id].into_iter().collect());
}

#[test]
fn full_seed_graph_syncs_to_a_fresh_peer() {
    // A richer AC4/AC2 case: a 3-plateau + 2-bridge graph syncs intact, bridges
    // and all GA invariants included.
    let domain = Uuid::new_v4();
    let la = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
    let dg = PlateauNode::new("Differential Geometry", domain, 0.7, 0.5, 0.1);
    let gt = PlateauNode::new("Group Theory", domain, 0.8, 0.2, 0.1);
    let b1 = Bridge::between(&la, &dg, "tangent space", Uuid::nil());
    let b2 = Bridge::between(&la, &gt, "linear representation", Uuid::nil());

    let mut a = CrdtDoc::new().expect("a");
    for p in [&la, &dg, &gt] {
        a.add_plateau(p).expect("add plateau");
    }
    for br in [&b1, &b2] {
        a.add_bridge(br).expect("add bridge");
    }

    let mut b = CrdtDoc::new().expect("b");
    let mut sa = SyncSession::new();
    let mut sb = SyncSession::new();
    sync_to_quiescence(&mut a, &mut sa, &mut b, &mut sb);

    let g = b.to_graph().expect("project B");
    assert_eq!(g.plateau_count(), 3);
    assert_eq!(g.bridge_count(), 2);
    for br in g.bridges() {
        br.validate().expect("even-grade rotor survives");
    }
}
