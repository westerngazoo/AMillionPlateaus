//! `KnowledgeGraph` — the platform's single source of authoritative state.

use std::collections::HashMap;

use petgraph::graph::{EdgeIndex, NodeIndex};
use petgraph::Graph;

use crate::error::GraphError;
use crate::types::{
    Bridge, PlateauId, PlateauNode, Resource, ResourceId, WizardId, WizardProfile, WizardReputation,
};

pub struct KnowledgeGraph {
    pub graph: Graph<PlateauNode, Bridge>,
    pub index: HashMap<PlateauId, NodeIndex>,
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
            graph: Graph::new(),
            index: HashMap::new(),
            resources: HashMap::new(),
            wizards: HashMap::new(),
            reputation: HashMap::new(),
        }
    }

    /// Insert a plateau and make it retrievable by id.
    pub fn add_plateau(&mut self, plateau: PlateauNode) -> NodeIndex {
        let id = plateau.id;
        let idx = self.graph.add_node(plateau);
        self.index.insert(id, idx);
        idx
    }

    /// Add a bridge. Both endpoints must already exist in the graph.
    pub fn add_bridge(&mut self, bridge: Bridge) -> Result<EdgeIndex, GraphError> {
        let from = *self
            .index
            .get(&bridge.from)
            .ok_or(GraphError::InvalidBridgeEndpoint(bridge.from))?;
        let to = *self
            .index
            .get(&bridge.to)
            .ok_or(GraphError::InvalidBridgeEndpoint(bridge.to))?;
        Ok(self.graph.add_edge(from, to, bridge))
    }

    pub fn plateau(&self, id: &PlateauId) -> Option<&PlateauNode> {
        let idx = self.index.get(id)?;
        self.graph.node_weight(*idx)
    }

    pub fn plateaus(&self) -> impl Iterator<Item = &PlateauNode> {
        self.graph.node_weights()
    }

    pub fn bridges(&self) -> impl Iterator<Item = &Bridge> {
        self.graph.edge_weights()
    }

    pub fn plateau_count(&self) -> usize {
        self.graph.node_count()
    }

    pub fn bridge_count(&self) -> usize {
        self.graph.edge_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::PlateauNode;
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
            Err(GraphError::InvalidBridgeEndpoint(_)) => {}
            other => panic!("expected InvalidBridgeEndpoint, got {other:?}"),
        }
        assert_eq!(g.bridge_count(), 0);
    }
}
