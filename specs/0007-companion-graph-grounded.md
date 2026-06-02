# SPEC-0007 — Companion: provider-agnostic model client + GA-graph-grounded context, embodying the persona

- **Status:** Implemented
- **Realizes:** R-0007
- **Author:** Claude
- **Created:** 2026-05-31
- **Depends on:** SPEC-0005, SPEC-0006
- **Module(s):** `apps/web` (new pure JS modules + UI); `mp-graph` + `mp-wasm` (one **additive** retrieval query)

## 1. Motivation

R-0006 made a persona a one-shot lens that vanishes after selection. R-0007 wants
that lens to become an **always-present companion** that (a) **embodies** the
active persona's voice, (b) talks to a **model the visitor configures** — hosted
*or local*, bring-your-own, no shipped key — and (c) is **grounded in the GA
graph** so its context is orientation-aware, not a flat dump.

The design pivot that shapes everything: the same geometric query that lights the
fog — *project the visitor's orientation onto each plateau's position* — is also
the **retrieval query** for the companion. "What is near me / what is reachable /
what connects here" is a spatial question the graph store answers directly. That
is the differentiator over a generic chat box (R-0007 §2), and it is why the one
new piece of core code is a **nearest-by-projection** query, not a vendor SDK.

Posture: **client-only, bring-your-own-model** (Obsidian-style). The model is
called **directly from the browser** with the visitor's own endpoint/key (or a
local endpoint needing no key), so there is **no backend, no shipped secret**, and
the companion stays a per-visitor **local lens** that never enters the CRDT
(CLAUDE.md §7). The provider layer and the context-builder are **pure and
unit-tested** (host/node); the only impure edge is a single `fetch`.

## 2. Design

Layers unchanged (CLAUDE.md §2): `apps/web` → `mp-wasm` → {`mp-graph`,
`mp-crdt`}. New JS lives under `apps/web/src/`. One **additive** query is added to
`mp-graph` and surfaced through `mp-wasm` because ranking plateaus by projection
is GA math and **must not** be reimplemented in JS (CLAUDE.md §1/§4).

```
apps/web/
  index.html                 ← + companion panel, + model-setup screen, + styles
  src/
    model.js                 ← NEW. pure: provider kind → HTTP request shape / response parse. No fetch here.
    model.test.mjs           ← NEW. node --test for model.js (AC6)
    companion-context.js     ← NEW. pure: { persona, graph snapshot } → grounding context string
    companion-context.test.mjs ← NEW. node --test for the context-builder (AC6)
    companion-voice.js        ← NEW. pure: archetype → voice brief (system-prompt fragment). No stats.
    companion.js             ← NEW. orchestration: holds config+conversation, calls model (the one fetch), renders panel
    persona.js               ← unchanged (SPEC-0006)
    main.js                  ← MODIFIED. on persona chosen → init companion w/ voice + graph context each turn
    project.js render.js traverse.js sync.js  ← unchanged

crates/mp-graph/src/graph.rs ← + nearest_plateaus(rep, k)  (additive; reuses the fog projection)
crates/mp-wasm/src/lib.rs    ← + WasmGraph.nearest_plateaus(rep_json, k) -> JSON  (thin wrapper)
```

### 2.1 The retrieval query (the moat) — additive `mp-graph` + `mp-wasm`

Today the projection lives **inline** in `is_reachable` (`graph.rs:80-87`) as
`wizard.domain_reps.values().map(|rep| ga::project(rep, plateau.position())).fold(f32::NEG_INFINITY, f32::max)`,
thresholded at `REACHABILITY_THRESHOLD` (0.15). The companion needs the **ranked
neighbourhood** — the same projection, sorted, top-k. So we (1) **extract a new
private helper** `projection_score(rep, plateau)` from that inline fold, (2) have
`is_reachable`/`reachable_plateaus` call it (behaviour-preserving — same threshold,
same domain-max semantics, existing tests stay green), and (3) add
`nearest_plateaus` reusing it so fog and retrieval **cannot drift**:

