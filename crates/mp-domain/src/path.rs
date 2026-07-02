use uuid::Uuid;

use crate::{KnowledgeGraph, PlateauId};

/// A sequence of plateaus representing a learning path.
pub struct Path {
    pub id: Uuid,
    pub title: String,
    pub goal: String,
    pub steps: Vec<PlateauId>,
}

impl Path {
    /// Creates a new Path. Returns an error if the title is empty.
    /// Deduplicates steps, preserving the order of first occurrence.
    pub fn new(
        id: Uuid,
        title: String,
        goal: String,
        steps: Vec<PlateauId>,
    ) -> Result<Self, &'static str> {
        if title.is_empty() {
            return Err("Title cannot be empty");
        }

        let mut unique_steps = Vec::new();
        for step in steps {
            if !unique_steps.contains(&step) {
                unique_steps.push(step);
            }
        }

        Ok(Self {
            id,
            title,
            goal,
            steps: unique_steps,
        })
    }

    /// Reorders a step from `from_index` to `to_index`.
    pub fn reorder(&mut self, from_index: usize, to_index: usize) {
        if from_index < self.steps.len() && to_index < self.steps.len() && from_index != to_index {
            let step = self.steps.remove(from_index);
            self.steps.insert(to_index, step);
        }
    }

    /// Inserts a step at the given index. If the step is already present, it is not inserted.
    /// If index is out of bounds, it pushes to the end.
    pub fn insert(&mut self, mut index: usize, step: PlateauId) {
        if !self.steps.contains(&step) {
            if index > self.steps.len() {
                index = self.steps.len();
            }
            self.steps.insert(index, step);
        }
    }

    /// Removes a step at the given index.
    pub fn remove(&mut self, index: usize) {
        if index < self.steps.len() {
            self.steps.remove(index);
        }
    }
}

/// Derive the ordered, deduped domain set for a path from the live graph.
pub fn path_domains(graph: &KnowledgeGraph, path: &Path) -> Vec<Uuid> {
    let mut out = Vec::new();
    for step in &path.steps {
        if let Some(p) = graph.plateau(step) {
            if !out.contains(&p.domain_id) {
                out.push(p.domain_id);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::PlateauNode;

    fn domain() -> Uuid {
        Uuid::new_v4()
    }

    #[test]
    fn new_rejects_empty_title() {
        assert!(Path::new(Uuid::new_v4(), "".into(), "goal".into(), vec![]).is_err());
    }

    #[test]
    fn new_dedupes_steps_preserving_order() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let path = Path::new(Uuid::new_v4(), "Title".into(), "Goal".into(), vec![a, b, a]).unwrap();
        assert_eq!(path.steps, vec![a, b]);
    }

    #[test]
    fn reorder_moves_step() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let mut path = Path::new(Uuid::new_v4(), "T".into(), "G".into(), vec![a, b, c]).unwrap();
        path.reorder(2, 0);
        assert_eq!(path.steps, vec![c, a, b]);
    }

    #[test]
    fn insert_skips_duplicates() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut path = Path::new(Uuid::new_v4(), "T".into(), "G".into(), vec![a]).unwrap();
        path.insert(1, a);
        path.insert(1, b);
        assert_eq!(path.steps, vec![a, b]);
    }

    #[test]
    fn path_domains_collects_from_graph() {
        let d1 = domain();
        let d2 = domain();
        let mut g = KnowledgeGraph::new();
        let p1 = PlateauNode::new("A", d1, 1.0, 0.0, 0.0);
        let p2 = PlateauNode::new("B", d2, 0.0, 1.0, 0.0);
        let id1 = p1.id;
        let id2 = p2.id;
        g.add_plateau(p1);
        g.add_plateau(p2);
        let path = Path::new(Uuid::new_v4(), "T".into(), "G".into(), vec![id1, id2, id1]).unwrap();
        assert_eq!(path_domains(&g, &path), vec![d1, d2]);
    }
}
