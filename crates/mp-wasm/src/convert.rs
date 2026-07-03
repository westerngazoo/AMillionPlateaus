//! Pure, host-testable marshalling between the JS boundary and `mp-graph`.
//!
//! Everything with branching logic — UUID parsing, JSON decoding, DTO building,
//! the reachability queries — lives here as plain functions over `mp_domain`
//! types, exercised by `cargo test --workspace` on the host (SPEC-0003 §2). No
//! `#[wasm_bindgen]` appears in this file; `lib.rs` is the binding skin.
//!
//! This module performs **no** geometric-algebra computation. Building
//! `Mv { coeffs }` from a decoded array is value-marshalling — `coeffs` is a
//! public field on garust's `Vga3f`. All GA math (projection, reachability)
//! stays in `mp-graph`.

use std::collections::HashMap;

use mp_crdt::ResourceVote;
use mp_domain::ga::Mv;
use mp_domain::{
    Bridge, KnowledgeGraph, PlateauNode, Resource, ResourceKind, ResourceState, WizardReputation,
};
use mp_identity::{
    Keypair, Mastery, NostrEvent, PathDoc, Proof, Traversal, Vouch, KIND_MASTERY, KIND_PATH,
    KIND_PROOF, KIND_TRAVERSAL, KIND_VOUCH,
};
use uuid::Uuid;

use crate::error::{EventError, QueryError, ReputationParseError};

/// Wire shape of `wizard_rep_json` (SPEC-0003 §Reputation DTO, R-0003 AC5):
/// `{ "domain_reps": { "<uuid>": [f32; 8], .. }, "synthesis": [f32; 8] }`,
/// each array a garust coefficient vector in blade order
/// `[1, e1, e2, e12, e3, e13, e23, e123]`.
#[derive(serde::Deserialize)]
struct ReputationDto {
    #[serde(default)]
    domain_reps: HashMap<String, [f32; 8]>,
    /// Defaults to all-zero when omitted.
    #[serde(default)]
    synthesis: [f32; 8],
}

/// Decode a `wizard_rep_json` string into a `WizardReputation` (AC5).
///
/// `wizard_id` is set to `Uuid::nil()` — reachability never reads it. A
/// scalar-only reputation (arrays carrying only index 0) decodes to Grade-0
/// multivectors, which the Hestenes projection in `mp-graph` sends to fog: the
/// Sybil property is preserved across the boundary.
pub fn parse_reputation(json: &str) -> Result<WizardReputation, ReputationParseError> {
    let dto: ReputationDto = serde_json::from_str(json)?;
    let mut domain_reps = HashMap::new();
    for (k, coeffs) in dto.domain_reps {
        let id = Uuid::parse_str(&k)?;
        domain_reps.insert(id, Mv { coeffs });
    }
    Ok(WizardReputation {
        wizard_id: Uuid::nil(),
        domain_reps,
        synthesis: Mv {
            coeffs: dto.synthesis,
        },
    })
}

/// Grade-1 components of a position (AC2). Blade order puts e3 at index 4 (index
/// 3 is the e12 bivector).
#[derive(serde::Serialize)]
pub struct PositionDto {
    pub e1: f32,
    pub e2: f32,
    pub e3: f32,
}

/// JS-facing view of a plateau (AC2). `domain_id` (R-0012 AC5) lets the web app
/// rebuild its id→domain map from a restored doc, so an authored plateau scores
/// reputation under its own domain after a reload — additive value marshalling,
/// no GA.
#[derive(serde::Serialize)]
pub struct PlateauDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub domain_id: String,
    pub position: PositionDto,
}

/// JS-facing view of a bridge — endpoints by id plus the concept label. The
/// rotor/grade stay in the Rust core; the web app only needs to draw a labelled
/// line between two plateaus (SPEC-0005 §2.3, R-0005 AC4).
#[derive(serde::Serialize)]
pub struct BridgeDto {
    pub id: String,
    pub from: String,
    pub to: String,
    pub concept: String,
}

/// Map a `Bridge` to its JS DTO.
pub fn bridge_dto(b: &Bridge) -> BridgeDto {
    BridgeDto {
        id: b.id.to_string(),
        from: b.from.to_string(),
        to: b.to.to_string(),
        concept: b.concept_label.clone(),
    }
}

/// JS-facing view of a resource / trail marker (R-0014). `kind` and `state` are
/// unit enums, so serde emits each as its variant-name string ("Note",
/// "Floating") — the web app reads them directly. The rotor/GA and vote tally
/// stay in Rust; this is value marshalling only.
#[derive(serde::Serialize)]
pub struct ResourceDto {
    pub id: String,
    pub plateau_id: String,
    pub title: String,
    pub kind: ResourceKind,
    pub uri: String,
    pub state: ResourceState,
    pub vote_count: f32,
}

/// Map a `Resource` to its JS DTO.
pub fn resource_dto(r: &Resource) -> ResourceDto {
    ResourceDto {
        id: r.id.to_string(),
        plateau_id: r.plateau_id.to_string(),
        title: r.title.clone(),
        kind: r.kind.clone(),
        uri: r.uri.clone(),
        state: r.state.clone(),
        vote_count: r.vote_count,
    }
}

/// Parse a `ResourceKind` from the human label the web app sends. An unknown or
/// blank label falls back to `Note` (R-0014 AC3) — the enum stays authoritative
/// in Rust; JS never couples to it.
pub fn parse_resource_kind(s: &str) -> ResourceKind {
    match s {
        "Article" => ResourceKind::Article,
        "Video" => ResourceKind::Video,
        "Interactive" => ResourceKind::Interactive,
        "Paper" => ResourceKind::Paper,
        "Tool" => ResourceKind::Tool,
        _ => ResourceKind::Note,
    }
}

/// Every plateau in the graph as JS DTOs — the render layer needs the full set
/// (both lit and fogged), which `reachable_plateaus` (lit only) cannot give.
pub fn all_plateau_dtos(g: &KnowledgeGraph) -> Vec<PlateauDto> {
    g.plateaus().map(plateau_dto).collect()
}

