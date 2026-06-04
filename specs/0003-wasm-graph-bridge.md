# SPEC-0003 — mp-wasm: the WASM graph bridge

- **Status:** Implemented
- **Realizes:** R-0003
- **Author:** Claude (Phase 2)
- **Created:** 2026-05-30
- **Depends on:** SPEC-0001, SPEC-0002
- **Module(s):** `crates/mp-wasm`

## 1. Motivation

Realizes R-0003: compile the audited Rust graph core to WebAssembly so a browser
can build the graph and ask the fog questions with the *same* GA math — no JS
re-implementation, no server round-trip, Sybil resistance preserved client-side.

## 2. Design

Dependency direction unchanged: `mp-graph` ← `mp-reputation`, and now
`mp-wasm` → both. `mp-wasm` adds **no** graph logic; it marshals.

### Module layout (per CLAUDE.md: lib.rs = thin `#[wasm_bindgen]` only)

```
crates/mp-wasm/src/
  lib.rs       ← #[wasm_bindgen] WasmGraph — thin methods delegating to convert
  convert.rs   ← PURE, host-testable: DTOs, reputation JSON parse, query helpers
  error.rs     ← ReputationParseError / QueryError (thiserror) → JsError via `?`
crates/mp-wasm/tests/web.rs        ← #[wasm_bindgen_test] smoke tests (wasm only)
crates/mp-wasm/www/harness.html    ← static loader/demo (AC7)
```

The split is the crux: everything with branching logic (UUID parsing, JSON
decoding, DTO building, the reachable-set query) lives in `convert.rs` as plain
functions over `mp_graph` types, exercised by `cargo test --workspace` on the
host. `lib.rs` is the `#[wasm_bindgen]` skin that converts errors to `JsError`
and structured results to `JsValue` — the part that genuinely needs a browser,
covered by `wasm-bindgen-test`.

### Errors (`error.rs`)

```rust
#[derive(thiserror::Error, Debug)]
pub enum ReputationParseError {
    #[error("reputation JSON is invalid: {0}")] Json(#[from] serde_json::Error),
    #[error("domain id is not a valid UUID: {0}")] DomainId(#[from] uuid::Error),
}

#[derive(thiserror::Error, Debug)]
pub enum QueryError {
    #[error(transparent)] Reputation(#[from] ReputationParseError),
    #[error("plateau id is not a valid UUID: {0}")] PlateauId(uuid::Error),
    #[error("unknown plateau: {0}")] UnknownPlateau(String),
}
```

`wasm-bindgen` provides a blanket `impl<E: std::error::Error> From<E> for JsError`,
so a `#[wasm_bindgen]` method returning `Result<T, JsError>` can `?` any of these
— the error message becomes the thrown JS `Error`. No panics cross the FFI.

### Reputation DTO + conversions (`convert.rs`, pure)

Reputation crosses as a JSON **string** (matches API_CONTRACTS `wizard_rep_json`).
`WizardReputation` can't derive serde (it holds garust `Mv`), so we decode an
explicit coeff-array DTO and build the `Mv` from `coeffs`.

Constructing `Mv { coeffs }` directly is **value-marshalling, not GA
computation** — `coeffs` is a public field on the garust `Vga3f` and this is the
only garust touch in `mp-wasm`. No geometric-algebra operation is performed here;
all GA math (projection, reachability) still happens in `mp-graph`. This does not
violate the "no GA in wasm" rule.

```rust
#[derive(serde::Deserialize)]
struct ReputationDto {
    #[serde(default)] domain_reps: std::collections::HashMap<String, [f32; 8]>,
    #[serde(default)] synthesis: [f32; 8],   // defaults to zeros
}

/// `{ "domain_reps": { "<uuid>": [1,e1,e2,e12,e3,e13,e23,e123], .. }, "synthesis":[8] }`
pub fn parse_reputation(json: &str) -> Result<WizardReputation, ReputationParseError> {
    let dto: ReputationDto = serde_json::from_str(json)?;
    let mut domain_reps = HashMap::new();
    for (k, coeffs) in dto.domain_reps {
        let id = Uuid::parse_str(&k)?;
        domain_reps.insert(id, Mv { coeffs });
    }
    Ok(WizardReputation {
        wizard_id: Uuid::nil(),               // reachability ignores wizard_id
        domain_reps,
        synthesis: Mv { coeffs: dto.synthesis },
    })
}

#[derive(serde::Serialize)]
pub struct PositionDto { pub e1: f32, pub e2: f32, pub e3: f32 }
#[derive(serde::Serialize)]
pub struct PlateauDto { pub id: String, pub name: String,
                        pub description: String, pub position: PositionDto }

pub fn plateau_dto(p: &PlateauNode) -> PlateauDto {
    let c = p.position().coeffs;             // [1,e1,e2,e12,e3,..]
    PlateauDto { id: p.id.to_string(), name: p.name.clone(),
        description: p.description.clone(),
        position: PositionDto { e1: c[1], e2: c[2], e3: c[4] } }
}

/// AC4/AC5 — the real query path, host-testable against a `KnowledgeGraph`.
pub fn reachable_ids(g: &KnowledgeGraph, json: &str)
        -> Result<Vec<String>, ReputationParseError> {
    let rep = parse_reputation(json)?;
    Ok(g.reachable_plateaus(&rep).iter().map(|id| id.to_string()).collect())
}

/// AC3 — single-plateau fog query by id string.
pub fn is_reachable_by_id(g: &KnowledgeGraph, plateau_id: &str, json: &str)
        -> Result<bool, QueryError> {
    let pid = Uuid::parse_str(plateau_id).map_err(QueryError::PlateauId)?;
    let plateau = g.plateau(&pid)
        .ok_or_else(|| QueryError::UnknownPlateau(plateau_id.to_string()))?;
    let rep = parse_reputation(json)?;
    Ok(g.is_reachable(plateau, &rep))
}
```

