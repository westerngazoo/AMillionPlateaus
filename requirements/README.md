# Requirements

A **requirement** states *what* the project must do — a capability or property,
from the problem perspective, independent of implementation. Requirements are
the WHAT; [`specs/`](../specs/) are the HOW.

Every requirement is decided **together** (owner + Claude) before a spec is
written, and every requirement is owned by a `qa` agent run that verifies it.

## Process

1. **Discuss.** Owner and Claude agree the capability and its acceptance
   criteria. See [`CLAUDE.md`](../CLAUDE.md) §4.
2. **Record.** Create a file from [`TEMPLATE.md`](TEMPLATE.md), numbered
   `R-NNNN` (next free 4-digit id): `NNNN-short-name.md`.
3. **Accept.** When acceptance criteria are unambiguous, status → `Accepted`.
   Only then may a spec realize it.
4. **Realize.** One or more `SPEC-NNNN` in `specs/` implement the requirement.
5. **Verify.** The `qa` agent, scoped to this `R-NNNN`, confirms every
   acceptance criterion. Status → `Met`.

## Status values

`Draft` → `Accepted` → `Met` · (or `Superseded`)

## Relationship to specs

A requirement links forward to the spec(s) that realize it; a spec links back to
the requirement(s) it satisfies. The mapping is maintained in
[`ROADMAP.md`](../ROADMAP.md).

## Index

| Req | Title | Milestone | Status |
|-----|-------|-----------|--------|
| [R-0001](0001-foundation-knowledge-graph.md) | Foundation: core knowledge graph with GA invariants | Phase 0 | Met |
| [R-0002](0002-ga-reputation-and-fog.md) | GA reputation, Sybil resistance, and fog reachability | Phase 1 | Met |
| [R-0003](0003-wasm-graph-bridge.md) | WASM bridge: the knowledge graph, queryable from the browser | Phase 2 | Met |
| [R-0004](0004-crdt-sync.md) | CRDT sync: two clients converge on graph state without a server | Phase 3 | Met |
| [R-0005](0005-web-fog-world-poc.md) | Playable web POC: a navigable fog-world that syncs between two browser tabs | POC | Met |
| [R-0006](0006-persona-creator.md) | Persona creator: choose a starting orientation in the knowledge geometry | POC | Met |
| [R-0007](0007-companion-graph-grounded.md) | Companion: an always-present, graph-grounded AI guide that embodies your persona | Phase 4 | Met |
| [R-0008](0008-ga-graph-store-generalization.md) | Generalize `mp-graph` into a domain-agnostic geometric graph store (RFC-0001 Scope A) | Infra | Met |
| [R-0009](0009-visitor-authored-personas.md) | Visitor-authored personas: craft your own lens, not just pick a card | POC | Met |
| [R-0010](0010-nostr-identity-signed-events.md) | Wizard identity: Nostr-signed events and verifiable, recomputed rank | Phase 8 | Met |
| [R-0011](0011-plateau-authoring.md) | Plateau Authoring: draft new knowledge nodes into the fog-world | POC — Draft DB | Met |
| [R-0012](0012-browser-durable-graph.md) | Browser-durable graph: the Draft DB survives a reload (IndexedDB snapshot) | POC — Draft DB | Met |
| [R-0013](0013-bridge-authoring.md) | Bridge Authoring: connect two plateaus with a named concept | POC — Draft DB | Met |
| [R-0014](0014-trail-markers.md) | Trail Markers: anchor a note or resource to a plateau | POC — Draft DB | Met |
| [R-0015](0015-vote-crystallize.md) | Vote → Crystallize: community votes solidify a marker into terrain | POC — Draft DB | Met |
| [R-0016](0016-presence.md) | Presence: see other wizards as silhouettes in the fog | POC — Multiplayer presence | Met |
| [R-0017](0017-native-graph-host.md) | Native graph host: the durable redb backing, wired (mp-host CLI) | Infra | Accepted |
