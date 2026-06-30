//! AMP's knowledge-graph vocabulary. Geometry flows through garust via the
//! `mp_graph::ga` adapter — see GARUST_INTEGRATION.md.
//!
//! Moved verbatim from `mp-graph` by SPEC-0008 (RFC-0001 Scope A): the structs,
//! their serde representation, derives, and methods are byte-for-byte the same,
//! so existing CRDT documents and redb files keep round-tripping (R-0008 AC4).
//! The only additions are `impl mp_graph::Positioned for PlateauNode` and
//! `impl mp_graph::Rotored for Bridge`, which let the generic store read their
//! geometry.
//!
//! Invariants enforced at construction:
//!   * `PlateauNode.position` is a Grade-1 multivector (a pure vector in G(3,0,0)).
//!   * `Bridge.rotor` is even-grade (Grade-0 + Grade-2 only).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use mp_graph::ga::{self, Mv};
use mp_graph::{EdgeId, GraphError, NodeId, Positioned, Rotored};

// ─── Identity ────────────────────────────────────────────────
//
// Domain id names. `PlateauId`/`BridgeId` are the store's `NodeId`/`EdgeId`
// under AMP's vocabulary; the rest scope reputation and resources.

pub type PlateauId = NodeId;
pub type DomainId = Uuid;
pub type WizardId = Uuid;
pub type ResourceId = Uuid;
pub type BridgeId = EdgeId;

// ─── Bivector Domain Math (Phase 1 Additions) ────────────────

/// Fit a domain's characteristic plane (a grade-2 bivector) from its member topics.
///
/// A domain is geometrically a plane spanning its topics. Since real topics scatter in 3D
/// and are rarely perfectly coplanar, we take the wedge of the first two distinct topics
/// as a cheap approximation of the plane (the Phase 1 fit). For a 1-topic or empty
/// domain, it returns the zero multivector (or a fallback lens axis in Phase 2).
pub fn domain_plane(topics: &[&Mv]) -> Mv {
    if topics.len() < 2 {
        return Mv::zero();
    }
    ga::normalize(&ga::wedge(topics[0], topics[1]))
}

/// The out-of-plane fraction for a topic `v` against a domain plane `b`.
///
/// Returns 0.0 if `v` lies exactly in `b`, up to 1.0 if orthogonal.
/// Computed as `‖⟨v ∧ B⟩₃‖ / (‖v‖·‖B‖)`.
pub fn membership(v: &Mv, b: &Mv) -> f32 {
    let vol = ga::grade_magnitude(&ga::wedge(v, b), 3);
    let denom = ga::grade_magnitude(v, 1) * ga::grade_magnitude(b, 2);
    if denom > ga::EPSILON {
        vol / denom
    } else {
        0.0
    }
}

/// The shared line (a grade-1 vector) where two domain planes overlap.
///
/// Computes the regressive product (meet) of the two bivectors. If the planes
/// are parallel or non-intersecting in the relevant way, the meet will be near-zero.
pub fn shared_line(b1: &Mv, b2: &Mv) -> Mv {
    ga::meet(b1, b2)
}

// ─── Knowledge Space ─────────────────────────────────────────

/// A self-contained knowledge domain / concept.
///
/// `position` is a Grade-1 multivector in G(3,0,0):
///   e1 = Formal/Mathematical, e2 = Physical/Empirical, e3 = Creative/Expressive.
///
/// `position` is private: the Grade-1 invariant must hold for the value's whole
/// life, so it is set once at construction and never mutated externally.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateauNode {
    pub id: PlateauId,
    pub name: String,
    pub description: String,
    pub domain_id: DomainId,
    #[serde(with = "mp_graph::ga::serde_mv")]
    position: Mv,
    /// Runtime fog state — not authoritative graph data.
    pub fog: bool,
    pub created_at: u64,
}

impl PlateauNode {
    pub fn new(name: &str, domain_id: DomainId, e1: f32, e2: f32, e3: f32) -> Self {
        let position = ga::vector(e1, e2, e3);
        debug_assert_eq!(
            ga::dominant_grade(&position),
            1,
            "PlateauNode position must be Grade-1"
        );
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            description: String::new(),
            domain_id,
            position,
            fog: true,
            created_at: now_unix(),
        }
    }

    pub fn with_description(mut self, description: &str) -> Self {
        self.description = description.to_string();
        self
    }

    pub fn position(&self) -> &Mv {
        &self.position
    }

    /// Validate the Grade-1 invariant for data not built via `new`
    /// (e.g. deserialized from disk or the network).
    pub fn validate(&self) -> Result<(), GraphError> {
        let grade = ga::dominant_grade(&self.position);
        if grade != 1 {
            return Err(GraphError::Invariant(format!(
                "plateau {} position is not Grade-1 (dominant grade {grade})",
                self.id
            )));
        }
        Ok(())
    }
}

