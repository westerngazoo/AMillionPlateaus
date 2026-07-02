//! The JS/GDScript-facing DTO shapes for the immersive client (R-0025 / SPEC-0025
//! §2.2). These are **re-derived from `mp-domain` types here**, NOT imported from
//! `mp-wasm` — `convert.rs`'s DTOs are private to that binding, and a
//! binding→binding edge would invert the topology (§2.1 decision log). Equivalence
//! with the web binding is guaranteed **structurally by the parity test**
//! (`graph_source.rs`), not by shared struct identity. No GA here: `position` is
//! value-marshalled from the plateau's grade-1 coefficients, exactly as `mp-wasm` does.

use mp_domain::{Bridge, PlateauNode, Resource, ResourceKind, ResourceState};

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

#[derive(serde::Serialize)]
pub struct PathDto {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub steps: Vec<String>,
    pub domains: Vec<String>,
}

pub fn path_dto(p: &mp_identity::PathDoc) -> PathDto {
    PathDto {
        id: p.id.to_string(),
        title: p.title.clone(),
        goal: p.goal.clone(),
        steps: p.steps.iter().map(|id| id.to_string()).collect(),
        domains: p.domains.iter().map(|id| id.to_string()).collect(),
    }
}