```rust
// crates/mp-graph/src/graph.rs  — additive. projection_score is NEW (extracted
// from is_reachable's inline fold): max over domain_reps of ga::project(rep_d,
// position); no DomainId gate. nearest ranks all plateaus by it, no threshold.
impl KnowledgeGraph {
    // NEW private helper, extracted from is_reachable (single source of truth).
    fn projection_score(&self, rep: &WizardReputation, plateau: &PlateauNode) -> f32 {
        rep.domain_reps
            .values()
            .map(|r| ga::project(r, plateau.position()))   // position() is the real accessor (types.rs:68)
            .fold(f32::NEG_INFINITY, f32::max)
    }

    /// Plateaus ranked by how strongly `rep` projects onto their position
    /// (descending), truncated to `k`. The fog's reachability is the same score
    /// thresholded at REACHABILITY_THRESHOLD; this exposes the ranking for retrieval.
    pub fn nearest_plateaus(&self, rep: &WizardReputation, k: usize) -> Vec<(PlateauId, f32)> {
        let mut scored: Vec<(PlateauId, f32)> = self
            .plateaus()                                    // existing iterator (graph.rs:66)
            .map(|p| (p.id, self.projection_score(rep, p)))// p.id is a PUBLIC FIELD (types.rs:33), not a method
            .collect();
        // total order on f32 via total_cmp; deterministic tie-break by id.
        scored.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
        scored.truncate(k);
        scored
    }
}
```

No `unwrap`, returns owned data, pure computation — honors §5 and "additive only."

`mp-wasm` mirrors the `reachable_plateaus` thin-skin pattern (CLAUDE.md §2 / the
`convert.rs` "everything with branching logic lives here" rule): **all** decode +
ranking-to-DTO marshalling is a pure, host-tested function in `convert.rs`, and
`lib.rs` is a one-line delegator. The new DTO sits beside `PlateauDto`/`BridgeDto`:

```rust
// crates/mp-wasm/src/convert.rs — pure, host-tested (mirrors reachable_ids).
#[derive(Serialize)]
pub struct NearestDto { pub id: String, pub name: String, pub score: f32 }

/// Decode the reputation JSON (same parse_reputation path as reachable),
/// validate k, and return top-k rows. k is validated at the wasm boundary
/// (below) so this receives a sane usize.
pub fn nearest_dtos(g: &KnowledgeGraph, rep_json: &str, k: usize) -> Result<Vec<NearestDto>, ConvertError> { ... }

// crates/mp-wasm/src/lib.rs — one-line delegator, like reachable_plateaus (lib.rs:102).
#[wasm_bindgen]
impl WasmGraph {
    /// JSON: [{ "id","name","score" }, ...] top-k by projection (descending).
    pub fn nearest_plateaus(&self, rep_json: &str, k: f64) -> Result<JsValue, JsValue> {
        // Validate k AT THE BOUNDARY so no panic crosses the FFI (CLAUDE.md §5):
        // reject non-finite/negative, floor fractional, clamp to plateau count.
        // Then delegate to convert::nearest_dtos and serde_wasm_bindgen the rows.
    }
}
```

`k` arrives from JS as a `number`; the wrapper takes `f64` and **validates at the
boundary** — a non-finite or negative `k` is an `Err` (graceful, no panic), a
fractional `k` is floored — so `nearest_plateaus(rep, -1)` / `(rep, 2.5)` can never
panic across the FFI. `nearest_plateaus` is **read-only** (mutates no graph state,
never synced).

### 2.2 Provider abstraction (`model.js`, pure — AC1, AC4, AC6)

One **interface**, concrete **adapters**, swappable behind a `kind` field. v1
ships an **OpenAI-compatible** adapter (covers hosted OpenAI-style gateways **and**
local runtimes — Ollama/LM Studio/llama.cpp all expose `/v1/chat/completions`) and
a **fake** adapter for offline/CI. `model.js` is **pure**: it builds the request
descriptor and parses the response; it never calls `fetch` (that lives in
`companion.js`, the one impure edge), which is what makes it node-unit-testable.