/// Position a plateau in the generic store. The Grade-1 invariant is enforced
/// at construction (`new`) and re-checked on load via [`Positioned::validate_position`].
impl Positioned for PlateauNode {
    fn node_id(&self) -> NodeId {
        self.id
    }
    fn position(&self) -> &Mv {
        &self.position
    }
    fn validate_position(&self) -> Result<(), GraphError> {
        self.validate()
    }
}

/// Conceptual connection between two plateaus, encoded as a GA rotor.
///
/// The rotor is the even-grade part of the geometric product of the two plateau
/// positions, normalized. `dominant_grade` records the rotor's actual dominant
/// grade (0 or 2 for an even element) — the richer 1/2/3 bridge-type semantics
/// in GARUST_INTEGRATION.md §3 are layered on in a later phase.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bridge {
    pub id: BridgeId,
    pub from: PlateauId,
    pub to: PlateauId,
    pub concept_label: String,
    #[serde(with = "mp_graph::ga::serde_mv")]
    rotor: Mv,
    pub dominant_grade: u8,
    pub bidirectional: bool,
    pub created_by: WizardId,
}

impl Bridge {
    /// Build a bridge between two plateaus. The rotor is
    /// `(from.position * to.position).even_grade().normalize()`.
    pub fn between(
        from: &PlateauNode,
        to: &PlateauNode,
        concept_label: &str,
        created_by: WizardId,
    ) -> Self {
        let geometric = *from.position() * *to.position();
        let rotor = ga::normalize(&ga::even_grade(&geometric));
        let dominant_grade = ga::dominant_grade(&rotor);
        debug_assert!(
            ga::is_even_grade(&rotor),
            "Bridge rotor must be even-grade (Grade-0 + Grade-2)"
        );
        Self {
            id: Uuid::new_v4(),
            from: from.id,
            to: to.id,
            concept_label: concept_label.to_string(),
            rotor,
            dominant_grade,
            // Grade-1 (prerequisite) bridges are directed; an even rotor is
            // never grade 1, so seed bridges are lateral/bidirectional.
            bidirectional: dominant_grade != 1,
            created_by,
        }
    }

    pub fn rotor(&self) -> &Mv {
        &self.rotor
    }

    /// Validate the even-grade invariant for data not built via `between`.
    pub fn validate(&self) -> Result<(), GraphError> {
        if !ga::is_even_grade(&self.rotor) {
            return Err(GraphError::Invariant(format!(
                "bridge {} rotor is not even-grade",
                self.id
            )));
        }
        let actual = ga::dominant_grade(&self.rotor);
        if self.dominant_grade != actual {
            return Err(GraphError::Invariant(format!(
                "bridge {} recorded dominant_grade {} != rotor dominant_grade {actual}",
                self.id, self.dominant_grade
            )));
        }
        Ok(())
    }
}

/// Connect two plateaus in the generic store as an even-grade rotor edge.
impl Rotored for Bridge {
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
        self.validate()
    }
}

// ─── Wizard / Reputation / Alebrije / Resource ───────────────
//
// Declared here (the schema is one module) so downstream crates can name them.
// Their algorithms live in mp-reputation (Phase 1) and are out of R-0001 scope.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardProfile {
    pub id: WizardId,
    pub handle: String,
    pub pubkey: String,
    pub traversals: Vec<Traversal>,
    pub alebrije: AlebrijeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Traversal {
    pub plateau_id: PlateauId,
    pub depth: u32,
    pub first_visit: u64,
    pub last_visit: u64,
}

/// Multivector reputation, scoped per domain. Never a scalar (CLAUDE.md §4).
/// Algorithms (Eigentrust propagation, Sybil grade-collapse) land in
/// mp-reputation; here we only declare the shape.
#[derive(Debug, Clone)]
pub struct WizardReputation {
    pub wizard_id: WizardId,
    pub domain_reps: HashMap<DomainId, Mv>,
    pub synthesis: Mv,
}

impl WizardReputation {
    /// A fresh wizard: no domain reputation, zero synthesis. Reports
    /// `dominant_grade() == 0` (raw) — every plateau is fogged until they
    /// traverse something.
    pub fn new(wizard_id: WizardId) -> Self {
        Self {
            wizard_id,
            domain_reps: HashMap::new(),
            synthesis: Mv::zero(),
        }
    }

