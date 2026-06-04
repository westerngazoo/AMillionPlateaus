//! `KnowledgeGraph` — AMP's domain graph over the generic `mp_graph::GeoGraph`.
//!
//! The geometric machinery (petgraph + id index, the scorer, the queries) lives
//! in [`mp_graph::GeoGraph`]; this wrapper binds it to AMP's vocabulary and the
//! side-tables that are domain state (resources, wizards, reputation). Its
//! public surface — `add_plateau`, `add_bridge`, `plateau(s)`, `bridges`,
//! `is_reachable`, `reachable_plateaus`, `nearest_plateaus`, the counts — is
//! identical to the pre-SPEC-0008 `mp_graph::KnowledgeGraph`, so consumers only
//! change an import path (R-0008 AC4).

use std::collections::HashMap;

use petgraph::graph::{EdgeIndex, NodeIndex};

use mp_graph::ga::Mv;
use mp_graph::{GeoGraph, GraphError};

use crate::types::{
    Bridge, PlateauId, PlateauNode, Resource, ResourceId, WizardId, WizardProfile,
    WizardReputation, REACHABILITY_THRESHOLD,
};

pub struct KnowledgeGraph {
    geo: GeoGraph<PlateauNode, Bridge>,
    pub resources: HashMap<ResourceId, Resource>,
    pub wizards: HashMap<WizardId, WizardProfile>,
    pub reputation: HashMap<WizardId, WizardReputation>,
}

impl Default for KnowledgeGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl KnowledgeGraph {
    pub fn new() -> Self {
        Self {
            geo: GeoGraph::new(),
            resources: HashMap::new(),
            wizards: HashMap::new(),
            reputation: HashMap::new(),
        }
    }

    /// Insert a plateau and make it retrievable by id.
    pub fn add_plateau(&mut self, plateau: PlateauNode) -> NodeIndex {
        self.geo.add_node(plateau)
    }

    /// Add a bridge. Both endpoints must already exist in the graph.
    pub fn add_bridge(&mut self, bridge: Bridge) -> Result<EdgeIndex, GraphError> {
        self.geo.add_edge(bridge)
    }

    pub fn plateau(&self, id: &PlateauId) -> Option<&PlateauNode> {
        self.geo.node(id)
    }

    pub fn plateaus(&self) -> impl Iterator<Item = &PlateauNode> {
        self.geo.nodes()
    }

    pub fn bridges(&self) -> impl Iterator<Item = &Bridge> {
        self.geo.edges()
    }

    /// AMP's reputation → query-directions mapping: a wizard's orientation is
    /// the set of its per-domain reputation multivectors. The store stays
    /// agnostic — it scores against `&[Mv]`, not a `WizardReputation`.
    fn directions(wizard: &WizardReputation) -> Vec<Mv> {
        wizard.domain_reps.values().copied().collect()
    }

    /// Fog query (R-0002 AC6): a plateau is reachable iff its projection score
    /// exceeds `REACHABILITY_THRESHOLD`. Uses the same scorer as
    /// [`Self::reachable_plateaus`]/[`Self::nearest_plateaus`], so fog and
    /// retrieval cannot drift.
    pub fn is_reachable(&self, plateau: &PlateauNode, wizard: &WizardReputation) -> bool {
        self.geo.score(plateau, &Self::directions(wizard)) > REACHABILITY_THRESHOLD
    }

    /// The set of plateaus reachable for `wizard` (the complement of the fog).
    pub fn reachable_plateaus(&self, wizard: &WizardReputation) -> Vec<PlateauId> {
        self.geo
            .project_above(&Self::directions(wizard), REACHABILITY_THRESHOLD)
    }

    /// Plateaus ranked by projection score (descending), truncated to `k` — the
    /// graph-grounded *retrieval* query for the companion (R-0007). Ties break
    /// deterministically by `PlateauId`. Read-only.
    pub fn nearest_plateaus(&self, wizard: &WizardReputation, k: usize) -> Vec<(PlateauId, f32)> {
        self.geo.nearest(&Self::directions(wizard), k)
    }

    pub fn plateau_count(&self) -> usize {
        self.geo.node_count()
    }

