//! mp-wasm — the WASM graph bridge (SPEC-0003, R-0003).
//!
//! A **thin** `#[wasm_bindgen]` skin over `mp-graph`: it owns no graph, GA, or
//! reputation logic. Every method parses its string arguments, delegates to
//! `mp-graph` (the audited Rust core), and marshals the result back across the
//! JS↔Rust boundary. All branching logic lives in the pure, host-testable
//! [`convert`] module; this file is just the binding.
//!
//! Errors surface as `JsError` (a thrown JS `Error`) via wasm-bindgen's blanket
//! `From<std::error::Error>` — no panic ever crosses the FFI.

mod convert;
mod error;

use mp_graph::{Bridge, KnowledgeGraph, PlateauNode};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

/// A knowledge graph usable from JavaScript. Wraps an `mp_graph::KnowledgeGraph`.
#[wasm_bindgen]
pub struct WasmGraph {
    inner: KnowledgeGraph,
}

#[wasm_bindgen]
impl WasmGraph {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmGraph {
        WasmGraph {
            inner: KnowledgeGraph::new(),
        }
    }

    /// AC1 — add a plateau, returning the engine-assigned UUID as a string.
    pub fn add_plateau(
        &mut self,
        name: &str,
        domain_id: &str,
        e1: f32,
        e2: f32,
        e3: f32,
    ) -> Result<String, JsError> {
        let domain = Uuid::parse_str(domain_id)?;
        let p = PlateauNode::new(name, domain, e1, e2, e3);
        let id = p.id.to_string();
        self.inner.add_plateau(p);
        Ok(id)
    }

    /// AC1 — add a bridge between two existing plateaus. The rotor/grade are
    /// derived in `mp-graph` (`Bridge::between`), never supplied by JS. An
    /// unknown endpoint or malformed UUID becomes a thrown JS `Error`.
    pub fn add_bridge(&mut self, from_id: &str, to_id: &str, concept: &str) -> Result<(), JsError> {
        let from = Uuid::parse_str(from_id)?;
        let to = Uuid::parse_str(to_id)?;
        let bridge = {
            let f = self
                .inner
                .plateau(&from)
                .ok_or_else(|| JsError::new("unknown from plateau"))?;
            let t = self
                .inner
                .plateau(&to)
                .ok_or_else(|| JsError::new("unknown to plateau"))?;
            // created_by = nil: no wizard identity in the WASM context yet
            // (Nostr identity is Phase 8).
            Bridge::between(f, t, concept, Uuid::nil())
        };
        self.inner.add_bridge(bridge)?;
        Ok(())
    }

    /// AC2 — a `PlateauDto` object for a known id, or JS `null` for an unknown id.
    pub fn plateau(&self, id: &str) -> Result<JsValue, JsError> {
        let pid = Uuid::parse_str(id)?;
        match self.inner.plateau(&pid) {
            Some(p) => Ok(serde_wasm_bindgen::to_value(&convert::plateau_dto(p))?),
            None => Ok(JsValue::NULL),
        }
    }

    /// AC3 — is a single plateau reachable for the given reputation?
    pub fn is_reachable(&self, plateau_id: &str, wizard_rep_json: &str) -> Result<bool, JsError> {
        Ok(convert::is_reachable_by_id(
            &self.inner,
            plateau_id,
            wizard_rep_json,
        )?)
    }

    /// AC4 — the set of plateau ids reachable for the given reputation.
    pub fn reachable_plateaus(&self, wizard_rep_json: &str) -> Result<Vec<String>, JsError> {
        Ok(convert::reachable_ids(&self.inner, wizard_rep_json)?)
    }
}

impl Default for WasmGraph {
    fn default() -> Self {
        Self::new()
    }
}
