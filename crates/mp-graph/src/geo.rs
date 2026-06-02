//! The domain-agnostic geometric graph store (RFC-0001 Scope A, SPEC-0008).
//!
//! [`GeoGraph<N, E>`] is a petgraph graph whose nodes carry a Grade-1 *position*
//! and whose edges carry an even-grade *rotor*, read through the [`Positioned`]
//! and [`Rotored`] traits. The store knows nothing about plateaus, wizards, or
//! reputation — AMP's vocabulary lives in `mp-domain`. The query surface
//! ([`GeoGraph::score`]/[`GeoGraph::project_above`]/[`GeoGraph::nearest`]/
//! [`GeoGraph::by_grade`]/[`GeoGraph::transport`]) is exactly the geometry
//! today's `KnowledgeGraph` exposed, with the wizard framing removed — so
//! behaviour is preserved bit-for-bit (R-0008 AC4).

use std::collections::HashMap;

use petgraph::graph::{EdgeIndex, NodeIndex};
use petgraph::Graph;

use crate::error::GraphError;
use crate::ga::{self, Mv};

/// Stable identity of a node, independent of petgraph's internal index.
pub type NodeId = uuid::Uuid;
/// Stable identity of an edge.
pub type EdgeId = uuid::Uuid;

/// A node the store can position in the algebra. Implementors hold the Grade-1
/// position privately and validate it at their own construction; the store
/// re-validates data not built in-process via [`Positioned::validate_position`]
/// (e.g. on load from disk/network).
pub trait Positioned {
    fn node_id(&self) -> NodeId;
    fn position(&self) -> &Mv;
    /// Re-validate the position invariant for deserialized data. Called by the
    /// store on [`GraphDb::load`](crate::GraphDb::load).
    fn validate_position(&self) -> Result<(), GraphError>;
}

/// An edge whose geometry is an even-grade rotor between two node positions.
pub trait Rotored {
    fn edge_id(&self) -> EdgeId;
    fn endpoints(&self) -> (NodeId, NodeId);
    fn rotor(&self) -> &Mv;
    /// Re-validate the rotor invariant for deserialized data.
    fn validate_rotor(&self) -> Result<(), GraphError>;
}

/// Generic geometric graph: petgraph + an id→index map, plus the typed query
/// surface. Generic over the caller's own node/edge types, so the caller owns
/// its serde representation (SPEC-0008 §1.1 — the wire/disk format is preserved
/// because the store never wraps the caller's type).
pub struct GeoGraph<N: Positioned, E: Rotored> {
    graph: Graph<N, E>,
    index: HashMap<NodeId, NodeIndex>,
}

impl<N: Positioned, E: Rotored> Default for GeoGraph<N, E> {
    fn default() -> Self {
        Self::new()
    }
}

impl<N: Positioned, E: Rotored> GeoGraph<N, E> {
    pub fn new() -> Self {
        Self {
            graph: Graph::new(),
            index: HashMap::new(),
        }
    }

    /// Insert a node and make it retrievable by id.
    pub fn add_node(&mut self, node: N) -> NodeIndex {
        let id = node.node_id();
        let idx = self.graph.add_node(node);
        self.index.insert(id, idx);
        idx
    }

    /// Add an edge. Both endpoints must already exist in the graph.
    pub fn add_edge(&mut self, edge: E) -> Result<EdgeIndex, GraphError> {
        let (from, to) = edge.endpoints();
        let f = *self
            .index
            .get(&from)
            .ok_or(GraphError::UnknownEndpoint(from))?;
        let t = *self.index.get(&to).ok_or(GraphError::UnknownEndpoint(to))?;
        Ok(self.graph.add_edge(f, t, edge))
    }

    pub fn node(&self, id: &NodeId) -> Option<&N> {
        let idx = self.index.get(id)?;
        self.graph.node_weight(*idx)
    }

    pub fn nodes(&self) -> impl Iterator<Item = &N> {
        self.graph.node_weights()
    }

    pub fn edges(&self) -> impl Iterator<Item = &E> {
        self.graph.edge_weights()
    }

    /// The orientation score for a node: the maximum projection
    /// `⟨dir · node.position⟩₀` over the query `directions`. This is the single
    /// scorer shared by [`Self::project_above`], [`Self::nearest`], and the
    /// domain's reachability test, so fog and retrieval cannot drift. An empty
    /// `directions` slice (or scalar-only directions) yields `NEG_INFINITY`/0 —
    /// nothing is reachable (the Sybil/fog property). See [`crate::ga::project`].
    pub fn score(&self, node: &N, directions: &[Mv]) -> f32 {
        directions
            .iter()
            .map(|dir| ga::project(dir, node.position()))
            .fold(f32::NEG_INFINITY, f32::max)
    }

