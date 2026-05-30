# GRAPH SCHEMA — A Million Plateaus

## Core Rust Types

```rust
// crates/mp-graph/src/types.rs

use garust::Multivector;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ─── Identity ────────────────────────────────────────────────

pub type PlateauId  = Uuid;
pub type DomainId   = Uuid;
pub type WizardId   = Uuid;
pub type ResourceId = Uuid;
pub type BridgeId   = Uuid;

// ─── Knowledge Space ─────────────────────────────────────────

/// A self-contained knowledge domain / concept.
/// Position is a Grade-1 multivector in G(3,0,0):
///   e1 = Formal/Mathematical
///   e2 = Physical/Empirical
///   e3 = Creative/Expressive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateauNode {
    pub id:          PlateauId,
    pub name:        String,
    pub description: String,
    pub domain_id:   DomainId,
    pub position:    Multivector,   // Grade-1 enforced at construction
    pub fog:         bool,          // runtime state, not persisted
    pub created_at:  u64,           // unix timestamp
}

impl PlateauNode {
    pub fn new(name: &str, domain_id: DomainId, e1: f32, e2: f32, e3: f32) -> Self {
        Self {
            id:          Uuid::new_v4(),
            name:        name.to_string(),
            description: String::new(),
            domain_id,
            position:    Multivector::vector(e1, e2, e3),
            fog:         true,
            created_at:  now_unix(),
        }
    }
}

/// Conceptual connection between two plateaus.
/// Encoded as a GA rotor (even-grade element).
///
/// Bridge grades:
///   Grade 1 dominant → prerequisite (directed)
///   Grade 2 dominant → lateral peer (bidirectional)
///   Grade 3 dominant → deep synthesis (volumetric)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bridge {
    pub id:               BridgeId,
    pub from:             PlateauId,
    pub to:               PlateauId,
    pub concept_label:    String,       // "linear transformation", "eigenfunctions"
    pub rotor:            Multivector,  // even-grade, encodes orientation
    pub dominant_grade:   u8,           // 1 | 2 | 3
    pub bidirectional:    bool,
    pub created_by:       WizardId,
}

// ─── Wizard ──────────────────────────────────────────────────

/// Wizard identity and traversal record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardProfile {
    pub id:           WizardId,
    pub handle:       String,
    pub pubkey:       String,           // Nostr-compatible hex pubkey
    pub traversals:   Vec<Traversal>,
    pub alebrije:     AlibrijeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Traversal {
    pub plateau_id:   PlateauId,
    pub depth:        u32,             // time-weighted depth score
    pub first_visit:  u64,
    pub last_visit:   u64,
}

/// Multivector reputation, scoped per domain.
/// Grade interpretation:
///   0 → raw activity (easily faked)
///   1 → domain depth (harder to fake)
///   2 → cross-domain synthesis (very hard)
///   3 → Grand Wizard — all meta-domains synthesized
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardReputation {
    pub wizard_id:    WizardId,
    pub domain_reps:  HashMap<DomainId, Multivector>,
    pub synthesis:    Multivector,     // grows only via cross-domain work
}

// ─── Alebrije ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlibrijeState {
    pub name:         String,
    pub components:   Vec<CreatureComponent>,
    pub color_map:    HashMap<DomainId, [f32; 3]>, // RGB per domain
    pub evolution_log: Vec<EvolutionEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatureComponent {
    pub archetype:    CreatureArchetype,
    pub body_part:    BodyPart,
    pub color:        [f32; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CreatureArchetype {
    Owl,       // Formal logic, proof
    Octopus,   // Systems thinking
    Jaguar,    // Intuition, pattern recognition
    Serpent,   // Recursion, self-reference
    Eagle,     // Abstraction, elevation
    Axolotl,   // Resilience in confusion
    // extensible via data-driven config
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BodyPart {
    Head, Wings, Body, Tail, Legs, Eyes, Fins,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionEvent {
    pub plateau_id:   PlateauId,
    pub timestamp:    u64,
    pub gained:       CreatureComponent,
}

// ─── Resources ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub id:           ResourceId,
    pub plateau_id:   PlateauId,
    pub title:        String,
    pub kind:         ResourceKind,
    pub uri:          String,           // IPFS CID or URL
    pub contributor:  WizardId,
    pub signature:    String,           // Nostr signature
    pub vote_count:   f32,              // weighted by voter reputation
    pub state:        ResourceState,
    pub created_at:   u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceKind {
    Article,
    Video,
    Interactive,
    Paper,
    Note,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceState {
    Floating,       // newly contributed, low votes
    Crystallizing,  // approaching threshold
    Crystallized,   // permanent terrain
    Dissolving,     // below decay threshold
    Archived,       // dissolved, kept for history
}

// ─── Graph Container ─────────────────────────────────────────

use petgraph::Graph;

pub struct KnowledgeGraph {
    pub graph:      Graph<PlateauNode, Bridge>,
    pub index:      HashMap<PlateauId, petgraph::graph::NodeIndex>,
    pub resources:  HashMap<ResourceId, Resource>,
    pub wizards:    HashMap<WizardId, WizardProfile>,
    pub reputation: HashMap<WizardId, WizardReputation>,
}

impl KnowledgeGraph {
    pub fn new() -> Self {
        Self {
            graph:      Graph::new(),
            index:      HashMap::new(),
            resources:  HashMap::new(),
            wizards:    HashMap::new(),
            reputation: HashMap::new(),
        }
    }

    pub fn add_plateau(&mut self, plateau: PlateauNode) -> petgraph::graph::NodeIndex {
        let id = plateau.id;
        let idx = self.graph.add_node(plateau);
        self.index.insert(id, idx);
        idx
    }

    pub fn add_bridge(&mut self, bridge: Bridge) -> Option<petgraph::graph::EdgeIndex> {
        let from_idx = *self.index.get(&bridge.from)?;
        let to_idx   = *self.index.get(&bridge.to)?;
        Some(self.graph.add_edge(from_idx, to_idx, bridge))
    }

    pub fn plateau(&self, id: &PlateauId) -> Option<&PlateauNode> {
        let idx = self.index.get(id)?;
        self.graph.node_weight(*idx)
    }

    pub fn reachable_plateaus(&self, wizard: &WizardReputation) -> Vec<PlateauId> {
        self.graph
            .node_weights()
            .filter(|p| self.is_reachable(p, wizard))
            .map(|p| p.id)
            .collect()
    }

    fn is_reachable(&self, plateau: &PlateauNode, wizard: &WizardReputation) -> bool {
        // Find the domain reputation most aligned with this plateau
        wizard.domain_reps
            .values()
            .map(|rep| rep.inner_product(&plateau.position).scalar_part())
            .fold(f32::NEG_INFINITY, f32::max)
            > REACHABILITY_THRESHOLD
    }
}

pub const REACHABILITY_THRESHOLD: f32 = 0.15;
pub const CRYSTALLIZE_THRESHOLD:  f32 = 50.0;   // weighted votes
pub const DECAY_THRESHOLD:        f32 = -10.0;  // net negative votes

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
```