### `WasmGraph` (`lib.rs`, thin `#[wasm_bindgen]`)

```rust
#[wasm_bindgen]
pub struct WasmGraph { inner: KnowledgeGraph }

#[wasm_bindgen]
impl WasmGraph {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmGraph { WasmGraph { inner: KnowledgeGraph::new() } }

    /// AC1 — returns the generated plateau id (engine-assigned UUID).
    pub fn add_plateau(&mut self, name: &str, domain_id: &str,
                       e1: f32, e2: f32, e3: f32) -> Result<String, JsError> {
        let domain = Uuid::parse_str(domain_id)?;
        let p = PlateauNode::new(name, domain, e1, e2, e3);
        let id = p.id.to_string();
        self.inner.add_plateau(p);
        Ok(id)
    }

    /// AC1 — rotor/grade derived in mp-graph; unknown endpoint ⇒ JS exception.
    pub fn add_bridge(&mut self, from_id: &str, to_id: &str,
                      concept: &str) -> Result<(), JsError> {
        let from = Uuid::parse_str(from_id)?;
        let to = Uuid::parse_str(to_id)?;
        let bridge = {
            let f = self.inner.plateau(&from)
                .ok_or_else(|| JsError::new("unknown from plateau"))?;
            let t = self.inner.plateau(&to)
                .ok_or_else(|| JsError::new("unknown to plateau"))?;
            Bridge::between(f, t, concept, Uuid::nil())   // nil = system author
        };
        self.inner.add_bridge(bridge)?;                   // GraphError → JsError
        Ok(())
    }

    /// AC2 — PlateauDto object, or JS null for an unknown id.
    pub fn plateau(&self, id: &str) -> Result<JsValue, JsError> {
        let pid = Uuid::parse_str(id)?;
        match self.inner.plateau(&pid) {
            Some(p) => Ok(serde_wasm_bindgen::to_value(&convert::plateau_dto(p))?),
            None => Ok(JsValue::NULL),
        }
    }

    /// AC3
    pub fn is_reachable(&self, plateau_id: &str,
                        wizard_rep_json: &str) -> Result<bool, JsError> {
        Ok(convert::is_reachable_by_id(&self.inner, plateau_id, wizard_rep_json)?)
    }

    /// AC4
    pub fn reachable_plateaus(&self,
                              wizard_rep_json: &str) -> Result<Vec<String>, JsError> {
        Ok(convert::reachable_ids(&self.inner, wizard_rep_json)?)
    }
}
```

`Vec<String>` and `bool`/`String` cross natively; `PlateauDto` goes via
`serde_wasm_bindgen::to_value` (→ a plain JS object). `serde_wasm_bindgen::Error`
is an `Error`, so `?` maps it to `JsError` too.

### Cargo / build

`mp-wasm/Cargo.toml` adds `uuid`, `serde_json` (new `[workspace.dependencies]`
entry), keeps `wasm-bindgen` + `serde-wasm-bindgen`; dev-dep `wasm-bindgen-test`.
`crate-type = ["cdylib", "rlib"]` already set (rlib ⇒ host `cargo test` sees
`convert`). Build: `wasm-pack build crates/mp-wasm --target web` → `pkg/`
(gitignored). `www/harness.html` loads `../pkg/mp_wasm.js`, builds the 5-plateau
seed, logs the list, and prints reachable-before/after a sample reputation.

## 3. Code outline

See §2 — the load-bearing logic is `convert.rs`; `lib.rs` is the binding skin.

`tests/web.rs` (run via `wasm-pack test --node crates/mp-wasm`):
```rust
#![cfg(target_arch = "wasm32")]      // host `cargo test` skips these
use wasm_bindgen_test::*;
// build WasmGraph, add 2 plateaus + a bridge, assert plateau()/reachable_plateaus()
```