/// Every resource (trail marker) in the graph as JS DTOs — anchored to its
/// plateau, rendered as a marker near it (R-0014).
pub fn all_resource_dtos(g: &KnowledgeGraph) -> Vec<ResourceDto> {
    g.resources.values().map(resource_dto).collect()
}

/// Every bridge in the graph as JS DTOs (for drawing labelled edges).
pub fn all_bridge_dtos(g: &KnowledgeGraph) -> Vec<BridgeDto> {
    g.bridges().map(bridge_dto).collect()
}

/// Map a `PlateauNode` to its JS DTO (AC2).
pub fn plateau_dto(p: &PlateauNode) -> PlateauDto {
    let c = p.position().coeffs; // [1, e1, e2, e12, e3, e13, e23, e123]
    PlateauDto {
        id: p.id.to_string(),
        name: p.name.clone(),
        description: p.description.clone(),
        domain_id: p.domain_id.to_string(),
        position: PositionDto {
            e1: c[1],
            e2: c[2],
            e3: c[4],
        },
    }
}

/// JS-facing view of a resource's vote tally (SPEC-0005 §2.2). `weights` maps a
/// wizard-id string to that wizard's grow-only weight; `voters` and
/// `weighted_sum` are the derived totals `CrdtDoc` projects into a graph.
#[derive(serde::Serialize)]
pub struct ResourceVoteDto {
    pub voters: usize,
    pub weighted_sum: f32,
    pub weights: HashMap<String, f32>,
}

/// Map a `ResourceVote` tally to its JS DTO.
pub fn resource_vote_dto(v: &ResourceVote) -> ResourceVoteDto {
    ResourceVoteDto {
        voters: v.voters(),
        weighted_sum: v.weighted_sum(),
        weights: v
            .cells()
            .map(|(wizard, weight)| (wizard.to_string(), *weight))
            .collect(),
    }
}

/// AC4 — the reachable-set query, host-testable against a `KnowledgeGraph`.
pub fn reachable_ids(g: &KnowledgeGraph, json: &str) -> Result<Vec<String>, ReputationParseError> {
    let rep = parse_reputation(json)?;
    Ok(g.reachable_plateaus(&rep)
        .iter()
        .map(|id| id.to_string())
        .collect())
}

/// R-0007 — one row of the graph-grounded retrieval ranking: a plateau and how
/// strongly the reputation projects onto it (the same projection the fog uses).
#[derive(serde::Serialize)]
pub struct NearestDto {
    pub id: String,
    pub name: String,
    pub score: f32,
}

/// R-0007 — top-`k` plateaus nearest the reputation's orientation, ordered by
/// descending projection score. Decodes the same reputation JSON as
/// [`reachable_ids`] and delegates the ranking (GA math) to `mp-graph`; this
/// function only marshals ids/names/scores into DTOs. A ranked id with no
/// matching plateau is skipped (cannot happen for a single consistent graph, but
/// keeps the marshaller total — never emits a row with an empty name).
pub fn nearest_dtos(
    g: &KnowledgeGraph,
    json: &str,
    k: usize,
) -> Result<Vec<NearestDto>, ReputationParseError> {
    let rep = parse_reputation(json)?;
    Ok(g.nearest_plateaus(&rep, k)
        .into_iter()
        .filter_map(|(id, score)| {
            g.plateau(&id).map(|p| NearestDto {
                id: id.to_string(),
                name: p.name.clone(),
                score,
            })
        })
        .collect())
}

/// C1 / R-0039 — read-only view of a saved learning path. Mirrors the native
/// binding's PathDto exactly (`{ id, title, goal, steps, domains }`, ids as
/// strings), so the web and Godot clients render the same shape.
#[derive(serde::Serialize)]
pub struct PathDto {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub steps: Vec<String>,
    pub domains: Vec<String>,
}

/// C1 / R-0039 — shape verified `KIND_PATH` events from a signed log into
/// read-only PathDtos. Only **verified** path events are surfaced (the same
/// trust gate [`recompute_reputation_json`] applies); an unverifiable, non-path,
/// or malformed event contributes nothing rather than erroring — one bad entry
/// never blocks the good ones. Marshalling only, no GA.
pub fn path_dtos(events_json: &str) -> Result<Vec<PathDto>, EventError> {
    let events: Vec<NostrEvent> = serde_json::from_str(events_json)?;
    let mut out = Vec::new();
    for ev in events {
        if ev.kind != KIND_PATH || !mp_identity::verify(&ev) {
            continue;
        }
        let Ok(doc) = serde_json::from_str::<PathDoc>(&ev.content) else {
            continue; // a malformed path payload is skipped, never fatal
        };
        out.push(PathDto {
            id: doc.id.to_string(),
            title: doc.title,
            goal: doc.goal,
            steps: doc.steps.iter().map(|s| s.to_string()).collect(),
            domains: doc.domains.iter().map(|d| d.to_string()).collect(),
        });
    }
    Ok(out)
}

/// AC3 — single-plateau fog query by id string. A malformed id or unknown
/// plateau is an error, never a silent `false`.
pub fn is_reachable_by_id(
    g: &KnowledgeGraph,
    plateau_id: &str,
    json: &str,
) -> Result<bool, QueryError> {
    let pid = Uuid::parse_str(plateau_id).map_err(QueryError::PlateauId)?;
    let plateau = g
        .plateau(&pid)
        .ok_or_else(|| QueryError::UnknownPlateau(plateau_id.to_string()))?;
    let rep = parse_reputation(json)?;
    Ok(g.is_reachable(plateau, &rep))
}

// ─── RFC-0002 Phase 2 (C3) — domain overlap markers ─────────────────────────
//
// Surface the bivector-domain *meet* to the web binding: where two domains'
// fitted planes intersect (`shared_line`) and which plateaus sit on that shared
// island (near BOTH planes within a tolerance). All GA is delegated to the
// `mp_domain` primitives (`domain_plane`/`shared_line`/`membership`,
// RFC-0002 §9 Phase 1); this only gathers each domain's topics and marshals the
// result. Additive, read-side geometry — the projection fog is untouched (§6.4).

