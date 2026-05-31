//! `ReputationEngine` — GA Eigentrust algorithms over `WizardReputation`.
//!
//! Realizes SPEC-0002 (R-0002). The reputation *type* lives in mp-graph (it is
//! needed there for fog reachability); the *algorithms* live here, as methods on
//! `ReputationEngine`, not as impls on the foreign `WizardReputation` (orphan
//! rule). All math flows through garust (CLAUDE.md §1); reputation is always a
//! multivector, never a scalar (CLAUDE.md §4).

use mp_graph::ga::Mv;
use mp_graph::{Bridge, DomainId, WizardReputation};

/// Tunable parameters for trust propagation.
pub struct ReputationEngine {
    /// Fraction of a voucher's reputation that survives one bridge hop.
    pub trust_decay: f32,
}

impl Default for ReputationEngine {
    fn default() -> Self {
        Self { trust_decay: 0.5 }
    }
}

impl ReputationEngine {
    /// AC2 — genuine domain depth. Records a traversal by adding a Grade-1
    /// component `depth · position` into the wizard's reputation for `domain`.
    ///
    /// `position` is the visited plateau's (Grade-1) position; scaling by
    /// `depth` carries "how much" without normalizing (SPEC-0002 open Q5).
    pub fn record_traversal(
        &self,
        w: &mut WizardReputation,
        domain: DomainId,
        position: &Mv,
        depth: f32,
    ) {
        let contribution = *position * depth;
        w.domain_reps
            .entry(domain)
            .and_modify(|r| *r += contribution)
            .or_insert(contribution);
    }

    /// AC3/AC4 — GA Eigentrust. Transfers the voucher's reputation in `domain`
    /// to the vouched wizard as `bridge.rotor · rep · bridge.rotor̃ · trust_decay`
    /// (the rotor sandwich `R·rep·R̃`), accumulated into the vouched wizard's
    /// reputation for `domain`.
    ///
    /// No-op when the voucher holds no reputation in `domain` (nothing to
    /// vouch). For a purely scalar (Grade-0) `rep`, the sandwich through a unit
    /// rotor returns Grade-0 (grade collapse): Sybil clusters cannot promote
    /// themselves above Grade-0 no matter how many times they propagate.
    pub fn propagate(
        &self,
        voucher: &WizardReputation,
        bridge: &Bridge,
        vouched: &mut WizardReputation,
        domain: &DomainId,
    ) {
        if let Some(rep) = voucher.domain_reps.get(domain) {
            let transferred = bridge.rotor().sandwich(rep) * self.trust_decay;
            vouched
                .domain_reps
                .entry(*domain)
                .and_modify(|r| *r += transferred)
                .or_insert(transferred);
        }
    }