---

## Persistence Schema (redb)

```rust
// crates/mp-graph/src/db.rs

use redb::{Database, TableDefinition};

// Table definitions — key: UUID bytes, value: bincode-serialized struct
const PLATEAUS:   TableDefinition<&[u8], &[u8]> = TableDefinition::new("plateaus");
const BRIDGES:    TableDefinition<&[u8], &[u8]> = TableDefinition::new("bridges");
const WIZARDS:    TableDefinition<&[u8], &[u8]> = TableDefinition::new("wizards");
const REPUTATION: TableDefinition<&[u8], &[u8]> = TableDefinition::new("reputation");
const RESOURCES:  TableDefinition<&[u8], &[u8]> = TableDefinition::new("resources");
const META:       TableDefinition<&str,  &[u8]> = TableDefinition::new("meta");
// META keys: "schema_version", "graph_id", "last_sync"
```

## CRDT Document Structure (Automerge)

```
AutomergeDoc {
  plateaus:   Map<PlateauId, PlateauNode>
  bridges:    Map<BridgeId,  Bridge>
  resources:  Map<ResourceId, Resource>
  votes:      Map<ResourceId, Map<WizardId, f32>>  // grow-only semantics
  // Wizard profiles and reputation are NOT in CRDT —
  // they are computed locally from signed event log
}
```

Reputation is **not synced directly** — it is computed from a signed event log (Nostr events), which is synced. This prevents reputation spoofing via CRDT manipulation.
