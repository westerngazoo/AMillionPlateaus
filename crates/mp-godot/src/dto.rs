//! The JS/GDScript-facing DTO shapes for the immersive client (R-0025 / SPEC-0025
//! §2.2). These are **re-derived from `mp-domain` types here**, NOT imported from
//! `mp-wasm` — `convert.rs`'s DTOs are private to that binding, and a
//! binding→binding edge would invert the topology (§2.1 decision log). Equivalence
//! with the web binding is guaranteed **structurally by the parity test**
//! (`graph_source.rs`), not by shared struct identity. No GA here: `position` is
//! value-marshalled from the plateau's grade-1 coefficients, exactly as `mp-wasm` does.

use mp_domain::{Bridge, PlateauNode, Resource, ResourceKind, ResourceState};
use mp_identity::{verify, NostrEvent, PathDoc, KIND_PATH};

#[derive(serde::Serialize)]
pub struct PositionDto {
    pub e1: f32,
    pub e2: f32,
    pub e3: f32,
}

#[derive(serde::Serialize)]
pub struct PlateauDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub domain_id: String,
    pub position: PositionDto,
}

#[derive(serde::Serialize)]
pub struct BridgeDto {
    pub id: String,
    pub from: String,
    pub to: String,
    pub concept: String,
}

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

#[derive(serde::Serialize)]
pub struct PathDto {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub steps: Vec<String>,
    pub domains: Vec<String>,
}

pub fn path_dto(id: &str, title: &str, goal: &str, steps: &[String], domains: &[String]) -> PathDto {
    PathDto {
        id: id.to_string(),
        title: title.to_string(),
        goal: goal.to_string(),
        steps: steps.to_vec(),
        domains: domains.to_vec(),
    }
}

/// Shape a signed event log into read-only Path DTOs (C1 / R-0039). Paths are
/// `KIND_PATH` signed artifacts (never in the CRDT — CLAUDE.md §7), so they are
/// sourced from the same event log the client already holds, NOT from the doc.
/// Only **verified** path events are surfaced (the same trust gate
/// [`mp_identity::recompute`] applies); an unverifiable, non-path, or malformed
/// event contributes nothing rather than erroring — one bad entry never blocks
/// the good ones. The emitted shape is identical to `mp-wasm`'s path DTO
/// (`{ id, title, goal, steps, domains }`, ids marshalled to strings).
pub fn path_dtos_from_events(events_json: &str) -> Result<Vec<PathDto>, serde_json::Error> {
    let events: Vec<NostrEvent> = serde_json::from_str(events_json)?;
    let mut out = Vec::new();
    for ev in events {
        if ev.kind != KIND_PATH || !verify(&ev) {
            continue;
        }
        let Ok(doc) = serde_json::from_str::<PathDoc>(&ev.content) else {
            continue; // a malformed path payload is skipped, never fatal
        };
        let steps: Vec<String> = doc.steps.iter().map(|s| s.to_string()).collect();
        let domains: Vec<String> = doc.domains.iter().map(|d| d.to_string()).collect();
        out.push(path_dto(
            &doc.id.to_string(),
            &doc.title,
            &doc.goal,
            &steps,
            &domains,
        ));
    }
    Ok(out)
}

/// Map a `PlateauNode` to its DTO. `position` is the grade-1 part `(e1,e2,e3)` of the
/// multivector — blade order `[1, e1, e2, e12, e3, e13, e23, e123]`, so e3 = coeffs[4]
/// (matches `mp-wasm::convert::plateau_dto`).
pub fn plateau_dto(p: &PlateauNode) -> PlateauDto {
    let c = p.position().coeffs;
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

pub fn bridge_dto(b: &Bridge) -> BridgeDto {
    BridgeDto {
        id: b.id.to_string(),
        from: b.from.to_string(),
        to: b.to.to_string(),
        concept: b.concept_label.clone(),
    }
}

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