    /// AC5 — cross-domain synthesis. Recomputes the synthesis from the current
    /// domain reputations as the sum of pairwise wedges plus triple wedges:
    ///   `Σ_{i<j} rep_i ∧ rep_j  +  Σ_{i<j<k} rep_i ∧ rep_j ∧ rep_k`.
    ///
    /// The wedge of two non-parallel Grade-1 reputations is a non-zero Grade-2
    /// (bivector); three independent domains yield a Grade-3 (trivector). A
    /// single domain has no pair, so its synthesis is zero — and parallel or
    /// scalar inputs wedge to ~0, so only genuine geometric diversity registers.
    pub fn recompute_synthesis(&self, w: &mut WizardReputation) {
        let reps: Vec<&Mv> = w.domain_reps.values().collect();
        let mut synthesis = Mv::zero();
        for i in 0..reps.len() {
            for j in (i + 1)..reps.len() {
                synthesis += reps[i].wedge(reps[j]);
                for k in (j + 1)..reps.len() {
                    synthesis += reps[i].wedge(reps[j]).wedge(reps[k]);
                }
            }
        }
        w.synthesis = synthesis;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mp_graph::ga::{self, EPSILON};
    use mp_graph::PlateauNode;
    use uuid::Uuid;

    fn engine() -> ReputationEngine {
        ReputationEngine::default()
    }

    // ─── AC2 ─────────────────────────────────────────────────

    #[test]
    fn record_traversal_adds_grade_one() {
        let e = engine();
        let domain = Uuid::new_v4();
        let mut w = WizardReputation::new(Uuid::new_v4());
        let position = ga::vector(0.9, 0.1, 0.0);

        e.record_traversal(&mut w, domain, &position, 1.0);

        let rep = w.domain_reps.get(&domain).expect("domain rep recorded");
        assert!(
            ga::grade_magnitude(rep, 1) > EPSILON,
            "traversal must add a non-zero Grade-1 part"
        );
        assert_eq!(ga::dominant_grade(rep), 1);
    }

    // ─── AC3 ─────────────────────────────────────────────────

    #[test]
    fn propagate_uses_rotor_sandwich() {
        let e = engine();
        let domain = Uuid::new_v4();
        let a = PlateauNode::new("A", domain, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("B", domain, 0.3, 0.4, 0.8);
        let bridge = Bridge::between(&a, &b, "link", Uuid::new_v4());

        let mut voucher = WizardReputation::new(Uuid::new_v4());
        e.record_traversal(&mut voucher, domain, a.position(), 1.0);
        let rep = *voucher.domain_reps.get(&domain).expect("voucher rep");

        let mut vouched = WizardReputation::new(Uuid::new_v4());
        e.propagate(&voucher, &bridge, &mut vouched, &domain);

        let expected = bridge.rotor().sandwich(&rep) * e.trust_decay;
        let got = vouched.domain_reps.get(&domain).expect("transferred rep");
        for (g, x) in got.coeffs.iter().zip(expected.coeffs.iter()) {
            assert!(
                (g - x).abs() < EPSILON,
                "transferred must equal R·rep·R̃·decay"
            );
        }
    }

    #[test]
    fn propagate_without_voucher_domain_is_noop() {
        let e = engine();
        let domain = Uuid::new_v4();
        let a = PlateauNode::new("A", domain, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("B", domain, 0.3, 0.4, 0.8);
        let bridge = Bridge::between(&a, &b, "link", Uuid::new_v4());

        let voucher = WizardReputation::new(Uuid::new_v4()); // empty
        let mut vouched = WizardReputation::new(Uuid::new_v4());
        e.propagate(&voucher, &bridge, &mut vouched, &domain);

        assert!(vouched.domain_reps.is_empty());
    }

    // ─── AC4 ─────────────────────────────────────────────────

    #[test]
    fn scalar_propagation_stays_scalar() {
        let e = engine();
        let domain = Uuid::new_v4();
        let a = PlateauNode::new("A", domain, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("B", domain, 0.3, 0.4, 0.8);
        let bridge = Bridge::between(&a, &b, "link", Uuid::new_v4());

        let mut voucher = WizardReputation::new(Uuid::new_v4());
        // Seed a purely Grade-0 (scalar) reputation: raw activity only.
        voucher.domain_reps.insert(domain, Mv::scalar(2.5));

        let mut vouched = WizardReputation::new(Uuid::new_v4());
        e.propagate(&voucher, &bridge, &mut vouched, &domain);

        let rep = vouched.domain_reps.get(&domain).expect("transferred");
        // The transfer must actually have happened (guard against a silent
        // no-op passing this test vacuously): a non-trivial scalar arrives.
        assert!(
            ga::grade_magnitude(rep, 0) > EPSILON,
            "propagation must transfer the scalar part, not no-op"
        );
        assert_eq!(
            ga::dominant_grade(rep),
            0,
            "scalar in, scalar out — no grade promotion"
        );
        assert!(ga::grade_magnitude(rep, 1) < EPSILON);
        assert!(ga::grade_magnitude(rep, 2) < EPSILON);
        assert!(ga::grade_magnitude(rep, 3) < EPSILON);
    }

    // ─── AC5 — parallel (collinear) domains must NOT fake synthesis ──

    /// Two domain reps along the *same* direction wedge to ~0: collinear work
    /// is not cross-domain synthesis. This guards the Sybil-adjacent claim that
    /// only genuine geometric diversity promotes grade.
    #[test]
    fn parallel_domains_have_no_bivector() {
        let e = engine();
        let mut w = WizardReputation::new(Uuid::new_v4());
        let d1 = Uuid::new_v4();
        let d2 = Uuid::new_v4();
        // Same direction, different magnitudes — parallel Grade-1 reps.
        e.record_traversal(&mut w, d1, &ga::vector(1.0, 0.0, 0.0), 1.0);
        e.record_traversal(&mut w, d2, &ga::vector(1.0, 0.0, 0.0), 0.5);

        e.recompute_synthesis(&mut w);

        assert!(
            ga::grade_magnitude(&w.synthesis, 2) < EPSILON,
            "parallel domain reps must not produce a Grade-2 synthesis"
        );
    }

    // ─── AC5 ─────────────────────────────────────────────────

    #[test]
    fn cross_domain_accumulates_bivector() {
        let e = engine();
        let mut w = WizardReputation::new(Uuid::new_v4());
        let d1 = Uuid::new_v4();
        let d2 = Uuid::new_v4();
        // Non-collinear Grade-1 reps in two domains.
        e.record_traversal(&mut w, d1, &ga::vector(1.0, 0.0, 0.0), 1.0);
        e.record_traversal(&mut w, d2, &ga::vector(0.0, 1.0, 0.0), 1.0);

        e.recompute_synthesis(&mut w);

        assert!(
            ga::grade_magnitude(&w.synthesis, 2) > EPSILON,
            "two non-parallel domains must yield a Grade-2 synthesis"
        );
    }

    #[test]
    fn single_domain_has_no_bivector() {
        let e = engine();
        let mut w = WizardReputation::new(Uuid::new_v4());
        let d1 = Uuid::new_v4();
        e.record_traversal(&mut w, d1, &ga::vector(1.0, 0.0, 0.0), 1.0);

        e.recompute_synthesis(&mut w);

        assert!(
            ga::grade_magnitude(&w.synthesis, 2) < EPSILON,
            "a single domain has no pair to wedge — no Grade-2 synthesis"
        );
    }

    #[test]
    fn three_domains_yield_trivector() {
        let e = engine();
        let mut w = WizardReputation::new(Uuid::new_v4());
        e.record_traversal(&mut w, Uuid::new_v4(), &ga::vector(1.0, 0.0, 0.0), 1.0);
        e.record_traversal(&mut w, Uuid::new_v4(), &ga::vector(0.0, 1.0, 0.0), 1.0);
        e.record_traversal(&mut w, Uuid::new_v4(), &ga::vector(0.0, 0.0, 1.0), 1.0);

        e.recompute_synthesis(&mut w);

        assert!(
            ga::grade_magnitude(&w.synthesis, 3) > EPSILON,
            "three independent domains must yield a Grade-3 synthesis"
        );
    }
}
