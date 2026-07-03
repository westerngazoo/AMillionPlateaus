//! Reputation JSON → fog queries (R-0025 / SPEC-0025 §2.2).
//!
//! Re-derives the same `{domain_reps, synthesis}` wire shape `mp-wasm` consumes —
//! never depends on `mp-wasm`. All GA math stays in `mp-domain`.

use std::collections::HashMap;

use mp_domain::ga::Mv;
use mp_domain::{KnowledgeGraph, WizardReputation};
use uuid::Uuid;

use crate::dto::NearestDto;

/// Failure decoding `wizard_rep_json`.
#[derive(thiserror::Error, Debug)]
pub enum ReputationParseError {
    #[error("reputation JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
    #[error("domain id is not a valid UUID: {0}")]
    DomainId(#[from] uuid::Error),
}

/// Wire shape of `wizard_rep_json` (SPEC-0003 §Reputation DTO).
#[derive(serde::Deserialize)]
struct ReputationDto {
    #[serde(default)]
    domain_reps: HashMap<String, [f32; 8]>,
    #[serde(default)]
    synthesis: [f32; 8],
}

/// Decode reputation JSON into a `WizardReputation` (parity with `mp-wasm` convert).
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

/// Reachable plateau ids for a reputation JSON string.
pub fn reachable_ids(g: &KnowledgeGraph, json: &str) -> Result<Vec<String>, ReputationParseError> {
    let rep = parse_reputation(json)?;
    Ok(g.reachable_plateaus(&rep)
        .iter()
        .map(|id| id.to_string())
        .collect())
}

/// Top-`k` plateaus nearest a reputation JSON's orientation, ordered by
/// descending projection score (C6 / R-0007) — the retrieval mirror of
/// `mp-wasm`'s `nearest_dtos`. The GA ranking is delegated to `mp-domain`
/// (`KnowledgeGraph::nearest_plateaus`); this only decodes the same reputation
/// JSON `reachable_ids` consumes and marshals ids/names/scores into DTOs. A
/// ranked id with no matching plateau is skipped (keeps the marshaller total —
/// never a row with an empty name).
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

#[cfg(test)]
mod tests {
    use super::*;
    use mp_domain::PlateauNode;

    #[test]
    fn reachable_matches_graph() {
        let domain = Uuid::new_v4();
        let a = PlateauNode::new("A", domain, 0.95, 0.1, 0.0);
        let b = PlateauNode::new("B", domain, 0.1, 0.1, 0.9);
        let mut g = KnowledgeGraph::new();
        g.add_plateau(a.clone());
        g.add_plateau(b.clone());
        let json = format!(
            r#"{{ "domain_reps": {{ "{domain}": [0.0, 0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
        );
        let ids = reachable_ids(&g, &json).expect("reachable");
        assert!(ids.contains(&a.id.to_string()));
        assert!(!ids.contains(&b.id.to_string()));
    }

    #[test]
    fn empty_reputation_reaches_nothing() {
        let domain = Uuid::new_v4();
        let p = PlateauNode::new("P", domain, 0.9, 0.1, 0.0);
        let mut g = KnowledgeGraph::new();
        g.add_plateau(p);
        let ids = reachable_ids(&g, "{}").expect("reachable");
        assert!(ids.is_empty());
    }

    // ── C6 / R-0007 — nearest_dtos retrieval ranking ─────────

    #[test]
    fn nearest_dtos_ranks_and_truncates() {
        let domain = Uuid::new_v4();
        let a = PlateauNode::new("A", domain, 1.0, 0.0, 0.0);
        let b = PlateauNode::new("B", domain, 0.0, 0.0, 1.0);
        let (a_id, b_id) = (a.id, b.id);
        let mut g = KnowledgeGraph::new();
        g.add_plateau(a);
        g.add_plateau(b);
        // A reputation facing e1 ranks A above B (both returned — no threshold).
        let json = format!(
            r#"{{ "domain_reps": {{ "{domain}": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }} }}"#
        );
        let rows = nearest_dtos(&g, &json, 10).expect("nearest");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].id, a_id.to_string(), "A (e1) is nearest");
        assert_eq!(rows[0].name, "A");
        assert!(rows[0].score >= rows[1].score, "descending by score");
        assert_eq!(rows[1].id, b_id.to_string());

        // k truncates to the top of the ranking.
        let top1 = nearest_dtos(&g, &json, 1).expect("nearest");
        assert_eq!(top1.len(), 1);
        assert_eq!(top1[0].id, a_id.to_string());
    }

    #[test]
    fn nearest_dtos_rejects_bad_json() {
        let g = KnowledgeGraph::new();
        assert!(matches!(
            nearest_dtos(&g, "{ broken", 5),
            Err(ReputationParseError::Json(_))
        ));
    }
}
