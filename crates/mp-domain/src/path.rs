use uuid::Uuid;

use crate::PlateauId;

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