    /// The wizard's "rank grade": the maximum dominant grade across all domain
    /// reputations and the synthesis. 0 = raw, 1 = domain depth, 2 = synthesis,
    /// 3 = grand wizard. A fresh wizard (zero everywhere) reports 0.
    pub fn dominant_grade(&self) -> u8 {
        self.domain_reps
            .values()
            .chain(std::iter::once(&self.synthesis))
            .map(ga::dominant_grade)
            .max()
            .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlebrijeState {
    pub name: String,
    pub components: Vec<CreatureComponent>,
    pub color_map: HashMap<DomainId, [f32; 3]>,
    pub evolution_log: Vec<EvolutionEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatureComponent {
    pub archetype: CreatureArchetype,
    pub body_part: BodyPart,
    pub color: [f32; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CreatureArchetype {
    Owl,
    Octopus,
    Jaguar,
    Serpent,
    Eagle,
    Axolotl,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BodyPart {
    Head,
    Wings,
    Body,
    Tail,
    Legs,
    Eyes,
    Fins,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionEvent {
    pub plateau_id: PlateauId,
    pub timestamp: u64,
    pub gained: CreatureComponent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub id: ResourceId,
    pub plateau_id: PlateauId,
    pub title: String,
    pub kind: ResourceKind,
    pub uri: String,
    pub contributor: WizardId,
    pub signature: String,
    pub vote_count: f32,
    pub state: ResourceState,
    pub created_at: u64,
}

impl Resource {
    /// A freshly contributed resource (a trail marker): `Floating`, zero votes,
    /// unsigned. The id is engine-assigned. Attribution (`contributor` /
    /// `signature`) is deferred — callers pass `Uuid::nil()` this phase
    /// (R-0014 AC5). State and vote_count are fixed here so no caller can pick a
    /// rank/state; crystallization is earned through voting (R-0015).
    pub fn new(
        plateau_id: PlateauId,
        title: &str,
        kind: ResourceKind,
        uri: &str,
        contributor: WizardId,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            plateau_id,
            title: title.to_string(),
            kind,
            uri: uri.to_string(),
            contributor,
            signature: String::new(),
            vote_count: 0.0,
            state: ResourceState::Floating,
            // Same non-authoritative stamp as PlateauNode::new (0 on wasm32).
            created_at: now_unix(),
        }
    }
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
    Floating,
    Crystallizing,
    Crystallized,
    Dissolving,
    Archived,
}

// ─── Thresholds (shared constants) ───────────────────────────

pub const REACHABILITY_THRESHOLD: f32 = 0.15;
pub const CRYSTALLIZE_THRESHOLD: f32 = 50.0;
pub const DECAY_THRESHOLD: f32 = -10.0;

/// Wall-clock seconds since the Unix epoch, for non-authoritative `created_at`
/// metadata.
#[cfg(not(target_arch = "wasm32"))]
fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// `wasm32-unknown-unknown` has no wall clock — `SystemTime::now()` *panics*
/// there. `created_at` is non-authoritative metadata (never read by reachability
/// or any graph invariant), so on wasm we return 0 rather than let a panic cross
/// the WASM FFI (CLAUDE.md §5). A real browser timestamp can be supplied from JS
/// in a later phase if the world ever needs it.
#[cfg(target_arch = "wasm32")]
fn now_unix() -> u64 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn domain() -> DomainId {
        Uuid::new_v4()
    }

    #[test]
    fn plateau_position_is_grade_one() {
        let p = PlateauNode::new("Linear Algebra", domain(), 0.9, 0.1, 0.0);
        assert_eq!(ga::dominant_grade(p.position()), 1);
    }

    #[test]
    fn plateau_position_scalar_part_is_zero() {
        let p = PlateauNode::new("Harmony", domain(), 0.3, 0.4, 0.8);
        assert!(p.position().scalar_part().abs() < ga::EPSILON);
    }

    #[test]
    fn bridge_rotor_is_even_grade() {
        let d = domain();
        let a = PlateauNode::new("Linear Algebra", d, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("Differential Geometry", d, 0.6, 0.5, 0.1);
        let bridge = Bridge::between(&a, &b, "linear transformation", Uuid::new_v4());
        assert!(ga::is_even_grade(bridge.rotor()));
    }

    #[test]
    fn bridge_dominant_grade_recorded() {
        let d = domain();
        let a = PlateauNode::new("Linear Algebra", d, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("Music Theory", d, 0.3, 0.4, 0.8);
        let bridge = Bridge::between(&a, &b, "symmetry", Uuid::new_v4());
        assert_eq!(bridge.dominant_grade, ga::dominant_grade(bridge.rotor()));
        bridge.validate().expect("freshly built bridge is valid");
    }

    #[test]
    fn validate_accepts_constructed_plateau() {
        let p = PlateauNode::new("Topology", domain(), 0.8, 0.2, 0.1);
        p.validate().expect("constructed plateau passes validation");
    }

    // ─── AC1 — reputation shape ──────────────────────────────

    #[test]
    fn fresh_reputation_is_empty_and_grade_zero() {
        let w = WizardReputation::new(Uuid::new_v4());
        assert!(w.domain_reps.is_empty());
        assert!(w.synthesis.scalar_part().abs() < ga::EPSILON);
        assert_eq!(w.dominant_grade(), 0);
    }

    /// Reputation is a multivector whose *grade* — never a scalar magnitude — is
    /// the measure of trust. A large scalar-only domain rep is still grade 0.
    #[test]
    fn scalar_reputation_is_grade_zero_regardless_of_magnitude() {
        let mut w = WizardReputation::new(Uuid::new_v4());
        w.domain_reps.insert(domain(), Mv::scalar(1_000.0));
        assert_eq!(w.dominant_grade(), 0, "magnitude must not promote grade");
    }
}