    /// Nodes whose [`Self::score`] exceeds `threshold` (the generalized fog query).
    pub fn project_above(&self, directions: &[Mv], threshold: f32) -> Vec<NodeId> {
        self.nodes()
            .filter(|n| self.score(n, directions) > threshold)
            .map(|n| n.node_id())
            .collect()
    }

    /// Top-`k` nodes by descending [`Self::score`], with a deterministic id
    /// tie-break so the ranking is stable across runs. Read-only. The full
    /// ranking includes nodes below any threshold (this is ranking, not the fog
    /// filter). O(n) scan — the geometric index is RFC-0001 Scope B.
    pub fn nearest(&self, directions: &[Mv], k: usize) -> Vec<(NodeId, f32)> {
        let mut scored: Vec<(NodeId, f32)> = self
            .nodes()
            .map(|n| (n.node_id(), self.score(n, directions)))
            .collect();
        // Total order on f32 via total_cmp (handles NaN/±inf), descending, with a
        // deterministic id tie-break.
        scored.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
        scored.truncate(k);
        scored
    }

    /// Nodes whose position has the given dominant grade (grade-filtered scan).
    pub fn by_grade(&self, grade: u8) -> Vec<NodeId> {
        self.nodes()
            .filter(|n| ga::dominant_grade(n.position()) == grade)
            .map(|n| n.node_id())
            .collect()
    }

    /// Transport a multivector along an edge's rotor by the sandwich product
    /// `R · v · ~R` (see [`crate::ga::sandwich`]). Returns `None` when no edge
    /// has the given id — no panic crosses the API (CLAUDE.md §5).
    pub fn transport(&self, edge: EdgeId, v: &Mv) -> Option<Mv> {
        let e = self.edges().find(|e| e.edge_id() == edge)?;
        Some(ga::sandwich(e.rotor(), v))
    }

    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ga;
    use serde::{Deserialize, Serialize};
    use uuid::Uuid;

    // A minimal node/edge pair proving the core compiles and is tested WITHOUT
    // any AMP domain type (R-0008 AC1/AC2/AC6).

    #[derive(Serialize, Deserialize)]
    struct TestNode {
        id: NodeId,
        #[serde(with = "crate::ga::serde_mv")]
        pos: Mv,
    }

    impl TestNode {
        fn new(e1: f32, e2: f32, e3: f32) -> Self {
            Self {
                id: Uuid::new_v4(),
                pos: ga::vector(e1, e2, e3),
            }
        }
    }

    impl Positioned for TestNode {
        fn node_id(&self) -> NodeId {
            self.id
        }
        fn position(&self) -> &Mv {
            &self.pos
        }
        fn validate_position(&self) -> Result<(), GraphError> {
            if ga::dominant_grade(&self.pos) != 1 {
                return Err(GraphError::Invariant(format!(
                    "node {} position is not Grade-1",
                    self.id
                )));
            }
            Ok(())
        }
    }

    struct TestEdge {
        id: EdgeId,
        from: NodeId,
        to: NodeId,
        rotor: Mv,
    }

    impl TestEdge {
        fn between(a: &TestNode, b: &TestNode) -> Self {
            let rotor = ga::normalize(&ga::even_grade(&(*a.position() * *b.position())));
            Self {
                id: Uuid::new_v4(),
                from: a.id,
                to: b.id,
                rotor,
            }
        }
    }

    impl Rotored for TestEdge {
        fn edge_id(&self) -> EdgeId {
            self.id
        }
        fn endpoints(&self) -> (NodeId, NodeId) {
            (self.from, self.to)
        }
        fn rotor(&self) -> &Mv {
            &self.rotor
        }
        fn validate_rotor(&self) -> Result<(), GraphError> {
            if !ga::is_even_grade(&self.rotor) {
                return Err(GraphError::Invariant(format!(
                    "edge {} rotor is not even-grade",
                    self.id
                )));
            }
            Ok(())
        }
    }