```js
// model.js — pure. Provider kind → request descriptor / response parser.
// NEVER logs or returns the apiKey except inside the request headers it builds.

export const PROVIDERS = {
  // hosted OpenAI-style AND local (Ollama/LM Studio) — base URL differs, shape is one.
  "openai-compatible": {
    label: "OpenAI-compatible (hosted or local)",
    needsKey: true,                          // local endpoints may leave it blank
    buildRequest(cfg, messages) {
      return {
        url: `${cfg.endpoint.replace(/\/$/, "")}/chat/completions`,
        headers: {
          "content-type": "application/json",
          ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: cfg.model, messages }),
      };
    },
    parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ""; },
  },
  // deterministic, no network — used by tests and as the "unconfigured" safe default.
  fake: {
    label: "Fake (offline / test)",
    needsKey: false,
    buildRequest(cfg, messages) { return { url: "fake://echo", headers: {}, body: messages }; },
    parseResponse(_json) { return ""; },     // companion.js short-circuits the fake to a canned reply
  },
};

// presets surfaced by the setup screen (AC1): a local default needing no key,
// plus a blank hosted slot.
export const PRESETS = [
  { id: "local-ollama", kind: "openai-compatible", label: "Local — Ollama",
    endpoint: "http://localhost:11434/v1", model: "llama3.1", needsKey: false },
  { id: "hosted",       kind: "openai-compatible", label: "Hosted (bring your key)",
    endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini", needsKey: true },
];

export function buildRequest(cfg, messages) { return PROVIDERS[cfg.kind].buildRequest(cfg, messages); }
export function parseResponse(cfg, json)     { return PROVIDERS[cfg.kind].parseResponse(json); }
```

`companion.js` owns the only `fetch`, injectable for tests:

```js
// companion.js (orchestration sketch) — the one impure edge.
export async function sendTurn(cfg, messages, deps = { fetch }) {
  if (cfg.kind === "fake") return `「${messages.at(-1).content}」`; // deterministic echo, no network
  const req = buildRequest(cfg, messages);
  let res;
  try {
    res = await deps.fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
  } catch (e) {
    // a thrown fetch rejection is CORS / DNS / offline (no response object) — surface
    // it distinctly from an HTTP-status error; both are caught by the caller (AC4).
    throw new Error(`model unreachable (CORS/network): ${e.message}`);
  }
  if (!res.ok) throw new Error(`model HTTP ${res.status}`);       // distinct HTTP-status branch (AC4)
  return parseResponse(cfg, await res.json());
}
```

**Round-trip fidelity (AC4) is proven against the real `openai-compatible`
adapter with an injected fake `fetch`** (`sendTurn(cfg, msgs, { fetch: fakeFetch })`)
— i.e. `buildRequest` → `fakeFetch` returns a canned OpenAI-shaped body →
`parseResponse` extracts the text. The `kind === "fake"` short-circuit is only the
always-available **offline reply** so the UI works with no model configured; it
does **not** stand in for transport. The panel wraps `sendTurn` in try/catch and
renders any thrown message gracefully (unconfigured, CORS/network, HTTP status) —
no uncaught console errors.

### 2.3 Graph-grounded context (`companion-context.js`, pure — AC3, AC6)

Each turn, `main.js` takes a **graph snapshot** for the active orientation —
`reachable` (lit ids), `nearest` (top-k via §2.1), and the `bridges` among them —
and the **pure** builder turns it into a compact grounding block. Two different
personas pass different `reachable`/`nearest` (different orientation), so the
context **observably differs** (AC3). No GA math in JS: the scores come from wasm.

```js
// companion-context.js — pure. Graph snapshot + persona → grounding string.
// Deterministic: same inputs → same output (AC6).
export function buildGroundingContext({ persona, plateaus, reachableIds, nearest, bridges }) {
  const byId = new Map(plateaus.map((p) => [p.id, p]));
  const lit = [...reachableIds].map((id) => byId.get(id)?.name).filter(Boolean).sort();
  // filter unknown ids like `lit` does, so a snapshot mismatch never emits "undefined (0.16)".
  const near = nearest
    .filter((n) => byId.has(n.id))
    .map((n) => `${byId.get(n.id).name} (${n.score.toFixed(2)})`);
  const links = bridges
    .filter((b) => reachableIds.has(b.from) && reachableIds.has(b.to))
    .map((b) => `${byId.get(b.from)?.name}—${byId.get(b.to)?.name}: ${b.concept}`);
  return [
    `You are ${persona.name}, oriented toward ${persona.domainLabel}.`,
    `Plateaus currently in reach: ${lit.join(", ") || "none yet"}.`,
    `Nearest to your orientation: ${near.join(", ")}.`,
    `Connections among them: ${links.join("; ") || "none"}.`,
    `Ground your guidance in this neighbourhood; do not invent plateaus outside it.`,
  ].join("\n");
}
```

