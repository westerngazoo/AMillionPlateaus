# CLAUDE.md — Instructions for Claude Code

## Project: A Million Plateaus

A decentralized spatial learning world. Knowledge graph as geometry. Wizard rank as multivectors.

---

## Read these first

Before touching any code, read in order:
1. `docs/VISION.md` — what this is and why
2. `docs/GARUST_INTEGRATION.md` — how GA maps to every core concept
3. `architecture/GRAPH_SCHEMA.md` — exact Rust types
4. `architecture/SYSTEM_ARCHITECTURE.md` — component boundaries
5. `specs/SDLC.md` — current phase + open tasks

---

## Architecture rules (non-negotiable)

1. **garust is the math layer.** Never use `glam`, `nalgebra`, or any other math lib for graph geometry. All positions, rotors, and reputation multivectors go through garust.

2. **PlateauNode.position is always Grade-1.** Enforce at construction. Panic with a clear message if violated.

3. **Bridge.rotor is always even-grade.** Enforce at construction.

4. **Reputation is never a scalar.** `f32` reputation fields are forbidden in mp-reputation. Always `Multivector` scoped by `DomainId`.

5. **No `unwrap()` in library code** without a comment: `// SAFETY: <reason this cannot fail>`. Panics in `mp-graph`, `mp-reputation`, `mp-crdt` are bugs.

6. **The graph is the platform.** No component should store authoritative state that isn't derivable from the graph. apps/server is stateless w.r.t. graph data.

7. **Reputation is not in the CRDT.** It is computed from signed events. Do not add reputation fields to `CrdtDoc`.

---

## Coding patterns

### Constructors enforce invariants
```rust
// Good
impl PlateauNode {
    pub fn new(name: &str, domain_id: DomainId, e1: f32, e2: f32, e3: f32) -> Self {
        let position = Multivector::vector(e1, e2, e3);
        debug_assert_eq!(position.dominant_grade(), 1, "PlateauNode position must be Grade-1");
        Self { id: Uuid::new_v4(), name: name.to_string(), domain_id, position, .. }
    }
}

// Bad — public field, invariant can be violated externally
pub struct PlateauNode {
    pub position: Multivector,  // ← do not do this
}
```

### Error handling
```rust
// Use thiserror for library errors
#[derive(thiserror::Error, Debug)]
pub enum GraphError {
    #[error("Plateau {0} not found")]
    PlateauNotFound(PlateauId),
    #[error("Bridge references unknown plateau: {0}")]
    InvalidBridgeEndpoint(PlateauId),
}

// Return Result, never panic in public API
pub fn add_bridge(&mut self, bridge: Bridge) -> Result<EdgeIndex, GraphError> { ... }
```

### Tests live next to code
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plateau_position_is_grade_one() {
        let p = PlateauNode::new("test", DomainId::new_v4(), 0.9, 0.1, 0.0);
        assert_eq!(p.position.dominant_grade(), 1);
    }

    #[test]
    fn sybil_cluster_stays_grade_zero() {
        // 3 fake wizards all vouching for each other
        // reputation propagation should not produce grade > 0
        // ... see mp-reputation/src/tests/sybil.rs
    }
}
```

---

## File layout conventions

```
crates/mp-graph/src/
  lib.rs          ← pub use re-exports only
  types.rs        ← all structs/enums (PlateauNode, Bridge, etc.)
  graph.rs        ← KnowledgeGraph impl
  db.rs           ← redb persistence
  error.rs        ← GraphError enum
  tests/          ← integration tests

crates/mp-reputation/src/
  lib.rs
  reputation.rs   ← WizardReputation, ReputationEngine
  eigentrust.rs   ← GA Eigentrust propagation
  sybil.rs        ← grade-collapse detection
  tests/

crates/mp-wasm/src/
  lib.rs          ← #[wasm_bindgen] exports only, thin wrappers

apps/alebrije/src/
  index.ts        ← Express server entry
  companion.ts    ← Claude API call
  context-builder.ts ← system prompt assembly
  plateau-prompts.ts  ← plateau knowledge base
  creature-voice.ts   ← archetype → voice mapping

apps/server/src/
  index.ts
  rooms/
    PlateauRoom.ts
    WildRoom.ts
  routes/
    wizards.ts
    plateaus.ts
```

---

## Current phase

**Phase 0 — Foundation** (see `specs/SDLC.md`)

Start with:
1. `cargo new --name million-plateaus` (if workspace not yet created)
2. Create crate skeletons
3. Implement types in `crates/mp-graph/src/types.rs`
4. Implement `KnowledgeGraph` basics in `crates/mp-graph/src/graph.rs`
5. `cargo test --workspace` must be green before moving to Phase 1

---

## garust path

```toml
# Adjust this path in Cargo.toml to wherever garust lives on disk
garust = { path = "../../garust" }
```

If garust is not found, stop and ask the developer for the correct path. Do not stub out GA functionality.

---

## Things to never do

- Never introduce `linear_algebra`, `nalgebra`, `glam` as graph math deps
- Never add reputation as a CRDT field
- Never store `f32` as a reputation value outside of internal GA computation
- Never call `unwrap()` on `Option` from graph lookups without bounds-checking first
- Never make `PlateauNode.position` a public mutable field
- Never use `async` in `mp-graph` or `mp-reputation` (they are pure computation)
- Never commit with failing tests
