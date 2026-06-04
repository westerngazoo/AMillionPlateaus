# R-0003 — WASM bridge: the knowledge graph, queryable from the browser

- **Status:** Met
- **Milestone:** Phase 2 — WASM Bridge
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-30
- **Depends on:** R-0001, R-0002
- **Realized by:** SPEC-0003
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The knowledge graph and its fog reachability must be usable from JavaScript in a
web browser, with no server round-trip, through a WebAssembly module compiled
from the existing Rust core. A browser client must be able to build a graph
(add plateaus and bridges), read a plateau back, and ask the two fog questions
(`is_reachable`, `reachable_plateaus`) for a given wizard reputation — getting
exactly the same answers the Rust `KnowledgeGraph` gives.

The WASM layer is a **thin bridge**: it owns no graph logic of its own. All
geometry, reachability, and reputation math stays in `mp-graph` / `mp-reputation`
(garust underneath). `mp-wasm` only marshals values across the JS↔Rust boundary.

## 2. Rationale

"The graph is the platform" (CLAUDE.md §6). For the 3D world (Phase 6) and the
fog mechanic to run client-side without a trusted server, the browser needs the
real graph engine — not a re-implementation in JavaScript that could drift from
the Rust invariants or weaken the Sybil resistance. Compiling the audited Rust
core to WASM means the browser computes fog with the *same* Hestenes-inner-
product projection, so a scalar-only (Sybil) reputation sees only fog in the
browser exactly as it does on the server.

## 3. Acceptance criteria

- **AC1.** `mp-wasm` exposes a `#[wasm_bindgen]` `WasmGraph` with `new()`,
  `add_plateau(name, domain_id, e1, e2, e3) -> String` (returns the new plateau's
  id), and `add_bridge(from_id, to_id, concept) -> Result<(), JsError>`
  (rejects an unknown endpoint or a malformed UUID as a JS exception). The bridge
  rotor/grade are derived in `mp-graph` (`Bridge::between`), never supplied by JS.
- **AC2.** `WasmGraph::plateau(id) -> Option<PlateauDto>` returns
  `{ id, name, description, position: { e1, e2, e3 } }` for a known id and
  `null`/`None` for an unknown id. The `e1/e2/e3` are the Grade-1 coefficients of
  the stored position.
- **AC3.** `WasmGraph::is_reachable(plateau_id, wizard_rep_json) -> Result<bool, JsError>`
  returns the same boolean as `KnowledgeGraph::is_reachable` for the reputation
  decoded from `wizard_rep_json`. A malformed JSON or unknown plateau is a JS
  exception, not a silent `false`.
- **AC4.** `WasmGraph::reachable_plateaus(wizard_rep_json) -> Result<Vec<String>, JsError>`
  returns exactly the set of plateau ids that `KnowledgeGraph::reachable_plateaus`
  returns for the decoded reputation (same membership; order not significant).
- **AC5.** Wizard reputation crosses the boundary as a documented JSON string of
  shape `{ "domain_reps": { "<domain-uuid>": [f32; 8], ... }, "synthesis": [f32; 8] }`
  (each array is a garust `Vga3f` coefficient vector in blade order
  `[1, e1, e2, e12, e3, e13, e23, e123]`). Decoding round-trips into a
  `WizardReputation`. A scalar-only reputation (`domain_reps` whose arrays carry
  only index 0) yields an **empty** `reachable_plateaus` — the Sybil/fog property
  is preserved across the boundary.
- **AC6.** The boundary conversion logic (reputation-JSON → `WizardReputation`,
  `PlateauNode` → `PlateauDto`) lives in pure, non-`wasm_bindgen` functions that
  are covered by host-runnable `cargo test --workspace` tests, so the contract is
  verified without a browser. Binding-level `#[wasm_bindgen_test]` smoke tests
  also exist for the `WasmGraph` surface.
- **AC7.** `wasm-pack build crates/mp-wasm --target web` produces a loadable
  `pkg/` (wasm + JS glue + `.d.ts`). A minimal static `harness.html` loads the
  module, builds the 5-plateau seed graph, logs the plateau list, and prints the
  reachable set before and after a sample traversal-reputation — demonstrating the
  fog lifting in-browser. The generated `.wasm` is well under 5 MB.
- **AC8.** `cargo test --workspace` is green; `cargo build -p mp-wasm --target
  wasm32-unknown-unknown` compiles; `wasm-pack build crates/mp-wasm --target web`
  succeeds. The JS API is documented in `API_CONTRACTS.md`.

## 4. Constraints & non-goals

- `mp-wasm/src/lib.rs` holds `#[wasm_bindgen]` exports and thin marshalling only
  (CLAUDE.md file-layout rule). No graph/reputation/GA logic is reimplemented
  there; it calls into `mp-graph` / `mp-reputation`. garust stays the only math
  layer; no JS-side GA.
- No `unwrap()` in library code without a `// SAFETY:` comment; boundary errors
  surface as `JsError`/`Result`, never panics across the FFI.
- **Non-goals:** persistence (`save`/`load` bytes — deferred; redb is native-only
  and CRDT sync is Phase 3); exposing the `ReputationEngine` mutators
  (`record_traversal`/`propagate`) to JS (Phase ≥3 — for now reputation is
  supplied as JSON); Three.js/Godot rendering and the `apps/web` bundle (Phase 6);
  npm packaging/publishing; multiplayer or networking.

## 5. Open questions

- Should plateau ids be caller-supplied or engine-generated? **Settled in
  SPEC-0003:** engine-generated and returned from `add_plateau`, so `mp-graph`
  needs no new constructor and there is a single id space. Caller-supplied ids
  wait for the CRDT phase (R-0004+).
- Return `PlateauDto` as a structured JS object (serde-wasm-bindgen) vs a JSON
  string? Settled in SPEC-0003.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-30 | `mp-wasm` is a thin bridge; all logic stays in `mp-graph`/`mp-reputation` | CLAUDE.md file-layout rule + "graph is the platform"; avoids a JS GA re-impl that could drift from invariants |
| 2026-05-30 | Reputation crosses as a JSON string (`serde_json`), not a JS object | `WizardReputation` holds garust `Mv` (no serde derive); a documented coeff-array DTO is host-testable with `serde_json` and matches the API_CONTRACTS sketch's `wizard_rep_json: string` |
| 2026-05-30 | Plateau ids engine-generated, returned from `add_plateau` | No new `mp-graph` constructor; single id space; YAGNI on caller ids until CRDT |
| 2026-05-30 | Drop the `grade` param from the API_CONTRACTS `add_bridge` sketch | Bridge grade/rotor are derived from positions in `Bridge::between` (SPEC-0001); accepting a grade from JS would let the caller violate the even-grade invariant |
| 2026-05-30 | `save`/`load` deferred out of Phase 2 | Not in SDLC Phase 2 task list; redb is native-only, byte-snapshot belongs with CRDT sync (Phase 3) |

## Changelog

- 2026-05-30 created and accepted
- 2026-05-30 Met — `qa` signed off on AC1–AC8 (host suite + 3 wasm smoke tests green, clippy/fmt clean, `wasm-pack build` → 137 KB `.wasm`, `harness.html` lifts fog in-browser 0 → 4 with Sybil staying at 0). SPEC-0003 → Implemented
