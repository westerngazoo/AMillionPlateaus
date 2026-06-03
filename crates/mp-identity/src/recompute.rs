//! The pure, deterministic event-log → reputation mapping (R-0010 AC3/4/5/8).
//!
//! Verify every event, drop the invalid/malformed, then drive the **unchanged**
//! `mp-reputation` engine in a fixed two-phase order. No GA math lives here
//! (CLAUDE.md §1): we only marshal verified content and call the audited engine.

use std::collections::BTreeMap;

use mp_domain::ga;
use mp_domain::{Bridge, PlateauNode, WizardReputation};
use mp_reputation::ReputationEngine;
use uuid::Uuid;

use crate::event::{NostrEvent, Traversal, Vouch, KIND_TRAVERSAL, KIND_VOUCH};
use crate::verify::verify;

/// Project namespace for deriving a stable `WizardId` from a pubkey.
const MP_NAMESPACE: Uuid = Uuid::from_u128(0x1a2b_3c4d_5e6f_7a8b_9c0d_1e2f_3a4b_5c6d);

/// Derive the deterministic `WizardId` (UUIDv5 in [`MP_NAMESPACE`]) for a pubkey.
///
/// `WizardReputation` is keyed internally by `WizardId` (`Uuid`); the event
/// layer keys by the canonical lowercase x-only-hex pubkey. Deriving the id this
/// way keeps the existing `WizardReputation` type untouched while staying
/// bit-identical across peers (AC4).
pub fn wizard_id_of(pubkey: &str) -> Uuid {
    Uuid::new_v5(&MP_NAMESPACE, pubkey.as_bytes())
}

/// Recompute one `WizardReputation` per wizard from the verified event log.
///
/// Deterministic: the same set of verified events yields the same multivectors
/// on any peer, regardless of arrival order. An empty (or fully unverified) log
/// yields an empty map — **no free seed** (AC3).
pub fn recompute(events: &[NostrEvent]) -> BTreeMap<String, WizardReputation> {
    let engine = ReputationEngine::default();
    let mut reps: BTreeMap<String, WizardReputation> = BTreeMap::new();

    // The trust gate: only verified events may affect anything (AC2).
    let valid: Vec<&NostrEvent> = events.iter().filter(|e| verify(e)).collect();

    // ── Phase A — traversals. Each only *adds* a grade-1 term, so order is
    // irrelevant (vector addition commutes). Malformed content is skipped, never
    // raised as an error (this fn returns a map, not a Result — AC8 "malformed
    // event is inert").
    for e in valid.iter().copied().filter(|e| e.kind == KIND_TRAVERSAL) {
        let Ok(t) = serde_json::from_str::<Traversal>(&e.content) else {
            continue;
        };
        let rep = reps
            .entry(e.pubkey.clone())
            .or_insert_with(|| WizardReputation::new(wizard_id_of(&e.pubkey)));
        engine.record_traversal(rep, t.domain, &ga::vector(t.e1, t.e2, t.e3), t.depth);
    }

    // ── Phase B — vouches. `propagate` reads the voucher's *current* domain reps
    // (it is stateful/order-sensitive), so we pin a single pass in a global
    // stable sort by (created_at, id): the AC4 determinism contract. No
    // multi-round, no convergence loop.
    let mut vouches: Vec<&NostrEvent> = valid
        .iter()
        .copied()
        .filter(|e| e.kind == KIND_VOUCH)
        .collect();
    vouches.sort_by(|a, b| (a.created_at, a.id.as_str()).cmp(&(b.created_at, b.id.as_str())));
    for e in vouches {
        let Ok(v) = serde_json::from_str::<Vouch>(&e.content) else {
            continue;
        };
        // A voucher with no reputation has nothing to transfer — exactly the
        // mutual-vouch Sybil case: a vouch-only clique never leaves grade 0 (AC5).
        let Some(voucher_rep) = reps.get(&e.pubkey).cloned() else {
            continue;
        };
        // Rebuild the even-grade rotor the ONLY public way: `Bridge::between`
        // over two synthetic grade-1 endpoints. A raw rotor cannot be injected,
        // so the sandwiched rotor is always a valid normalized even versor.
        let from = PlateauNode::new("from", v.domain, v.from[0], v.from[1], v.from[2]);
        let to = PlateauNode::new("to", v.domain, v.to[0], v.to[1], v.to[2]);
        let bridge = Bridge::between(&from, &to, "vouch", wizard_id_of(&e.pubkey));
        let vouched = reps
            .entry(v.vouched.clone())
            .or_insert_with(|| WizardReputation::new(wizard_id_of(&v.vouched)));
        engine.propagate(&voucher_rep, &bridge, vouched, &v.domain);
    }

    // Synthesis derived once, at the end (cross-domain wedge).
    for rep in reps.values_mut() {
        engine.recompute_synthesis(rep);
    }
    reps
}

/// Discovery (R-0010 AC7): the top `k` traversers in `domain`, ranked by the
/// reach their **verified** traversal history earns, descending.
///
/// Reach = the grade-1 magnitude of the wizard's domain reputation (how far the
/// fog lights). Computed from verified events only — never from any
/// relay-supplied ordering — and deterministic (pubkey tie-break).
pub fn rank_by_domain(events: &[NostrEvent], domain: Uuid, k: usize) -> Vec<(String, f32)> {
    let reps = recompute(events);
    let mut ranked: Vec<(String, f32)> = reps
        .iter()
        .filter_map(|(pk, rep)| {
            rep.domain_reps
                .get(&domain)
                .map(|mv| (pk.clone(), ga::grade_magnitude(mv, 1)))
        })
        .filter(|(_, reach)| *reach > ga::EPSILON)
        .collect();
    ranked.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
    });
    ranked.truncate(k);
    ranked
}