The persona voice (`companion-voice.js`, pure) supplies the **system** message —
tone and stance only, **never stats** (CLAUDE.md §4 / R-0006). The turn is
`[{role:"system", content: voice + "\n" + grounding}, ...history, {role:"user", content}]`.

```js
// companion-voice.js — pure. archetype id → a short character brief (no numbers).
export const VOICES = {
  geometer: "Speak as a precise, proof-minded guide who loves structure and rigor.",
  composer: "Speak as a lyrical guide who hears patterns as rhythm and harmony.",
  polymath: "Speak as a synthesist who bridges domains and delights in analogy.",
};
export function voiceFor(persona) { return VOICES[persona.id] ?? "Speak as a helpful guide."; }
```

### 2.4 Setup screen + always-present panel (`index.html` + `main.js` — AC1, AC2, AC5)

- **Model-setup screen.** A settings affordance (button in the bar + a panel)
  lets the visitor pick a **preset** or enter a **custom** `{kind, endpoint, model,
  apiKey}`. Saved to `localStorage["mp.modelConfig"]`. If absent/invalid, the
  companion shows a "connect a model" state and opens the screen; the app ships
  **no key** and falls back to the `fake` provider so the UI is always usable
  offline. Editable any time.
- **Always-present companion panel.** Once a persona is chosen (R-0006), a panel is
  **continuously visible** beside the map: a header in the persona's voice/name, a
  scrolling transcript, and an input. It is **not** the dismissable creator overlay.
- **Persona embodiment & change.** `choosePersona(a)` (SPEC-0006) additionally sets
  the companion's `voiceFor(a)` and resets the transcript header; **changing**
  persona updates voice + grounding with **no reload** (AC2, consistent w/ R-0006
  AC4).
- **Per-turn flow.** On send: snapshot the graph for `localRep`
  (`reachable_plateaus`, new `nearest_plateaus`, `bridges`), `buildGroundingContext`,
  assemble messages, `sendTurn(cfg, messages)`, render the reply (or a graceful
  error). Conversation is **in-memory** (resets on reload, v1).

### 2.5 Local-only / never-synced (AC5 — CLAUDE.md §7)

`modelConfig` (incl. any `apiKey`), the conversation, the persona, and `localRep`
live **only** in JS / `localStorage`. None is written to `WasmCrdtDoc` or posted to
the `BroadcastChannel`; the existing `doc.root_keys()` assertion still holds
(`{bridges, plateaus, resources, votes}`) and is logged once. The API key is
**never** logged and **never** leaves the `authorization` header of the
visitor-configured request. `nearest_plateaus` is a **read-only** query — it
mutates no graph state and is never synced.

### 2.6 Data flow

```
setup ─▶ localStorage["mp.modelConfig"]                                  [LOCAL only, never synced]
choose persona ─▶ voiceFor(a) + seedReputation(a) ─▶ panel + draw         [LOCAL only]
send turn ─▶ wasm: reachable_plateaus + nearest_plateaus ─▶ buildGroundingContext
          ─▶ sendTurn(cfg, [system(voice+grounding), …history, user]) ─▶ fetch(model) ─▶ render   [LOCAL only]
add/vote ─▶ WasmCrdtDoc edit ─▶ pump() ─▶ BroadcastChannel ─▶ other tab    [CRDT bytes only]
```

## 3. Code outline

