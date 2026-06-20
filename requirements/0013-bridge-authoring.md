# R-0013 — Bridge Authoring: connect two plateaus with a named concept

- **Status:** Met
- **Milestone:** POC — Draft DB (connectivity)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** R-0011 (plateau authoring), R-0012 (browser durability), R-0005 (sync)
- **Realized by:** SPEC-0013 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

R-0011 lets a wizard add plateaus; R-0012 makes them durable. But the world's
*connective tissue* — the bridges that carry concept labels between plateaus —
is still frozen at the seed. This requirement lets a wizard **author a bridge**:
pick two existing plateaus, give the connection a **concept label** (e.g.
"frequency ratios", "linear transformation"), and the bridge enters the shared
CRDT graph, renders as a labelled line, syncs to other open tabs, and survives a
reload (via R-0012's snapshot).

The bridge's **rotor is geometry computed in Rust** (garust's geometric product
of the two endpoint positions, even-grade-projected and normalized — exactly as
`Bridge::between` already does). JavaScript supplies only the two endpoint ids
and the human concept label; it never computes or supplies GA values
(CLAUDE.md §1).

## 2. Rationale

The VISION frames bridges as the heart of the rhizome — connections that "emerge
laterally" at conceptual intersection points, each carrying a concept label and a
geometric orientation. A world you can add islands to but not *connect* is a
scatter of points, not a knowledge graph. Bridge authoring is the operation that
turns the authored plateaus (R-0011) into a navigable web of named relationships.

It is also a thin, low-risk increment: `WasmCrdtDoc::add_bridge(from, to,
concept)` already exists and computes the rotor in Rust; `render.js` already
draws bridges with their concept labels; R-0012 already persists the whole doc
(bridges included) and R-0005 already syncs it. The work is a pure validation
factory plus a small form — the same shape as R-0011's plateau authoring.

## 3. Acceptance criteria

- **AC1 — Bridge authoring form.** Alongside the Draft Plateau form there is a
  **"Draft Bridge" form** with: a **from** plateau select, a **to** plateau
  select (both populated from the existing plateaus, by human name), a **concept
  label** text input, and a **submit** button. The selects are rebuilt from the
  current graph when the form is opened, so plateaus authored this session
  (R-0011) are selectable.

- **AC2 — New bridge appears in the fog-world.** On submit, the bridge is added
  to the CRDT and drawn as a labelled line between its two plateaus in the same
  frame (`render.js` already labels bridges with their concept).

- **AC3 — Validation, no degenerate bridges.** The form rejects, with an inline
  error and no CRDT write: a **self-loop** (from === to), a **missing endpoint**,
  and an **empty concept label** (or applies a sensible fallback label). An
  unknown endpoint id (should not happen from the selects) surfaces as a handled
  error, never an uncaught throw.

- **AC4 — Syncs across tabs and survives a reload.** The authored bridge
  propagates to other open tabs via the existing BroadcastChannel CRDT path
  (R-0005) and is included in the IndexedDB snapshot (R-0012), so it is still
  present after a full close/reload with no other tab open.

- **AC5 — The rotor stays in Rust (CLAUDE.md §1).** The bridge's rotor and
  dominant grade are computed by `Bridge::between` (garust) in the Rust core;
  JavaScript passes only `(from_id, to_id, concept)` and never reads, writes, or
  derives any GA coefficient. No new math in JS, no new math library.

- **AC6 — Pure `buildBridge` factory, unit-tested.** A new pure
  `buildBridge({ from, to, concept })` validates and normalises (trim concept +
  fallback; reject empty/equal endpoints) and returns the argument shape
  `add_bridge` accepts as a tagged result (`{ from, to, concept, error: null }`
  or `{ error }`). Tested via `node --test`, no WASM: distinct valid endpoints →
  ok; from === to → error; missing endpoint → error; blank concept → fallback or
  error (spec decides); deterministic.

- **AC7 — Attribution deferred (documented).** The bridge is recorded with
  `created_by = nil` as today. Threading the wizard's identity requires
  reconciling the graph's `WizardId` (a `Uuid`) with R-0010's Nostr pubkey (a
  secp256k1 hex), which is a separate, larger change. (Note: R-0011 AC7
  forward-referenced "R-0012" for this; R-0012 became browser durability, so
  attribution is now explicitly tracked as a **future requirement**, not R-0012
  and not R-0013.)

- **AC8 — Green across all suites.** `cargo test --workspace`, `wasm-pack test
  --node`, `node --test apps/web/src/*.test.mjs`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt --all --check` all green; the page authors a bridge,
  reloads, and shows it with no uncaught console errors.

## 4. Constraints & non-goals

- **Reuse the existing binding.** `WasmCrdtDoc::add_bridge(from, to, concept)` is
  the only write path; no new Rust unless strictly required (none expected — the
  binding already exists and computes the rotor).
- **Bridges are CRDT graph state**, like plateaus — not reputation-bearing signed
  events. (DECENTRALIZATION.md lists a `BridgeProposal` Nostr event kind; wiring
  bridges as *signed events* with provenance/anti-spam is future work, consistent
  with how plateaus are authored unsigned this phase.)
- **Reachability is positional, not adjacency-based.** A bridge draws a labelled
  line and records a geometric relationship; it does **not** change which
  plateaus are lit (fog is the GA projection of reputation vs. position). So
  bridge authoring grows connectivity, not reach.
- **Existing plateaus only.** You bridge plateaus that already exist; the form
  does not create plateaus (that is R-0011).
- **Non-goals:** click-two-plateaus-on-canvas UX (a later enhancement; the form
  with selects avoids conflict with click-to-traverse); bridge editing/deletion;
  signed `BridgeProposal` events; wizard attribution (see AC7); bidirectional
  asymmetry UI (the rotor already encodes A→B orientation; exposing it is later).

## 5. Open questions

- **Blank concept label:** reject with an inline error, or accept with a fallback
  like "relates to"? (Spec decides; leans toward a fallback so authoring is
  low-friction, matching R-0011's name fallback.)
- **Endpoint list scope:** list all plateaus (lit + fogged) or only lit ones?
  (Leans toward all — you may want to connect toward the fog.)
- **Duplicate bridges:** allow multiple bridges between the same pair (different
  concepts), or dedupe? (Leans toward allow — different concept labels are
  legitimately different edges.)

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Bridge authoring mirrors R-0011: pure factory + form, into the CRDT, rotor in Rust | Thinnest valuable increment; reuses the existing `add_bridge` binding and bridge rendering; durable + synced for free |
| 2026-06-02 | Bridges are CRDT state, not signed events, this phase | Consistent with unsigned plateau authoring; signed `BridgeProposal` provenance is future work |
| 2026-06-02 | Attribution stays deferred and is re-homed off the stale R-0012 reference | R-0012 became durability; `WizardId`(Uuid) vs Nostr pubkey reconciliation is a separate future requirement |

## Changelog

- 2026-06-02 created (Draft) — pending SPEC-0013 + architect design review, then acceptance.
- 2026-06-02 SPEC-0013 drafted + architect-reviewed (APPROVE-WITH-NITS, all folded).
  **Status → Accepted.**
- 2026-06-02 implemented (commit f9df5e7) and **QA sign-off → PASS** (all AC1–AC8
  met; every gate green; browser-verified end-to-end incl. durability across a
  dev-server restart). **Status → Met.**
