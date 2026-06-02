# R-0007 — Companion: an always-present, graph-grounded AI guide that embodies your persona

- **Status:** Met
- **Milestone:** Phase 4 — Alebrije Service (companion, brought forward as a POC extension)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-31
- **Depends on:** R-0003, R-0005, R-0006
- **Realized by:** SPEC-0007
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A visitor in the fog-world must have an **always-present AI companion** that
*embodies their persona* and is **grounded in the knowledge graph**. The
companion is not a one-shot screen: once a persona is chosen (R-0006) the
companion is continuously on-screen as the visitor explores, speaking in that
archetype's voice and oriented toward that persona's domain. Choosing or
changing the persona changes *who the companion is* — its voice, its starting
orientation, and the part of the geometry it foregrounds — without a reload.

The companion talks to a **model the visitor configures themselves**. A
**setup screen** lets the visitor point the app at *any* model — a hosted
provider (e.g. an Anthropic- or OpenAI-style API) **or a local model** running
on their own machine — by supplying an endpoint, a model name, and (for hosted
providers) their own key. This is the Obsidian-style "bring your own model"
posture: the app ships **no** key and is not tied to one vendor.

The differentiator over a generic chat box is that the companion is **grounded
in the GA graph**. Before each turn, the app assembles context by **querying
the graph geometrically** — what the visitor's current orientation makes
reachable, which plateaus sit nearest that orientation, and how those plateaus
tie together through bridges — and gives the model that structured grounding
rather than a flat dump. Because position in this world is geometry, "what is
near me / what connects to this" is a spatial query, and that is the advantage
the graph store confers: relevant, orientation-aware context the model could
not assemble on its own.

The companion, its conversation, and the model configuration are a **per-visitor
local lens**, exactly like the persona and its reputation (R-0006): they live in
the tab/browser and are **never synced** and **never enter the CRDT**.

## 2. Rationale

R-0006 made "who you are" visibly change "what you can see." But after choosing,
the persona disappears — there is no ongoing presence, and the central promise
of the world (a *companion* that guides you through a knowledge geometry) is not
yet felt. Making the companion always-present and persona-embodying turns the
abstract lens into a character the visitor travels with, which is how the
eventual Alebrije companion (Phase 4) is meant to work.

Grounding the companion in the graph is the point of having built a *geometric*
store at all. A flat chatbot ignores the structure; a graph-grounded companion
uses proximity and connection in GA space to decide what is relevant *to this
visitor, right now, given their orientation*. This is the first time the project
demonstrates the graph store as a **retrieval substrate**, not just a fog map —
and it does so without a vendor lock-in, because the model is the visitor's
choice. It is also a concrete, user-facing payoff for the "extract the GA graph
store" direction (docs/rfcs/0001): the same geometric queries that light the fog
are what feed the companion.

## 3. Acceptance criteria

- **AC1 — Model setup, provider-agnostic.** The app presents a **setup screen**
  where the visitor configures a model: a **provider kind** offering at least two
  options including a **local** option (e.g. a local Ollama-style endpoint) and a
  hosted/HTTP option, plus an **endpoint URL**, a **model name**, and an optional
  **API key** (for hosted providers). The configuration is persisted **locally**
  (e.g. `localStorage`) and can be edited later. Until a model is configured, the
  companion clearly indicates it needs setup and offers the screen; the app never
  ships or hard-codes a key.
- **AC2 — Always-present, persona-embodying companion.** After a persona is
  chosen, a **companion panel is continuously visible** while exploring (not a
  dismissable one-shot overlay). It is presented in the **active persona's voice**
  (name/archetype). **Changing the persona** changes the companion's voice and
  orientation **without reloading the page**, consistent with R-0006 AC4.
- **AC3 — Graph-grounded context.** Each turn sent to the model includes context
  **derived from GA graph queries** about the visitor's current state: at minimum
  the active persona's orientation, the currently **reachable/lit** plateaus, the
  plateaus **nearest** that orientation, and the **bridges** among them. The
  context is produced by a **pure context-builder**. Two **different personas**
  produce **observably different** grounding context for the same question.
- **AC4 — A working round-trip.** With a model configured, the visitor can send a
  message and receive a reply rendered in the companion panel, where the request
  carried the AC3 grounding. The path works against at least one real provider
  kind (a **local** model and/or a hosted one); for offline/CI verification a
  faithful **fake provider** stands in. Failures (unconfigured, network/HTTP
  error, bad key) surface a **graceful, non-crashing** message — no uncaught
  console errors.
- **AC5 — Local-only, never synced (CLAUDE.md §7, R-0005 AC7, R-0006 AC5).** The
  model configuration (including any **API key**), the conversation, and the
  persona/reputation remain **local to the tab/browser**. None of them enter the
  CRDT: the `BroadcastChannel` still carries only graph CRDT bytes, the synced
  document's root keys stay exactly `{bridges, plateaus, resources, votes}`, and
  no companion/config/chat/reputation field is added to `CrdtDoc`. No API key is
  ever written to synced state or logged.
- **AC6 — Pure, unit-tested, gates green.** The **model-provider abstraction**
  (provider kind → request/response shape) and the **graph context-builder**
  (graph state + orientation → grounding context) are **pure and unit-tested**
  (host/node, no live network, no wasm): a given orientation deterministically
  produces a given context, and providers are swappable behind one interface (the
  fake provider exercises the round-trip). Any Rust core change is **additive
  only** (e.g. a nearest-plateaus query) and preserves all existing invariants.
  `cargo test --workspace`, `wasm-pack test --node`, clippy `-D warnings`
  (host + `wasm32`), and `cargo fmt` stay green; the page loads with no uncaught
  console errors.