    fn graph_with_two() -> (GeoGraph<TestNode, TestEdge>, NodeId, NodeId) {
        let mut g = GeoGraph::new();
        let math = TestNode::new(1.0, 0.0, 0.0);
        let creative = TestNode::new(0.0, 0.0, 1.0);
        let (m, c) = (math.id, creative.id);
        g.add_node(math);
        g.add_node(creative);
        (g, m, c)
    }

    #[test]
    fn project_above_filters_by_threshold() {
        let (g, m, c) = graph_with_two();
        let lit = g.project_above(&[ga::vector(0.5, 0.0, 0.0)], 0.15);
        assert!(lit.contains(&m));
        assert!(!lit.contains(&c));
        assert_eq!(lit.len(), 1);
    }

    #[test]
    fn empty_directions_reach_nothing() {
        let (g, _, _) = graph_with_two();
        assert!(g.project_above(&[], 0.15).is_empty());
        // A scalar-only direction projects to 0 under the Hestenes inner product.
        assert!(g.project_above(&[Mv::scalar(1_000.0)], 0.15).is_empty());
    }

    #[test]
    fn nearest_ranks_desc_and_truncates() {
        let (g, m, c) = graph_with_two();
        let dirs = [ga::vector(0.5, 0.0, 0.0)];
        let ranked = g.nearest(&dirs, 10);
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].0, m, "on-axis node ranks first");
        assert_eq!(ranked[1].0, c);
        assert!(ranked[0].1 > ranked[1].1, "scores descending");
        assert_eq!(g.nearest(&dirs, 1).len(), 1);
        assert!(g.nearest(&dirs, 0).is_empty());
        assert_eq!(g.nearest(&dirs, 999).len(), 2);
    }

    #[test]
    fn nearest_tie_breaks_by_id() {
        let mut g: GeoGraph<TestNode, TestEdge> = GeoGraph::new();
        let a = TestNode::new(1.0, 0.0, 0.0);
        let b = TestNode::new(1.0, 0.0, 0.0);
        let (ai, bi) = (a.id, b.id);
        g.add_node(a);
        g.add_node(b);
        let ranked = g.nearest(&[ga::vector(0.5, 0.0, 0.0)], 2);
        assert_eq!(ranked.len(), 2);
        assert!(
            (ranked[0].1 - ranked[1].1).abs() < ga::EPSILON,
            "scores tie"
        );
        let mut expected = [ai, bi];
        expected.sort();
        assert_eq!([ranked[0].0, ranked[1].0], expected, "ties order by id");
    }

    #[test]
    fn by_grade_filters_grade_one() {
        let (g, m, c) = graph_with_two();
        let g1 = g.by_grade(1);
        assert!(g1.contains(&m) && g1.contains(&c));
        assert_eq!(g1.len(), 2);
        assert!(g.by_grade(2).is_empty());
    }

    #[test]
    fn add_edge_requires_known_endpoints() {
        let mut g: GeoGraph<TestNode, TestEdge> = GeoGraph::new();
        let a = TestNode::new(1.0, 0.0, 0.0);
        let orphan = TestNode::new(0.0, 0.0, 1.0);
        let edge = TestEdge::between(&a, &orphan);
        g.add_node(a);
        match g.add_edge(edge) {
            Err(GraphError::UnknownEndpoint(_)) => {}
            other => panic!("expected UnknownEndpoint, got {other:?}"),
        }
        assert_eq!(g.edge_count(), 0);
    }

    #[test]
    fn transport_rotor_preserves_grade_and_norm() {
        let mut g = GeoGraph::new();
        let a = TestNode::new(1.0, 0.0, 0.0);
        let b = TestNode::new(0.0, 1.0, 0.0);
        let edge = TestEdge::between(&a, &b);
        let eid = edge.id;
        g.add_node(a);
        g.add_node(b);
        g.add_edge(edge).expect("endpoints exist");
        let v = ga::vector(0.6, 0.0, 0.8);
        let out = g.transport(eid, &v).expect("edge exists");
        assert_eq!(ga::dominant_grade(&out), 1, "rotor preserves grade");
        assert!(
            (ga::norm(&out) - ga::norm(&v)).abs() < ga::EPSILON,
            "rotor preserves norm"
        );
        assert!(
            g.transport(Uuid::new_v4(), &v).is_none(),
            "unknown edge → None"
        );
    }

    #[test]
    fn validate_position_rejects_non_grade_one() {
        let bad = TestNode {
            id: Uuid::new_v4(),
            pos: Mv::scalar(1.0),
        };
        assert!(bad.validate_position().is_err());
    }
}