/// JS-facing view of the overlap between two domains (RFC-0002 Phase 2).
#[derive(serde::Serialize)]
pub struct OverlapDto {
    /// `true` when the two fitted planes have a non-degenerate meet (not parallel).
    pub has_overlap: bool,
    /// The grade-1 shared line `(e1,e2,e3)` — the meet of the two planes; all-zero
    /// when the planes are parallel / one domain has no topics.
    pub shared_line: PositionDto,
    /// Plateau ids lying on the shared island: near BOTH domain planes within
    /// `tolerance` (the grounded strand of topics the two domains share).
    pub plateaus: Vec<String>,
}

/// Grade-1 coefficients `(e1,e2,e3)` of a multivector — blade order puts e3 at
/// index 4. Shared by [`OverlapDto`]; keeps the marshalling in one place.
fn grade1_position(mv: &Mv) -> PositionDto {
    let c = mv.coeffs;
    PositionDto {
        e1: c[1],
        e2: c[2],
        e3: c[4],
    }
}

/// RFC-0002 Phase 2 (C3) — the overlap between two domains against a graph: the
/// meet line of their fitted planes plus the plateaus on the shared island.
///
/// Each domain's plane is fitted from its member plateaus' grade-1 positions
/// (`domain_plane`); a sparse (<2 topic) domain falls back to `dual` of its first
/// topic (or e1 when it has none) — the R-0038 lens role (RFC-0002 §6.2). A
/// plateau is "on the island" when its out-of-plane fraction (`membership`) is
/// `<= tolerance` for BOTH planes, i.e. it lies near their meet line. A malformed
/// domain UUID is an error, never a silent empty result.
pub fn domain_overlap(
    g: &KnowledgeGraph,
    domain_a: &str,
    domain_b: &str,
    tolerance: f32,
) -> Result<OverlapDto, ReputationParseError> {
    let da = Uuid::parse_str(domain_a)?;
    let db = Uuid::parse_str(domain_b)?;

    let topics_of = |domain: Uuid| -> Vec<&Mv> {
        g.plateaus()
            .filter(|p| p.domain_id == domain)
            .map(|p| p.position())
            .collect()
    };
    let topics_a = topics_of(da);
    let topics_b = topics_of(db);

    // Fallback lens axis for a sparse domain: its first topic, else e1.
    let default_axis = mp_domain::ga::vector(1.0, 0.0, 0.0);
    let fallback_a = topics_a.first().map(|m| **m).unwrap_or(default_axis);
    let fallback_b = topics_b.first().map(|m| **m).unwrap_or(default_axis);

    let plane_a = mp_domain::domain_plane(&topics_a, &fallback_a);
    let plane_b = mp_domain::domain_plane(&topics_b, &fallback_b);

    let has_overlap = mp_domain::has_domain_overlap(&plane_a, &plane_b);
    let shared_line = mp_domain::shared_line(&plane_a, &plane_b);

    // The island: plateaus near BOTH planes (only meaningful when the planes meet).
    let mut plateaus = Vec::new();
    if has_overlap {
        for p in g.plateaus() {
            let v = p.position();
            if mp_domain::membership(v, &plane_a) <= tolerance
                && mp_domain::membership(v, &plane_b) <= tolerance
            {
                plateaus.push(p.id.to_string());
            }
        }
    }

    Ok(OverlapDto {
        has_overlap,
        shared_line: grade1_position(&shared_line),
        plateaus,
    })
}

// ─── SPEC-0010 — signed events → reputation marshalling ──────
//
// All branching/marshalling lives here (host-testable); `lib.rs` only sources
// the wall-clock timestamp and wraps these in `#[wasm_bindgen]`. No GA or crypto
// is performed inline: signing/verification/recompute are delegated to the
// audited `mp-identity` core, which drives the unchanged reputation engine.

/// Emit-side mirror of `ReputationDto`: the exact `{domain_reps, synthesis}`
/// wire shape `parse_reputation` consumes, so recompute output round-trips into
/// `reachable_plateaus`/`nearest_plateaus` unchanged.
#[derive(serde::Serialize)]
struct ReputationOut {
    domain_reps: HashMap<String, [f32; 8]>,
    synthesis: [f32; 8],
}

/// Serialize a `WizardReputation` into reputation wire JSON. Pure
/// value-marshalling — reads `coeffs` and stringifies the domain-id keys; no GA.
pub fn serialize_reputation(rep: &WizardReputation) -> Result<String, EventError> {
    let domain_reps = rep
        .domain_reps
        .iter()
        .map(|(id, mv)| (id.to_string(), mv.coeffs))
        .collect();
    let out = ReputationOut {
        domain_reps,
        synthesis: rep.synthesis.coeffs,
    };
    Ok(serde_json::to_string(&out)?)
}

/// SPEC-0010 AC3/AC4 — recompute a single wizard's reputation from a JSON array
/// of events, returning the `{domain_reps, synthesis}` JSON the fog queries
/// already consume. A pubkey absent from the verified log yields an **empty**
/// reputation (reaches nothing — no free seed).
pub fn recompute_reputation_json(events_json: &str, pubkey: &str) -> Result<String, EventError> {
    let events: Vec<NostrEvent> = serde_json::from_str(events_json)?;
    let reps = mp_identity::recompute(&events);
    let empty;
    let rep = match reps.get(pubkey) {
        Some(r) => r,
        None => {
            empty = WizardReputation::new(mp_identity::wizard_id_of(pubkey));
            &empty
        }
    };
    serialize_reputation(rep)
}

/// One discovery row: a wizard and the reach their verified traversal history
/// earns in the queried domain.
#[derive(serde::Serialize)]
pub struct RankEntryDto {
    pub pubkey: String,
    pub reach: f32,
}

/// SPEC-0010 AC7 — top-`k` traversers in `domain`, ranked from verified events.
pub fn rank_wizards_entries(
    events_json: &str,
    domain: &str,
    k: usize,
) -> Result<Vec<RankEntryDto>, EventError> {
    let events: Vec<NostrEvent> = serde_json::from_str(events_json)?;
    let domain_id = Uuid::parse_str(domain)?;
    Ok(mp_identity::rank_by_domain(&events, domain_id, k)
        .into_iter()
        .map(|(pubkey, reach)| RankEntryDto { pubkey, reach })
        .collect())
}