## 4. Constraints & non-goals

- **Client-only lens; reuse the audited core.** The companion is a front-end
  layer over `mp-graph`/`mp-wasm`. No new graph/GA/CRDT logic in JavaScript and no
  new math library. A Rust change is allowed **only** if a retrieval query (e.g.
  "k nearest plateaus to an orientation") cannot be expressed with existing wasm
  exports, and then it must be **additive** and invariant-preserving.
- **Bring your own model; no shipped secret.** The app must not contain or depend
  on any vendor key. Hosted providers that block browser-direct calls (CORS) may
  require an **optional thin local proxy**; the default posture favors what works
  directly from the browser (local models, CORS-permitting endpoints). The exact
  provider set and transport are settled in SPEC-0007.
- **`mp-crdt` stays reputation/companion-free (CLAUDE.md §7).** Nothing about the
  companion, its config, its key, the conversation, or reputation may enter the
  synced document.
- **Reputation stays earned geometry (CLAUDE.md §4).** The companion may *read*
  the visitor's orientation to ground itself; it must **not** let the visitor dial
  in a reputation magnitude/score, and it must not write reputation into the CRDT.
- **Non-goals:**
  - *Learned text embeddings / model training.* v1 grounds via **geometry**
    (proximity/connection in GA space over authored positions), not a learned
    text→vector embedding. Embedding arbitrary text into the GA space is a later
    requirement.
  - *Real identity / persisted cloud profile.* No Nostr keypair, no signed events,
    no server-side account — that is Phase 8. Config/chat are ephemeral local
    state; a reload may reset the conversation.
  - *Multiplayer / shared companion.* Other tabs do not see your companion or chat
    (not synced); shared presence is Phase 5.
  - *Voice / TTS / 3D avatar / cosmetics.* This is the 2D fog-world companion as
    text. Avatars are Phase 6/9.
  - *A general agent framework or tool-use.* v1 is a grounded conversational guide,
    not an autonomous agent that mutates the graph.

## 5. Open questions

- **Provider set & transport for v1.** Which provider kinds ship first (a local
  Ollama-style endpoint, an OpenAI-compatible `/chat/completions` shape, an
  Anthropic-style shape?), and browser-direct vs an optional `apps/alebrije`
  proxy for CORS-blocked hosted providers. **To settle in SPEC-0007.**
- **What "graph-grounded" concretely means for v1.** The exact retrieval: lit set
  + k-nearest-to-orientation + incident bridges, and whether "nearest" is a new
  `mp-graph`/`mp-wasm` query or assembled in JS from existing exports. **To settle
  in SPEC-0007.**
- **Persona → voice mapping.** How much of the system prompt an archetype carries
  (just a name/tone, or a fuller character brief), kept consistent with R-0006's
  "orientation, not stats" rule. **To settle in SPEC-0007.**
- **Conversation persistence.** Whether the chat persists across reload (local)
  or resets, and how config is validated/edited. **To settle in SPEC-0007.**

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Build the companion as a client-only extension of the R-0005/R-0006 POC; it embodies the active persona and is always present once chosen | Turns the persona lens into an ongoing character (the Phase-4 Alebrije, brought forward); reuses the audited core with no CRDT change and no §7 risk |
| 2026-05-31 | The companion is **model-agnostic, bring-your-own** via a setup screen supporting hosted **and local** models (Obsidian-style); the app ships no key | The visitor chose generality over a single vendor; a local model option keeps the lens fully local and avoids lock-in |
| 2026-05-31 | The companion is **grounded in the GA graph** via geometric retrieval (orientation → reachable/nearest plateaus + bridges), not a flat chat | This is the user-facing payoff of a *geometric* store: orientation-aware relevance is a spatial query the model cannot do alone — the graph store as a retrieval substrate |
| 2026-05-31 | Model config, conversation, and persona stay **local and never enter the CRDT** | Same §7 / local-lens guarantee as R-0006; an API key must never touch synced state |

## Changelog

- 2026-05-31 created (Draft) — pending settle of §5 open questions in SPEC-0007,
  architect design review, then acceptance. Captures the owner's direction: an
  always-present companion that embodies the persona, a provider-agnostic
  (hosted + local) model setup screen, and GA-graph-grounded context — all a
  local, never-synced lens.
- 2026-05-31 SPEC-0007 drafted and architect-reviewed (APPROVE WITH CHANGES,
  folded in); all four §5 open questions settled there (one OpenAI-compatible
  adapter covering hosted + local + a fake adapter; browser-direct bring-your-own
  key, no backend; grounding = lit set + top-k nearest-by-projection (additive
  `mp-graph::nearest_plateaus` reusing the fog projection) + bridges; per-archetype
  voice brief; config in `localStorage`, chat in-memory). Acceptance criteria
  unambiguous. Status Draft → Accepted
- 2026-05-31 Implemented and QA-signed-off. Additive `mp-graph::nearest_plateaus`
  (sharing the extracted `projection_score` with the fog `is_reachable`), the
  `mp-wasm` `nearest_plateaus` FFI with k-validation, and the pure JS companion
  (`model.js`, `companion-context.js`, `companion-voice.js`, `companion.js`) plus
  the setup overlay and companion panel in `apps/web`. All gates green:
  `cargo test --workspace`, `wasm-pack test --node` (incl. the new nearest test),
  clippy (host + wasm32, `-D warnings`), `cargo fmt`, `node --test` (26 pass).
  Browser-verified AC1–AC5 on the running preview; AC3/AC4 proven by deterministic
  pure tests. QA verdict PASS on all six ACs. Status Accepted → Met
