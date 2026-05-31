//! `ResourceVote` — a grow-only counter over one resource's votes.
//!
//! A vote is a `WizardId -> weight` cell. The only mutator, [`ResourceVote::cast`],
//! raises a wizard's weight monotonically (`max(existing, weight)`); it can never
//! remove a voter or lower a weight. This is what makes the CRDT `votes` sub-map
//! converge under merge: each wizard owns exactly one cell, concurrent votes by
//! *different* wizards merge to the union, and a same-wizard re-vote on two peers
//! converges to the larger weight (LWW on a monotonic sequence == max) without
//! losing any other voter (R-0004 AC3, SPEC-0004 §2.3).
//!
//! Monotonicity is a hard precondition: if a future phase ever lets a wizard's
//! weight legitimately *decrease*, this model must become a PN/G-counter
//! (SPEC-0004 decision log).

use std::collections::BTreeMap;

use mp_graph::WizardId;

/// The tally of votes on a single resource: each wizard's monotonic weight.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ResourceVote {
    weights: BTreeMap<WizardId, f32>,
}

impl ResourceVote {
    /// An empty tally.
    pub fn new() -> Self {
        Self::default()
    }

    /// Build a tally from raw cells (used by [`crate::CrdtDoc`] when reading the
    /// `votes` sub-map back out of Automerge).
    pub fn from_cells(weights: BTreeMap<WizardId, f32>) -> Self {
        Self { weights }
    }

    /// Record `wizard`'s vote at `weight`, monotonically: a wizard's weight only
    /// ever rises. Casting a lower weight than already recorded is a no-op.
    pub fn cast(&mut self, wizard: WizardId, weight: f32) {
        let cell = self.weights.entry(wizard).or_insert(weight);
        if weight > *cell {
            *cell = weight;
        }
    }

    /// `wizard`'s recorded weight, or `0.0` if they have not voted.
    pub fn weight_of(&self, wizard: &WizardId) -> f32 {
        self.weights.get(wizard).copied().unwrap_or(0.0)
    }

    /// The sum of every wizard's weight — the resource's weighted vote total.
    pub fn weighted_sum(&self) -> f32 {
        self.weights.values().sum()
    }

    /// How many distinct wizards have voted.
    pub fn voters(&self) -> usize {
        self.weights.len()
    }

    /// The cells, in stable `WizardId` order (for serialization / iteration).
    pub fn cells(&self) -> impl Iterator<Item = (&WizardId, &f32)> {
        self.weights.iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn cast_is_monotonic_and_never_removes() {
        let mut v = ResourceVote::new();
        let w = Uuid::new_v4();

        v.cast(w, 3.0);
        assert_eq!(v.weight_of(&w), 3.0);

        // A higher weight raises the cell.
        v.cast(w, 5.0);
        assert_eq!(v.weight_of(&w), 5.0);

        // A lower weight is a no-op — the counter only grows.
        v.cast(w, 1.0);
        assert_eq!(v.weight_of(&w), 5.0);

        // The voter is never removed; there is no API to do so.
        assert_eq!(v.voters(), 1);
    }

    #[test]
    fn weighted_sum_adds_distinct_voters() {
        let mut v = ResourceVote::new();
        let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        v.cast(a, 2.0);
        v.cast(b, 3.5);
        v.cast(c, 0.5);
        assert_eq!(v.voters(), 3);
        assert_eq!(v.weighted_sum(), 6.0);
    }

    #[test]
    fn unknown_wizard_weighs_zero() {
        let v = ResourceVote::new();
        assert_eq!(v.weight_of(&Uuid::new_v4()), 0.0);
        assert_eq!(v.weighted_sum(), 0.0);
    }
}