```js
// apps/web/src/model.test.mjs — node --test, pure, no network (AC6)
import test from "node:test";
import assert from "node:assert/strict";
import { buildRequest, parseResponse, PROVIDERS } from "./model.js";

test("openai-compatible builds a /chat/completions POST with bearer auth", () => {
  const cfg = { kind: "openai-compatible", endpoint: "http://x/v1", model: "m", apiKey: "k" };
  const req = buildRequest(cfg, [{ role: "user", content: "hi" }]);
  assert.equal(req.url, "http://x/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer k");
  assert.match(req.body, /"model":"m"/);
});

test("local endpoint omits auth header when no key", () => {
  const cfg = { kind: "openai-compatible", endpoint: "http://localhost:11434/v1", model: "llama3.1" };
  assert.equal("authorization" in buildRequest(cfg, []).headers, false);
});

test("parseResponse extracts assistant text; missing → empty string", () => {
  const cfg = { kind: "openai-compatible" };
  assert.equal(parseResponse(cfg, { choices: [{ message: { content: "ok" } }] }), "ok");
  assert.equal(parseResponse(cfg, {}), "");
});

test("providers are swappable behind one interface", () => {
  for (const k of Object.keys(PROVIDERS)) assert.equal(typeof PROVIDERS[k].buildRequest, "function");
});
```

```js
// apps/web/src/companion-context.test.mjs — node --test, pure (AC3, AC6)
import test from "node:test";
import assert from "node:assert/strict";
import { buildGroundingContext } from "./companion-context.js";

const plateaus = [
  { id: "a1", name: "Arithmetic" }, { id: "c1", name: "Rhythm" },
];
const bridges = [{ from: "a1", to: "c1", concept: "ratio" }];

test("context names the persona, the lit set, and nearest — deterministically", () => {
  const ctx = buildGroundingContext({
    persona: { name: "The Geometer", domainLabel: "Mathematics", id: "geometer" },
    plateaus, reachableIds: new Set(["a1"]),
    nearest: [{ id: "a1", score: 0.16 }, { id: "c1", score: 0.008 }], bridges,
  });
  assert.match(ctx, /The Geometer/);
  assert.match(ctx, /in reach: Arithmetic/);
  assert.match(ctx, /Arithmetic \(0\.16\)/);
  // same inputs → identical output
  assert.equal(ctx, buildGroundingContext({
    persona: { name: "The Geometer", domainLabel: "Mathematics", id: "geometer" },
    plateaus, reachableIds: new Set(["a1"]),
    nearest: [{ id: "a1", score: 0.16 }, { id: "c1", score: 0.008 }], bridges,
  }));
});

test("two personas (different reachable/nearest) yield different context (AC3)", () => {
  const base = { plateaus, bridges };
  const geo = buildGroundingContext({ ...base, persona: { name: "The Geometer", domainLabel: "Mathematics", id: "geometer" },
    reachableIds: new Set(["a1"]), nearest: [{ id: "a1", score: 0.16 }] });
  const com = buildGroundingContext({ ...base, persona: { name: "The Composer", domainLabel: "Music", id: "composer" },
    reachableIds: new Set(["c1"]), nearest: [{ id: "c1", score: 0.16 }] });
  assert.notEqual(geo, com);
});
```

```rust
// crates/mp-graph/src/tests — nearest ranks by projection, deterministic, top-k
#[test]
fn nearest_plateaus_ranks_by_projection_desc() {
    // a Geometer-style rep (e1) ranks Arithmetic above Rhythm; truncates to k.
    // (shares projection_score with is_reachable, so it cannot drift from the fog)
}

#[test]
fn nearest_plateaus_tie_breaks_by_id() {
    // two plateaus with equal projection order by PlateauId (the .then(a.0.cmp(&b.0))),
    // so top-k is deterministic across runs.
}

#[test]
fn is_reachable_unchanged_after_projection_score_extraction() {
    // regression guard: extracting projection_score must not change which plateaus
    // is_reachable/reachable_plateaus return (behaviour-preserving refactor).
}
```

`crates/mp-wasm/src/convert.rs` gains a host test for `nearest_dtos` (decode →
rank → DTO rows, ordered by descending `score`), mirroring the existing
`reachable_ids` host tests; `lib.rs` stays a one-line delegator. `wasm-pack test
--node` gains a case asserting `WasmGraph.nearest_plateaus(rep, k)` returns `k`
rows ordered by descending `score`, and that an invalid `k` (negative / NaN) is a
graceful `Err`, not a panic.