/// SPEC-0010 AC2 — sign a traversal event, returning its NostrEvent JSON. The
/// content is self-contained (`{domain, e1,e2,e3, depth, plateau?}`).
pub fn sign_traversal_json(
    kp: &Keypair,
    domain: &str,
    position: [f32; 3],
    depth: f32,
    plateau: Option<String>,
    created_at: u64,
) -> Result<String, EventError> {
    let domain_id = Uuid::parse_str(domain)?;
    let plateau_id = plateau.map(|p| Uuid::parse_str(&p)).transpose()?;
    let content = serde_json::to_string(&Traversal {
        domain: domain_id,
        e1: position[0],
        e2: position[1],
        e3: position[2],
        depth,
        plateau: plateau_id,
    })?;
    let tags = vec![vec!["d".to_string(), domain.to_string()]];
    let event = mp_identity::sign(kp, KIND_TRAVERSAL, tags, &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}

/// R-0030 — sign a mastery event ("I have studied & self-tested this topic"),
/// returning its NostrEvent JSON. Mirrors `sign_traversal_json` but is NOT
/// reputation-bearing: `recompute` ignores `KIND_MASTERY`, so it never changes
/// the GA multivector. Content is self-contained (`{plateau}`).
pub fn sign_mastery_json(
    kp: &Keypair,
    plateau_id: &str,
    created_at: u64,
) -> Result<String, EventError> {
    let plateau = Uuid::parse_str(plateau_id)?;
    let content = serde_json::to_string(&Mastery { plateau })?;
    let event = mp_identity::sign(kp, KIND_MASTERY, vec![], &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}

/// Max proof body bytes embedded in a published event (R-0036) — bounds how much a
/// single proof can bloat the gossiped log; longer bodies are truncated at sign time.
const PROOF_BODY_CAP: usize = 8192;

/// R-0036 — sign a proof/solution artifact event (a shareable completion artifact),
/// returning its NostrEvent JSON. Like `sign_mastery_json` it is NOT
/// reputation-bearing: `recompute` ignores `KIND_PROOF`, so a published proof never
/// changes the GA multivector. `body` is capped at `PROOF_BODY_CAP` bytes.
pub fn sign_proof_json(
    kp: &Keypair,
    plateau_id: &str,
    kind: &str,
    body: &str,
    created_at: u64,
) -> Result<String, EventError> {
    let plateau = Uuid::parse_str(plateau_id)?;
    let body = if body.len() > PROOF_BODY_CAP {
        // truncate on a char boundary at or below the cap (never split a UTF-8 codepoint)
        let mut end = PROOF_BODY_CAP;
        while end > 0 && !body.is_char_boundary(end) {
            end -= 1;
        }
        body[..end].to_string()
    } else {
        body.to_string()
    };
    let content = serde_json::to_string(&Proof {
        plateau,
        kind: kind.to_string(),
        body,
    })?;
    let event = mp_identity::sign(kp, KIND_PROOF, vec![], &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}

/// R-0039 — sign a learning path event (a shareable artifact), returning its NostrEvent JSON.
/// Like `sign_mastery_json`, it is NOT reputation-bearing: `recompute` ignores `KIND_PATH`.
pub fn sign_path_json(
    kp: &Keypair,
    path_id: &str,
    title: &str,
    goal: &str,
    steps: &[String],
    domains: &[String],
    created_at: u64,
) -> Result<String, EventError> {
    let id = Uuid::parse_str(path_id)?;
    let parsed_steps: Result<Vec<Uuid>, _> = steps.iter().map(|s| Uuid::parse_str(s)).collect();
    let parsed_domains: Result<Vec<Uuid>, _> = domains.iter().map(|s| Uuid::parse_str(s)).collect();
    let content = serde_json::to_string(&PathDoc {
        id,
        title: title.to_string(),
        goal: goal.to_string(),
        steps: parsed_steps?,
        domains: parsed_domains?,
    })?;
    let event = mp_identity::sign(kp, KIND_PATH, vec![], &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}

/// SPEC-0010 AC2/AC5 — sign a vouch event for `vouched_pubkey`, returning its
/// NostrEvent JSON. `from`/`to` are the grade-1 endpoints the recompute rebuilds
/// the even-grade bridge rotor from (the only public Bridge path).
pub fn sign_vouch_json(
    kp: &Keypair,
    domain: &str,
    vouched_pubkey: &str,
    from: &[f32],
    to: &[f32],
    created_at: u64,
) -> Result<String, EventError> {
    let domain_id = Uuid::parse_str(domain)?;
    let triple = |s: &[f32]| {
        [
            s.first().copied().unwrap_or(0.0),
            s.get(1).copied().unwrap_or(0.0),
            s.get(2).copied().unwrap_or(0.0),
        ]
    };
    let content = serde_json::to_string(&Vouch {
        domain: domain_id,
        vouched: vouched_pubkey.to_string(),
        from: triple(from),
        to: triple(to),
    })?;
    let tags = vec![vec!["d".to_string(), domain.to_string()]];
    let event = mp_identity::sign(kp, KIND_VOUCH, tags, &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use mp_domain::ga;

    // ── helpers ──────────────────────────────────────────────

    /// A reputation JSON with a single domain whose rep is `depth · position`.
    fn rep_json(domain: Uuid, e1: f32, e2: f32, e3: f32) -> String {
        format!(
            r#"{{ "domain_reps": {{ "{domain}": [0.0, {e1}, {e2}, 0.0, {e3}, 0.0, 0.0, 0.0] }} }}"#
        )
    }

    /// A two-plateau graph in one domain. Plateau A sits on e1, B on e3.
    fn two_plateau_graph(domain: Uuid) -> (KnowledgeGraph, Uuid, Uuid) {
        let mut g = KnowledgeGraph::new();
        let a = PlateauNode::new("A", domain, 1.0, 0.0, 0.0);
        let b = PlateauNode::new("B", domain, 0.0, 0.0, 1.0);
        let (ai, bi) = (a.id, b.id);
        g.add_plateau(a);
        g.add_plateau(b);
        (g, ai, bi)
    }

    // ── AC2 — plateau_dto position mapping ───────────────────

    #[test]
    fn plateau_dto_maps_position() {
        let p = PlateauNode::new("Linear Algebra", Uuid::new_v4(), 0.9, 0.2, 0.5)
            .with_description("vectors and transforms");
        let dto = plateau_dto(&p);
        assert_eq!(dto.id, p.id.to_string());
        assert_eq!(dto.name, "Linear Algebra");
        assert_eq!(dto.description, "vectors and transforms");
        // e1/e2/e3 are the Grade-1 coeffs — index 3 (e12) must NOT leak in.
        assert!((dto.position.e1 - 0.9).abs() < ga::EPSILON);
        assert!((dto.position.e2 - 0.2).abs() < ga::EPSILON);
        assert!((dto.position.e3 - 0.5).abs() < ga::EPSILON);
    }

    // ── AC5 — parse_reputation round-trip ────────────────────

    #[test]
    fn parse_reputation_roundtrip() {
        let d1 = Uuid::new_v4();
        let d2 = Uuid::new_v4();
        let json = format!(
            r#"{{
                "domain_reps": {{
                    "{d1}": [0.0, 1.0, 2.0, 0.0, 3.0, 0.0, 0.0, 0.0],
                    "{d2}": [0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
                }},
                "synthesis": [0.0, 0.0, 0.0, 4.0, 0.0, 0.0, 0.0, 0.0]
            }}"#
        );
        let rep = parse_reputation(&json).expect("valid reputation JSON");
        // Field-wise on coeffs (Mv has no PartialEq; wizard_id is lossy nil).
        assert_eq!(rep.domain_reps.len(), 2);
        assert_eq!(
            rep.domain_reps[&d1].coeffs,
            [0.0, 1.0, 2.0, 0.0, 3.0, 0.0, 0.0, 0.0]
        );
        assert_eq!(
            rep.domain_reps[&d2].coeffs,
            [0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        );
        assert_eq!(
            rep.synthesis.coeffs,
            [0.0, 0.0, 0.0, 4.0, 0.0, 0.0, 0.0, 0.0]
        );
    }

    #[test]
    fn parse_reputation_rejects_bad_uuid() {
        let json = r#"{ "domain_reps": { "not-a-uuid": [0,0,0,0,0,0,0,0] } }"#;
        assert!(matches!(
            parse_reputation(json),
            Err(ReputationParseError::DomainId(_))
        ));
    }

    #[test]
    fn parse_reputation_rejects_bad_json() {
        assert!(matches!(
            parse_reputation("{ not json"),
            Err(ReputationParseError::Json(_))
        ));
    }

    #[test]
    fn parse_reputation_defaults_empty() {
        let rep = parse_reputation("{}").expect("empty object is valid");
        assert!(rep.domain_reps.is_empty());
        assert_eq!(rep.synthesis.coeffs, [0.0; 8]);
    }

    /// AC5 — a scalar-only reputation reaches nothing (Sybil/fog preserved).
    #[test]
    fn scalar_only_reputation_reaches_nothing() {
        let domain = Uuid::new_v4();
        let (g, _, _) = two_plateau_graph(domain);
        let json = format!(
            r#"{{ "domain_reps": {{ "{domain}": [1000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
        );
        let reachable = reachable_ids(&g, &json).expect("valid json");
        assert!(
            reachable.is_empty(),
            "a huge scalar-only reputation must still see only fog"
        );
    }

    // ── AC4 — reachable_ids matches the graph ────────────────

    #[test]
    fn reachable_ids_matches_graph() {
        let domain = Uuid::new_v4();
        let (g, a_id, b_id) = two_plateau_graph(domain);
        // Reputation aligned with A (e1) and strong enough to clear threshold.
        let json = rep_json(domain, 1.0, 0.0, 0.0);
        let reachable = reachable_ids(&g, &json).expect("valid json");
        assert!(reachable.contains(&a_id.to_string()), "A faces the rep");
        assert!(
            !reachable.contains(&b_id.to_string()),
            "B (e3) is orthogonal to an e1 rep — fogged"
        );
        // Same membership the graph itself reports.
        let rep = parse_reputation(&json).unwrap();
        let direct: Vec<String> = g
            .reachable_plateaus(&rep)
            .iter()
            .map(|id| id.to_string())
            .collect();
        let mut got = reachable.clone();
        let mut want = direct.clone();
        got.sort();
        want.sort();
        assert_eq!(got, want);
    }

    // ── R-0007 — nearest_dtos retrieval ranking ──────────────

    #[test]
    fn nearest_dtos_ranks_and_truncates() {
        let domain = Uuid::new_v4();
        let (g, a_id, b_id) = two_plateau_graph(domain);
        // Reputation faces A (e1): A ranks above B (e3).
        let json = rep_json(domain, 1.0, 0.0, 0.0);

        let rows = nearest_dtos(&g, &json, 10).expect("valid json");
        assert_eq!(rows.len(), 2, "both plateaus ranked (no threshold)");
        assert_eq!(rows[0].id, a_id.to_string(), "A (e1) is nearest");
        assert_eq!(rows[0].name, "A");
        assert!(rows[0].score >= rows[1].score, "descending by score");
        assert_eq!(rows[1].id, b_id.to_string());

        // k truncates to the top of the ranking.
        let top1 = nearest_dtos(&g, &json, 1).expect("valid json");
        assert_eq!(top1.len(), 1);
        assert_eq!(top1[0].id, a_id.to_string());
    }

    #[test]
    fn nearest_dtos_rejects_bad_json() {
        let domain = Uuid::new_v4();
        let (g, _, _) = two_plateau_graph(domain);
        assert!(matches!(
            nearest_dtos(&g, "{ broken", 5),
            Err(ReputationParseError::Json(_))
        ));
    }

    // ── RFC-0002 Phase 2 (C3) — domain overlap markers ───────

    /// Two domains whose fitted planes are e12 (Math on e1,e2) and e23 (Physics
    /// on e2,e3) meet on the e2 axis; the shared island is exactly the two topics
    /// that sit on e2, not the off-axis ones.
    #[test]
    fn domain_overlap_finds_meet_line_and_island() {
        let dm = Uuid::new_v4();
        let dp = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        let a = PlateauNode::new("A", dm, 1.0, 0.0, 0.0); // e1
        let b = PlateauNode::new("B", dm, 0.0, 1.0, 0.0); // e2 (shared axis)
        let c = PlateauNode::new("C", dp, 0.0, 1.0, 0.0); // e2 (shared axis)
        let d = PlateauNode::new("D", dp, 0.0, 0.0, 1.0); // e3
        let (a_id, b_id, c_id, d_id) = (a.id, b.id, c.id, d.id);
        g.add_plateau(a);
        g.add_plateau(b);
        g.add_plateau(c);
        g.add_plateau(d);

        let dto =
            domain_overlap(&g, &dm.to_string(), &dp.to_string(), mp_domain::MEMBERSHIP_TOLERANCE)
                .expect("overlap");
        assert!(dto.has_overlap, "e12 and e23 planes meet on e2");
        // The meet line is (approximately) the e2 axis.
        assert!(dto.shared_line.e2.abs() > ga::EPSILON);
        assert!(dto.shared_line.e1.abs() < ga::EPSILON);
        assert!(dto.shared_line.e3.abs() < ga::EPSILON);
        // The island is exactly the two e2 topics (B, C), not the off-axis ones.
        let mut got = dto.plateaus.clone();
        got.sort();
        let mut want = vec![b_id.to_string(), c_id.to_string()];
        want.sort();
        assert_eq!(got, want);
        assert!(!dto.plateaus.contains(&a_id.to_string()));
        assert!(!dto.plateaus.contains(&d_id.to_string()));
    }

    #[test]
    fn domain_overlap_none_for_parallel_domains() {
        let d1 = Uuid::new_v4();
        let d2 = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        // Both domains lie in the e1–e2 plane ⇒ parallel planes, no meaningful meet.
        g.add_plateau(PlateauNode::new("A", d1, 1.0, 0.0, 0.0));
        g.add_plateau(PlateauNode::new("B", d1, 0.0, 1.0, 0.0));
        g.add_plateau(PlateauNode::new("C", d2, 0.9, 0.1, 0.0));
        g.add_plateau(PlateauNode::new("D", d2, 0.8, 0.2, 0.0));
        let dto =
            domain_overlap(&g, &d1.to_string(), &d2.to_string(), mp_domain::MEMBERSHIP_TOLERANCE)
                .expect("overlap");
        assert!(!dto.has_overlap, "parallel planes have no meet");
        assert!(dto.plateaus.is_empty(), "no island without a meet");
    }

    #[test]
    fn domain_overlap_dto_shape() {
        let dm = Uuid::new_v4();
        let dp = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        g.add_plateau(PlateauNode::new("A", dm, 1.0, 0.0, 0.0));
        g.add_plateau(PlateauNode::new("B", dm, 0.0, 1.0, 0.0));
        g.add_plateau(PlateauNode::new("C", dp, 0.0, 1.0, 0.0));
        g.add_plateau(PlateauNode::new("D", dp, 0.0, 0.0, 1.0));
        let dto =
            domain_overlap(&g, &dm.to_string(), &dp.to_string(), mp_domain::MEMBERSHIP_TOLERANCE)
                .unwrap();
        let v = serde_json::to_value(dto).unwrap();
        let obj = v.as_object().unwrap();
        let mut keys: Vec<String> = obj.keys().cloned().collect();
        keys.sort();
        assert_eq!(keys, ["has_overlap", "plateaus", "shared_line"]);
        let sl = obj["shared_line"].as_object().expect("shared_line object");
        let mut sk: Vec<String> = sl.keys().cloned().collect();
        sk.sort();
        assert_eq!(sk, ["e1", "e2", "e3"]);
    }

    #[test]
    fn domain_overlap_rejects_bad_uuid() {
        let g = KnowledgeGraph::new();
        assert!(matches!(
            domain_overlap(&g, "not-a-uuid", &Uuid::new_v4().to_string(), 0.35),
            Err(ReputationParseError::DomainId(_))
        ));
    }

    // ── AC3 — is_reachable_by_id ─────────────────────────────

    #[test]
    fn is_reachable_by_id_matches_graph() {
        let domain = Uuid::new_v4();
        let (g, a_id, b_id) = two_plateau_graph(domain);
        let json = rep_json(domain, 1.0, 0.0, 0.0);
        assert!(is_reachable_by_id(&g, &a_id.to_string(), &json).unwrap());
        assert!(!is_reachable_by_id(&g, &b_id.to_string(), &json).unwrap());
    }

    #[test]
    fn is_reachable_unknown_plateau_errors() {
        let domain = Uuid::new_v4();
        let (g, _, _) = two_plateau_graph(domain);
        let unknown = Uuid::new_v4().to_string();
        let json = rep_json(domain, 1.0, 0.0, 0.0);
        assert!(matches!(
            is_reachable_by_id(&g, &unknown, &json),
            Err(QueryError::UnknownPlateau(_))
        ));
    }

    #[test]
    fn is_reachable_bad_plateau_id_errors() {
        let domain = Uuid::new_v4();
        let (g, _, _) = two_plateau_graph(domain);
        let json = rep_json(domain, 1.0, 0.0, 0.0);
        assert!(matches!(
            is_reachable_by_id(&g, "not-a-uuid", &json),
            Err(QueryError::PlateauId(_))
        ));
    }

    #[test]
    fn is_reachable_bad_json_errors() {
        let domain = Uuid::new_v4();
        let (g, a_id, _) = two_plateau_graph(domain);
        assert!(matches!(
            is_reachable_by_id(&g, &a_id.to_string(), "{ broken"),
            Err(QueryError::Reputation(ReputationParseError::Json(_)))
        ));
    }

    // ── SPEC-0010 — signed-event marshalling (host-testable) ─────

    #[test]
    fn serialize_reputation_round_trips_into_parse_reputation() {
        // A recompute output must decode back through the SAME path the fog
        // queries use, so reachability is untouched by the seed→earned switch.
        let domain = Uuid::new_v4();
        let mut rep = WizardReputation::new(Uuid::nil());
        rep.domain_reps.insert(domain, ga::vector(0.9, 0.1, 0.0));

        let json = serialize_reputation(&rep).expect("serialize");
        let back = parse_reputation(&json).expect("parse round-trip");

        let got = back.domain_reps.get(&domain).expect("domain present");
        for (x, y) in got
            .coeffs
            .iter()
            .zip(ga::vector(0.9, 0.1, 0.0).coeffs.iter())
        {
            assert!((x - y).abs() < ga::EPSILON);
        }
    }

    #[test]
    fn recompute_reputation_json_empty_for_unknown_pubkey() {
        // No events ⇒ the queried pubkey reaches nothing (no free seed), but the
        // JSON is still well-formed and parses to an empty reputation.
        let json = recompute_reputation_json("[]", &"a".repeat(64)).expect("recompute");
        let rep = parse_reputation(&json).expect("parse");
        assert!(rep.domain_reps.is_empty());
        assert_eq!(ga::dominant_grade(&rep.synthesis), 0);
    }

    #[test]
    fn sign_traversal_then_recompute_lights_a_domain() {
        // End-to-end through the wasm seam (sans wasm): sign → verify → recompute
        // → the same {domain_reps,synthesis} JSON the fog consumes, grade-1 reach.
        let kp = Keypair::generate();
        let domain = Uuid::new_v4();
        let event_json =
            sign_traversal_json(&kp, &domain.to_string(), [0.9, 0.1, 0.0], 1.0, None, 1)
                .expect("sign");
        assert!(crate::verify_event(&event_json), "signed event verifies");

        let log = format!("[{event_json}]");
        let rep_json = recompute_reputation_json(&log, &kp.pubkey_hex()).expect("recompute");
        let rep = parse_reputation(&rep_json).expect("parse");

        let mv = rep.domain_reps.get(&domain).expect("domain lit");
        assert_eq!(ga::dominant_grade(mv), 1);
    }

    #[test]
    fn rank_wizards_entries_orders_by_reach() {
        let domain = Uuid::new_v4();
        let deep = Keypair::generate();
        let shallow = Keypair::generate();
        let e1 =
            sign_traversal_json(&deep, &domain.to_string(), [1.0, 0.0, 0.0], 5.0, None, 1).unwrap();
        let e2 = sign_traversal_json(&shallow, &domain.to_string(), [1.0, 0.0, 0.0], 1.0, None, 2)
            .unwrap();
        let log = format!("[{e1},{e2}]");

        let ranked = rank_wizards_entries(&log, &domain.to_string(), 10).expect("rank");
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].pubkey, deep.pubkey_hex());
        assert!(ranked[0].reach > ranked[1].reach);
    }

    #[test]
    fn mastery_signs_verifies_and_leaves_reputation_untouched() {
        // R-0030 AC2/AC4/AC6: a mastery event is a real signed event (verifies,
        // kind 30080, content {plateau}), but `recompute` ignores KIND_MASTERY,
        // so reputation is byte-identical with vs. without it — even over a log
        // that includes a vouch (recompute's order-sensitive phase).
        let kp = Keypair::generate();
        let other = Keypair::generate();
        let domain = Uuid::new_v4();
        let plateau = Uuid::new_v4();

        let trav =
            sign_traversal_json(&kp, &domain.to_string(), [0.9, 0.1, 0.0], 1.0, None, 1).unwrap();
        let vouch = sign_vouch_json(
            &kp,
            &domain.to_string(),
            &other.pubkey_hex(),
            &[1.0, 0.0, 0.0],
            &[0.0, 0.0, 1.0],
            2,
        )
        .unwrap();
        let mastery = sign_mastery_json(&kp, &plateau.to_string(), 3).unwrap();

        // The mastery event is well-formed, verifiable, kind 30080, content {plateau}.
        assert!(crate::verify_event(&mastery), "mastery verifies");
        assert_eq!(crate::mastery_kind(), KIND_MASTERY);
        let ev: NostrEvent = serde_json::from_str(&mastery).unwrap();
        assert_eq!(ev.kind, KIND_MASTERY);
        let m: Mastery = serde_json::from_str(&ev.content).unwrap();
        assert_eq!(m.plateau, plateau);

        // Reputation identical with vs. without the mastery event in the log.
        let without = format!("[{trav},{vouch}]");
        let with = format!("[{trav},{vouch},{mastery}]");
        let rep_without = recompute_reputation_json(&without, &kp.pubkey_hex()).unwrap();
        let rep_with = recompute_reputation_json(&with, &kp.pubkey_hex()).unwrap();
        assert_eq!(rep_without, rep_with, "mastery must not change reputation");
    }

    #[test]
    fn proof_signs_verifies_and_leaves_reputation_untouched() {
        // R-0036 AC2/AC4: a published proof is a real signed event (verifies, kind
        // 30081, content {plateau,kind,body}), but `recompute` ignores KIND_PROOF, so
        // reputation is byte-identical with vs. without it — over a log that includes a
        // traversal AND a vouch (recompute's order-sensitive phase).
        let kp = Keypair::generate();
        let other = Keypair::generate();
        let domain = Uuid::new_v4();
        let plateau = Uuid::new_v4();

        let trav =
            sign_traversal_json(&kp, &domain.to_string(), [0.9, 0.1, 0.0], 1.0, None, 1).unwrap();
        let vouch = sign_vouch_json(
            &kp,
            &domain.to_string(),
            &other.pubkey_hex(),
            &[1.0, 0.0, 0.0],
            &[0.0, 0.0, 1.0],
            2,
        )
        .unwrap();
        let proof =
            sign_proof_json(&kp, &plateau.to_string(), "proof", "By induction, QED.", 3).unwrap();

        // Well-formed, verifiable, kind 30081, content {plateau, kind, body}.
        assert!(crate::verify_event(&proof), "proof verifies");
        assert_eq!(crate::proof_kind(), KIND_PROOF);
        let ev: NostrEvent = serde_json::from_str(&proof).unwrap();
        assert_eq!(ev.kind, KIND_PROOF);
        let p: Proof = serde_json::from_str(&ev.content).unwrap();
        assert_eq!(p.plateau, plateau);
        assert_eq!(p.kind, "proof");
        assert_eq!(p.body, "By induction, QED.");

        // Reputation byte-identical with vs. without the proof event in the log.
        let without = format!("[{trav},{vouch}]");
        let with = format!("[{trav},{vouch},{proof}]");
        let rep_without = recompute_reputation_json(&without, &kp.pubkey_hex()).unwrap();
        let rep_with = recompute_reputation_json(&with, &kp.pubkey_hex()).unwrap();
        assert_eq!(rep_without, rep_with, "proof must not change reputation");
    }

    #[test]
    fn path_signs_verifies_and_leaves_reputation_untouched() {
        // R-0039: a path is a real signed event (verifies, kind 30082, content PathDoc),
        // but `recompute` ignores KIND_PATH, so reputation is byte-identical with vs. without it.
        let kp = Keypair::generate();
        let other = Keypair::generate();
        let domain = Uuid::new_v4();
        let path_id = Uuid::new_v4();
        let step1 = Uuid::new_v4();

        let trav =
            sign_traversal_json(&kp, &domain.to_string(), [0.9, 0.1, 0.0], 1.0, None, 1).unwrap();
        let vouch = sign_vouch_json(
            &kp,
            &domain.to_string(),
            &other.pubkey_hex(),
            &[1.0, 0.0, 0.0],
            &[0.0, 0.0, 1.0],
            2,
        )
        .unwrap();
        let path = sign_path_json(
            &kp,
            &path_id.to_string(),
            "Path to Mastery",
            "Learn things",
            &[step1.to_string()],
            &[domain.to_string()],
            3,
        ).unwrap();

        assert!(crate::verify_event(&path), "path verifies");
        let ev: NostrEvent = serde_json::from_str(&path).unwrap();
        assert_eq!(ev.kind, KIND_PATH);
        let p: PathDoc = serde_json::from_str(&ev.content).unwrap();
        assert_eq!(p.id, path_id);
        assert_eq!(p.title, "Path to Mastery");

        let without = format!("[{trav},{vouch}]");
        let with = format!("[{trav},{vouch},{path}]");
        let rep_without = recompute_reputation_json(&without, &kp.pubkey_hex()).unwrap();
        let rep_with = recompute_reputation_json(&with, &kp.pubkey_hex()).unwrap();
        assert_eq!(rep_without, rep_with, "path must not change reputation");
    }

    // ── C1 / R-0039 — path_dtos (read-only paths from the signed log) ────

    #[test]
    fn path_dtos_surfaces_verified_paths_and_skips_the_rest() {
        let kp = Keypair::generate();
        let path_id = Uuid::new_v4();
        let step = Uuid::new_v4();
        let domain = Uuid::new_v4();
        let path = sign_path_json(
            &kp,
            &path_id.to_string(),
            "Path to Mastery",
            "Learn things",
            &[step.to_string()],
            &[domain.to_string()],
            1,
        )
        .unwrap();
        // A non-path event (traversal) and a tampered path must be ignored.
        let trav =
            sign_traversal_json(&kp, &domain.to_string(), [0.9, 0.1, 0.0], 1.0, None, 2).unwrap();
        let mut tampered: NostrEvent = serde_json::from_str(&path).unwrap();
        tampered.content = tampered.content.replace("Mastery", "Forgery");
        let tampered = serde_json::to_string(&tampered).unwrap();

        let log = format!("[{path},{trav},{tampered}]");
        let dtos = path_dtos(&log).expect("parse");
        assert_eq!(dtos.len(), 1, "only the verified path survives");
        assert_eq!(dtos[0].id, path_id.to_string());
        assert_eq!(dtos[0].title, "Path to Mastery");
        assert_eq!(dtos[0].steps, vec![step.to_string()]);
        assert_eq!(dtos[0].domains, vec![domain.to_string()]);
    }

    #[test]
    fn path_dtos_shape_matches_the_contract() {
        let kp = Keypair::generate();
        let path = sign_path_json(
            &kp,
            &Uuid::new_v4().to_string(),
            "T",
            "G",
            &[Uuid::new_v4().to_string()],
            &[Uuid::new_v4().to_string()],
            1,
        )
        .unwrap();
        let v = serde_json::to_value(path_dtos(&format!("[{path}]")).unwrap()).unwrap();
        let obj = v[0].as_object().expect("object");
        let mut keys: Vec<String> = obj.keys().cloned().collect();
        keys.sort();
        assert_eq!(keys, ["domains", "goal", "id", "steps", "title"]);
    }

    #[test]
    fn path_dtos_rejects_malformed_log() {
        assert!(matches!(
            path_dtos("{ not an array"),
            Err(EventError::Json(_))
        ));
    }

    #[test]
    fn proof_body_is_capped() {
        // R-0036: an over-long body is truncated at sign time so it can't bloat the log.
        let kp = Keypair::generate();
        let plateau = Uuid::new_v4();
        let huge = "x".repeat(20_000);
        let proof = sign_proof_json(&kp, &plateau.to_string(), "solution", &huge, 1).unwrap();
        let ev: NostrEvent = serde_json::from_str(&proof).unwrap();
        let p: Proof = serde_json::from_str(&ev.content).unwrap();
        assert!(p.body.len() <= 8192, "body capped at 8 KB");
        assert!(crate::verify_event(&proof), "capped proof still verifies");
    }

    #[test]
    fn recompute_reputation_json_rejects_malformed_log() {
        assert!(matches!(
            recompute_reputation_json("{ not an array", &"a".repeat(64)),
            Err(EventError::Json(_))
        ));
    }
}
