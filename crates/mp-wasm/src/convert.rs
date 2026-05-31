//! Pure, host-testable marshalling between the JS boundary and `mp-graph`.
//!
//! Everything with branching logic — UUID parsing, JSON decoding, DTO building,
//! the reachability queries — lives here as plain functions over `mp_graph`
//! types, exercised by `cargo test --workspace` on the host (SPEC-0003 §2). No
//! `#[wasm_bindgen]` appears in this file; `lib.rs` is the binding skin.
//!
//! This module performs **no** geometric-algebra computation. Building
//! `Mv { coeffs }` from a decoded array is value-marshalling — `coeffs` is a
//! public field on garust's `Vga3f`. All GA math (projection, reachability)
//! stays in `mp-graph`.

use std::collections::HashMap;

use mp_graph::ga::Mv;
use mp_graph::{KnowledgeGraph, PlateauNode, WizardReputation};
use uuid::Uuid;

use crate::error::{QueryError, ReputationParseError};

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

/// JS-facing view of a plateau (AC2).
#[derive(serde::Serialize)]
pub struct PlateauDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub position: PositionDto,
}

/// Map a `PlateauNode` to its JS DTO (AC2).
pub fn plateau_dto(p: &PlateauNode) -> PlateauDto {
    let c = p.position().coeffs; // [1, e1, e2, e12, e3, e13, e23, e123]
    PlateauDto {
        id: p.id.to_string(),
        name: p.name.clone(),
        description: p.description.clone(),
        position: PositionDto {
            e1: c[1],
            e2: c[2],
            e3: c[4],
        },
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

#[cfg(test)]
mod tests {
    use super::*;
    use mp_graph::ga;

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
}