## 4. Non-goals

- **No backend / no shipped key.** Browser-direct, BYO endpoint/key. An optional
  thin proxy for CORS-blocked hosted providers is a **future** spec, not this one;
  v1 targets local endpoints + browser-callable hosted ones.
- **No second provider shape beyond OpenAI-compatible** in v1 (an Anthropic-shape
  adapter is a trivial future addition behind the same interface — the abstraction
  is proven by the `fake` adapter's swappability, AC6).
- **No learned text embeddings.** Grounding is **geometric** (projection ranking +
  lit set + bridges) over authored positions. Embedding free text into GA space is
  a later requirement (R-0007 §4).
- **No conversation persistence** across reload in v1 (config persists; chat is
  in-memory). No identity/profile (Phase 8), no multiplayer/shared chat (Phase 5),
  no TTS/avatar (Phase 6/9), no graph-mutating tool-use by the model.
- **No reputation magnitude dialing.** The companion reads orientation to ground
  itself; it never lets the visitor set a score and never writes reputation/config/
  chat to the CRDT (CLAUDE.md §4/§7).

## 5. Open questions

Resolved for acceptance:

- **Provider set & transport — RESOLVED.** One **OpenAI-compatible** adapter
  (hosted + local, one `/chat/completions` shape) + a **fake** adapter; **browser-
  direct, BYO key**, no backend. Presets: Local-Ollama (no key) and Hosted (key).
- **What "graph-grounded" means — RESOLVED.** Lit set + **top-k nearest by
  projection** (new additive `nearest_plateaus`) + incident bridges, assembled by a
  pure context-builder. Ranking is done in Rust (the projection is GA math); JS only
  formats.
- **Persona → voice — RESOLVED.** A short per-archetype **voice brief** (tone/stance
  only, no numbers), forming the system message alongside the grounding block.
- **Conversation persistence — RESOLVED.** Config persists in `localStorage`;
  conversation is in-memory (resets on reload) for v1.

Deferred (not blocking): an Anthropic-shape adapter; an optional CORS proxy; whether
to persist transcripts; embedding free text into GA space.

## 6. Acceptance criteria

- [ ] **AC1 (R-0007 AC1)** → a model-setup screen offers ≥2 provider options
  including a **local** one and a hosted one, with endpoint/model/optional-key,
  persisted to `localStorage`; unconfigured state is clearly shown and the app ships
  no key (`fake` fallback keeps the UI usable).
- [ ] **AC2 (R-0007 AC2)** → after choosing a persona, a companion panel is
  **continuously visible** in the persona's voice/name; changing persona updates
  voice + grounding with **no reload**.
- [ ] **AC3 (R-0007 AC3)** → each turn's context is built from GA graph queries
  (reachable + `nearest_plateaus` + bridges) by the pure `buildGroundingContext`;
  two personas yield **observably different** context (unit-tested + browser-checked).
- [ ] **AC4 (R-0007 AC4)** → with a model configured, a sent message returns a reply
  in the panel carrying the AC3 grounding; the `fake` provider exercises the
  round-trip offline; unconfigured/HTTP/network errors surface gracefully — no
  uncaught console errors.
- [ ] **AC5 (R-0007 AC5)** → `modelConfig` (incl. key), conversation, persona, and
  `localRep` never enter the CRDT; `BroadcastChannel` carries only `doc` bytes;
  `doc.root_keys()` stays `{bridges, plateaus, resources, votes}` (logged); the key
  is never logged. `nearest_plateaus` is read-only.
- [ ] **AC6 (R-0007 AC6)** → `model.js` + `companion-context.js` (+ `companion-voice.js`)
  are pure & node-unit-tested; providers swappable behind one interface; the Rust
  change is **additive** (`nearest_plateaus` shares `projection_score` with
  `is_reachable`, no behaviour change) with host + wasm tests. `cargo test
  --workspace`, `wasm-pack test --node`, clippy `-D warnings` (host + `wasm32`),
  `cargo fmt` green; page loads with no uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | **Browser-direct, bring-your-own-model**; no backend, no shipped key | The owner chose generality (all models incl. local) over a vendor; browser-direct keeps the companion a pure local lens with zero §7 risk (Obsidian posture) |
| 2026-05-31 | One **OpenAI-compatible** adapter covers hosted **and** local (Ollama/LM Studio/llama.cpp) + a **fake** adapter for offline/CI | A single `/chat/completions` shape spans the most models for the least code; the fake adapter proves the interface is swappable (AC6) and makes the round-trip testable offline |
| 2026-05-31 | Grounding = lit set + **top-k nearest by projection** + incident bridges; ranking added as **additive `mp-graph` `nearest_plateaus`** reusing the fog projection | "Nearest to my orientation" is the same GA projection the fog uses — the graph store as a retrieval substrate (the differentiator). Ranking is GA math, so it lives in Rust, not JS (CLAUDE.md §1/§4) |
| 2026-05-31 | Refactor `is_reachable`/`reachable_plateaus` to share a private `projection_score` with `nearest_plateaus` | Guarantees fog and retrieval cannot drift; keeps the addition behaviour-preserving for existing tests |
| 2026-05-31 | `model.js`/context/voice are **pure**; the single `fetch` lives in `companion.js` and is injectable | Keeps the model layer node-unit-testable (AC6) and the impure surface tiny; honors the project's "pure, unit-tested mapping" pattern |
| 2026-05-31 | Persona → a short **voice brief** (tone only, no numbers); system = voice + grounding | Embodiment without violating "orientation, not stats" (CLAUDE.md §4 / R-0006) |
| 2026-05-31 | Config persists in `localStorage`; conversation in-memory (resets on reload) for v1 | Matches the "ephemeral local lens" stance; config reuse is the only thing worth persisting now |
| 2026-05-31 | API key stored in `localStorage`, sent only in the request `authorization` header, never logged/synced | BYO-key POC tradeoff (same as Obsidian); §7 forbids it touching synced state, and it must never be logged |

## Changelog

- 2026-05-31 created (Draft) — settles all four R-0007 open questions; pending
  architect design review, then status → Accepted (and R-0007 → Accepted).
- 2026-05-31 architect design review → APPROVE WITH CHANGES. Architecture rules
  §1/§2/§4/§5/§7 all verified honored against source; the additive Rust change
  confirmed mechanical and invariant-preserving (`plateaus()` iterator `graph.rs:66`,
  `PlateauNode.id` public field `types.rs:33`, `position()` `types.rs:68`,
  `WizardReputation`/`parse_reputation` decode path `convert.rs:41`,
  `ga::project` `ga.rs:84`; `is_reachable` projection inline at `graph.rs:80-87`).
  Folded in: (1) §2.1 snippet uses the real accessors — `p.id` (field, not method)
  and `plateau.position()` — and labels `projection_score` as **newly extracted**
  from `is_reachable` (single source of truth, behaviour-preserving); (2) the new
  query's decode + ranking-to-DTO marshalling moves to a pure host-tested
  `convert::nearest_dtos` with a `NearestDto`, `lib.rs` a one-line delegator
  (thin-skin rule); (3) `k` is validated **at the wasm boundary** (`f64` →
  reject non-finite/negative, floor fractional, clamp) so no panic crosses the FFI
  (§5); (4) the context-builder filters unknown ids in `nearest` (no
  `"undefined (…)"`); (5) `sendTurn` wraps `fetch` in try/catch so a CORS/DNS/offline
  rejection surfaces distinctly from an HTTP-status error (AC4); (6) clarified
  round-trip fidelity is proven against the real `openai-compatible` adapter with an
  **injected fake `fetch`**, not the `kind==="fake"` short-circuit; (7) added host
  tests for tie-break-by-id and the behaviour-preserving `projection_score`
  extraction. Status Draft → Accepted (R-0007 → Accepted).
- 2026-05-31 Implemented exactly as specced and QA-signed-off (PASS on all six
  ACs). All gates green (cargo test/clippy/fmt host + wasm32, wasm-pack test --node
  with the new nearest test, node --test 26 pass) and AC1–AC5 browser-verified on
  the live preview. Status Accepted → Implemented (R-0007 → Met).