    pub fn bridge_count(&self) -> usize {
        self.geo.edge_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{DomainId, WizardReputation};
    use mp_graph::ga::{self, Mv};
    use uuid::Uuid;

    fn plateau(name: &str, e1: f32, e2: f32, e3: f32) -> PlateauNode {
        PlateauNode::new(name, Uuid::new_v4(), e1, e2, e3)
    }

    #[test]
    fn add_and_lookup_plateau() {
        let mut g = KnowledgeGraph::new();
        let p = plateau("Linear Algebra", 0.9, 0.1, 0.0);
        let id = p.id;
        g.add_plateau(p);
        assert_eq!(
            g.plateau(&id).map(|p| p.name.as_str()),
            Some("Linear Algebra")
        );
    }

    #[test]
    fn unknown_plateau_is_none() {
        let g = KnowledgeGraph::new();
        assert!(g.plateau(&Uuid::new_v4()).is_none());
    }

    #[test]
    fn add_bridge_between_existing_plateaus() {
        let mut g = KnowledgeGraph::new();
        let a = plateau("Calculus", 0.7, 0.5, 0.0);
        let b = plateau("Differential Equations", 0.6, 0.6, 0.0);
        let bridge = Bridge::between(&a, &b, "derivative", Uuid::new_v4());
        g.add_plateau(a);
        g.add_plateau(b);
        assert!(g.add_bridge(bridge).is_ok());
        assert_eq!(g.bridge_count(), 1);
    }

    #[test]
    fn bridge_to_unknown_endpoint_rejected() {
        let mut g = KnowledgeGraph::new();
        let a = plateau("Calculus", 0.7, 0.5, 0.0);
        let orphan = plateau("Nowhere", 0.1, 0.1, 0.9);
        let bridge = Bridge::between(&a, &orphan, "void", Uuid::new_v4());
        g.add_plateau(a);
        // `orphan` was never added.
        match g.add_bridge(bridge) {
            Err(GraphError::UnknownEndpoint(_)) => {}
            other => panic!("expected UnknownEndpoint, got {other:?}"),
        }
        assert_eq!(g.bridge_count(), 0);
    }

    // ─── AC6 — fog reachability ──────────────────────────────

    /// A wizard whose single domain rep is `rep` in `domain`.
    fn wizard_with(domain: DomainId, rep: Mv) -> WizardReputation {
        let mut w = WizardReputation::new(Uuid::new_v4());
        w.domain_reps.insert(domain, rep);
        w
    }

    #[test]
    fn is_reachable_threshold() {
        let domain = Uuid::new_v4();
        let p = PlateauNode::new("Linear Algebra", domain, 1.0, 0.0, 0.0);

        // Aligned reputation: projection 0.82 > 0.15 → reachable.
        let strong = wizard_with(domain, ga::vector(0.82, 0.0, 0.0));
        assert!(KnowledgeGraph::new().is_reachable(&p, &strong));

        // Faint reputation: projection 0.1 < 0.15 → fogged.
        let faint = wizard_with(domain, ga::vector(0.1, 0.0, 0.0));
        assert!(!KnowledgeGraph::new().is_reachable(&p, &faint));

        // Empty reputation → always fogged.
        let empty = WizardReputation::new(Uuid::new_v4());
        assert!(!KnowledgeGraph::new().is_reachable(&p, &empty));

        // Scalar-only (Sybil) reputation projects to 0 under the Hestenes inner
        // product — sees only fog regardless of magnitude.
        let sybil = wizard_with(domain, Mv::scalar(1_000.0));
        assert!(
            !KnowledgeGraph::new().is_reachable(&p, &sybil),
            "scalar-only reputation must project to 0 and stay fogged"
        );
    }

    #[test]
    fn reachable_plateaus_matches() {
        let domain = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        let math = PlateauNode::new("Math", domain, 1.0, 0.0, 0.0);
        let creative = PlateauNode::new("Creative", domain, 0.0, 0.0, 1.0);
        let math_id = math.id;
        let creative_id = creative.id;
        g.add_plateau(math);
        g.add_plateau(creative);

        // Reputation facing e1 only: Math reachable, Creative fogged.
        let w = wizard_with(domain, ga::vector(0.5, 0.0, 0.0));
        let reachable = g.reachable_plateaus(&w);

        assert!(reachable.contains(&math_id));
        assert!(!reachable.contains(&creative_id));
        assert_eq!(reachable.len(), 1);
    }

    // ─── R-0007 — nearest_plateaus retrieval ranking ─────────

    #[test]
    fn nearest_plateaus_ranks_by_projection_desc() {
        let domain = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        let math = PlateauNode::new("Math", domain, 1.0, 0.0, 0.0);
        let creative = PlateauNode::new("Creative", domain, 0.0, 0.0, 1.0);
        let math_id = math.id;
        let creative_id = creative.id;
        g.add_plateau(math);
        g.add_plateau(creative);

        // A rep facing e1 ranks Math above Creative; both are returned (no
        // threshold — this is ranking, not the fog filter).
        let w = wizard_with(domain, ga::vector(0.5, 0.0, 0.0));
        let ranked = g.nearest_plateaus(&w, 10);
        assert_eq!(ranked.len(), 2);
        assert_eq!(
            ranked[0].0, math_id,
            "Math (e1) is nearest the e1 orientation"
        );
        assert_eq!(ranked[1].0, creative_id);
        assert!(ranked[0].1 > ranked[1].1, "scores are descending");

        // k truncates to the top of the ranking.
        let top1 = g.nearest_plateaus(&w, 1);
        assert_eq!(top1.len(), 1);
        assert_eq!(top1[0].0, math_id);

        // k == 0 yields nothing; k > count is capped at count.
        assert!(g.nearest_plateaus(&w, 0).is_empty());
        assert_eq!(g.nearest_plateaus(&w, 999).len(), 2);
    }

    #[test]
    fn nearest_plateaus_tie_breaks_by_id() {
        let domain = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        // Two plateaus at the same position → identical projection score, so the
        // order must come from the PlateauId tie-break (stable across runs).
        let a = PlateauNode::new("A", domain, 1.0, 0.0, 0.0);
        let b = PlateauNode::new("B", domain, 1.0, 0.0, 0.0);
        let (a_id, b_id) = (a.id, b.id);
        g.add_plateau(a);
        g.add_plateau(b);

        let w = wizard_with(domain, ga::vector(0.5, 0.0, 0.0));
        let ranked = g.nearest_plateaus(&w, 2);
        assert_eq!(ranked.len(), 2);
        assert!(
            (ranked[0].1 - ranked[1].1).abs() < ga::EPSILON,
            "scores tie"
        );
        let mut expected = [a_id, b_id];
        expected.sort();
        assert_eq!(
            [ranked[0].0, ranked[1].0],
            expected,
            "ties order ascending by id"
        );
    }

    #[test]
    fn is_reachable_equals_threshold_gate() {
        let domain = Uuid::new_v4();
        let p = PlateauNode::new("Linear Algebra", domain, 1.0, 0.0, 0.0);
        let g = KnowledgeGraph::new();

        let strong = wizard_with(domain, ga::vector(0.82, 0.0, 0.0));
        assert!(g.is_reachable(&p, &strong));
        let faint = wizard_with(domain, ga::vector(0.1, 0.0, 0.0));
        assert!(!g.is_reachable(&p, &faint));
    }
}