## 4. Non-goals

- `save`/`load` byte snapshot (deferred to CRDT phase); redb is native-only.
- Exposing `ReputationEngine` mutators to JS (reputation is supplied as JSON).
- Three.js/Godot, `apps/web`, npm publish, networking.

## 5. Open questions

- Bundle-size assertion is a manual/CI check (`ls -la pkg/*.wasm`), not a unit
  test. Decision: report the size in the PR; no automated gate this phase.

## 6. Acceptance criteria

- [x] AC1 → `WasmGraph::add_plateau`/`add_bridge`; rotor derived in `Bridge::between` (JS never supplies grade). Unknown-endpoint / malformed-UUID rejection is binding-level, covered by wasm `build_graph_smoke` (both throw a `JsError`)
- [x] AC2 → `plateau_dto_maps_position` (host) + wasm `plateau_roundtrip`
- [x] AC3 → `is_reachable_by_id_matches_graph` + `is_reachable_unknown_plateau_errors` + `is_reachable_bad_plateau_id_errors` + `is_reachable_bad_json_errors` (host); wasm `fog_queries_smoke`
- [x] AC4 → `reachable_ids_matches_graph` (host); wasm `fog_queries_smoke`
- [x] AC5 → `parse_reputation_roundtrip` + `parse_reputation_rejects_bad_uuid`/`bad_json` + `parse_reputation_defaults_empty` + `scalar_only_reputation_reaches_nothing` (host). `WizardReputation`/`Mv` derive no `PartialEq` and `wizard_id` is deliberately lossy (`Uuid::nil()`), so `parse_reputation_roundtrip` asserts **field-wise on the `f32` `coeffs`** of each `domain_reps` entry and of `synthesis`, explicitly excluding `wizard_id`.
- [x] AC6 → 11-test host suite in `convert.rs` under `cargo test --workspace`; `tests/web.rs` 3× `#[wasm_bindgen_test]` (run via `wasm-pack test --node`)
- [x] AC7 → `wasm-pack build crates/mp-wasm --target web` produces `pkg/` (.wasm + .js + .d.ts); `www/harness.html` logs the 5-plateau list + prints 0 → 4 reachable (Music Theory stays fogged) + Sybil 0; `.wasm` ≈ 137 KB ≪ 5 MB
- [x] AC8 → `cargo test --workspace` green; `cargo build -p mp-wasm --target wasm32-unknown-unknown` ok; `wasm-pack build` ok; API in `API_CONTRACTS.md` §1

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-30 | Logic in pure `convert.rs` over `mp_graph` types; `lib.rs` is the `#[wasm_bindgen]` skin | Makes AC3–AC6 host-testable via `cargo test --workspace` (no browser); satisfies CLAUDE.md "lib.rs = thin wrappers" |
| 2026-05-30 | Reputation in via JSON string + coeff-array DTO; `wizard_id` set to `Uuid::nil()` | `WizardReputation` has no serde derive; reachability never reads `wizard_id` |
| 2026-05-30 | Errors via thiserror enums → `JsError` through wasm-bindgen's blanket `From<Error>` | Typed errors, no `unwrap`, no panic across FFI (CLAUDE.md §5) |
| 2026-05-30 | `created_by = Uuid::nil()` for browser-built bridges | No wizard identity in the WASM context yet (Nostr identity is Phase 8) |
| 2026-05-30 | `wasm-bindgen-test` file gated `#![cfg(target_arch = "wasm32")]` | Keeps the host `cargo test --workspace` gate green; browser tests run via `wasm-pack test` |
| 2026-05-30 | Spec accepted after architect review (APPROVE WITH CHANGES). Folded in: dropped dead `QueryError::Graph` variant (never constructed — `add_bridge` maps `GraphError` → `JsError` directly); noted `Mv { coeffs }` is value-marshalling not GA computation; `parse_reputation_roundtrip` asserts field-wise on `coeffs` (excludes `wizard_id`, which is lossy `Uuid::nil()`) | Correctness/clarity-guarding; no design change. Blade indexing (e1=c[1], e2=c[2], e3=c[4]) confirmed correct; error `?`→`JsError` confirmed compiles for all error types; Sybil/fog property preserved by construction |

## Changelog

- 2026-05-30 created
- 2026-05-30 accepted after architect design review; folded in correctness-guarding clarifications (see decision log)
- 2026-05-30 Implemented — all AC1–AC8 verified; `qa` signed off (host suite + wasm smoke tests green, harness lifts fog in-browser, `.wasm` ≈ 137 KB); R-0003 → Met. During implementation, `mp_graph::types::now_unix` was made wasm-safe (returns 0 on `wasm32`; `SystemTime::now()` panics there) to honor CLAUDE.md §5 (no panic across the FFI)
