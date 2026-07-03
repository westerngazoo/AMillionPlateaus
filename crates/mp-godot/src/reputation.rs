//! Reputation JSON → fog queries (R-0025 / SPEC-0025 §2.2).
//!
//! Re-derives the same `{domain_reps, synthesis}` wire shape `mp-wasm` consumes —
//! never depends on `mp-wasm`. All GA math stays in `mp-domain`.

use std::collections::HashMap;

use mp_domain::ga::Mv;
use mp_domain::{KnowledgeGraph, WizardReputation};
use uuid::Uuid;

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
        g.add_plateau(a.clone()).expect("add");
        g.add_plateau(b.clone()).expect("add");
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
        g.add_plateau(p).expect("add");
        let ids = reachable_ids(&g, "{}").expect("reachable");
        assert!(ids.is_empty());
    }
}
