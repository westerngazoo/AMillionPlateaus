//! Sybil grade-collapse detection.
//!
//! The Sybil-resistance property (R-0002 AC4): a cluster of wizards holding only
//! raw-activity (Grade-0 / scalar) reputation that vouch for one another can
//! never promote themselves above Grade-0. Trust propagates via the rotor
//! sandwich `R·rep·R̃`, and for a unit rotor a scalar maps to itself — Grade-0
//! in, Grade-0 out. Accumulation (`+`) of Grade-0 terms stays Grade-0, so the
//! collapse holds under arbitrarily many propagation rounds. Only genuine
//! traversal (`record_traversal`) introduces a Grade-1 part.

use mp_graph::ga::{self, EPSILON};
use mp_graph::WizardReputation;

/// The wizard's maximum grade across all domain reputations and synthesis.
/// Convenience alias for [`WizardReputation::dominant_grade`].
pub fn max_grade(rep: &WizardReputation) -> u8 {
    rep.dominant_grade()
}

/// True iff every domain reputation and the synthesis are Grade-0 only — i.e.
/// the wizard has no genuine geometric diversity of work (a Sybil signature).
///
/// Higher-grade parts are tested against [`EPSILON`] rather than exact zero,
/// because rotor normalization is approximate (`R·R̃ ≈ 1`) and leaves
/// floating-point dust far below tolerance.
pub fn is_grade_collapsed(rep: &WizardReputation) -> bool {
    rep.domain_reps
        .values()
        .chain(std::iter::once(&rep.synthesis))
        .all(|mv| {
            ga::grade_magnitude(mv, 1) < EPSILON
                && ga::grade_magnitude(mv, 2) < EPSILON
                && ga::grade_magnitude(mv, 3) < EPSILON
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ReputationEngine;
    use mp_graph::ga::Mv;
    use mp_graph::{Bridge, DomainId, PlateauNode, WizardReputation};
    use uuid::Uuid;

    #[test]
    fn fresh_wizard_is_collapsed() {
        let w = WizardReputation::new(Uuid::new_v4());
        assert!(is_grade_collapsed(&w));
        assert_eq!(max_grade(&w), 0);
    }

    #[test]
    fn traversed_wizard_is_not_collapsed() {
        let e = ReputationEngine::default();
        let mut w = WizardReputation::new(Uuid::new_v4());
        e.record_traversal(&mut w, Uuid::new_v4(), &ga::vector(0.9, 0.1, 0.0), 1.0);
        assert!(!is_grade_collapsed(&w));
        assert_eq!(max_grade(&w), 1);
    }

    /// AC4 — a ring of ≥3 scalar-only wizards vouching for one another never
    /// exceeds Grade-0, even after repeated propagation rounds.
    #[test]
    fn sybil_ring_stays_grade_zero() {
        let e = ReputationEngine::default();
        let domain: DomainId = Uuid::new_v4();

        // A bridge to sandwich through (any even rotor; unit-normalized).
        let a = PlateauNode::new("A", domain, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("B", domain, 0.3, 0.4, 0.8);
        let bridge = Bridge::between(&a, &b, "vouch", Uuid::new_v4());

        // Three fake wizards, each seeded with scalar-only (raw) reputation.
        let mut ring: Vec<WizardReputation> = (0..3)
            .map(|i| {
                let mut w = WizardReputation::new(Uuid::new_v4());
                w.domain_reps.insert(domain, Mv::scalar(1.0 + i as f32));
                w
            })
            .collect();

        // Record the starting scalar mass so we can prove propagation is not a
        // silent no-op (a no-op would pass the collapse assertion vacuously).
        let scalar_mass = |w: &WizardReputation| -> f32 {
            w.domain_reps
                .values()
                .map(|mv| ga::grade_magnitude(mv, 0))
                .sum()
        };
        let mass_before: f32 = ring.iter().map(scalar_mass).sum();

        // Propagate around the ring for several full rounds.
        for _ in 0..3 {
            for i in 0..ring.len() {
                let voucher = ring[i].clone();
                let next = (i + 1) % ring.len();
                e.propagate(&voucher, &bridge, &mut ring[next], &domain);
                e.recompute_synthesis(&mut ring[next]);
            }
        }

        // Propagation genuinely moved scalar reputation around the ring — the
        // test exercises real transfers, not a vacuous no-op path.
        let mass_after: f32 = ring.iter().map(scalar_mass).sum();
        assert!(
            mass_after > mass_before + EPSILON,
            "ring propagation must actually transfer scalar mass \
             (before {mass_before}, after {mass_after})"
        );

        // ...and despite all that vouching, no member ever escapes Grade-0.
        for w in &ring {
            assert!(
                is_grade_collapsed(w),
                "Sybil ring member promoted above Grade-0: {:?}",
                w
            );
            assert_eq!(max_grade(w), 0);
        }
    }
}
