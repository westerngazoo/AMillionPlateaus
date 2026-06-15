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
| [R-0017](0017-native-graph-host.md) | Native graph host: the durable redb backing, wired (mp-host CLI) | Infra | Met |
| [R-0018](0018-webrtc-p2p-sync.md) | WebRTC peer-to-peer sync: two devices share a world, no server | POC — Cross-device (P2P) | Met |
| [R-0019](0019-onboarding-wayfinding.md) | Onboarding & wayfinding: career lens, travel-to-topic, first-run tutorial | POC — UX clarity | Met |
| [R-0020](0020-plateau-content.md) | Plateau content: a Markdown body with typeset math, and a read view | POC — Knowledge content | Met |
| [R-0021](0021-obsidian-import.md) | Obsidian vault importer: turn real notes into a world | POC — Knowledge content | Met |
| [R-0022](0022-physicist-lens.md) | Physicist lens: Physics as a first-class faced domain | POC — Knowledge content | Met |
| [R-0023](0023-study-view.md) | Study view: read, collect, and learn on a plateau | POC — Knowledge content | Met |
| [R-0024](0024-map-zoom-lod.md) | Map zoom, pan & label level-of-detail | POC — Navigation | Met |
| [R-0025](0025-vr-immersive-visualization.md) | VR / immersive visualization: walk the true 3D GA geometry | Phase 11 — Immersive (VR) | Accepted |
| [R-0026](0026-offline-study-digest.md) | Offline study digest: the companion helps with no model connected | POC — Knowledge content | Met |
| [R-0027](0027-seeded-example-resources.md) | Seeded example resources: the world ships with things to read | POC — Knowledge content | Met |
| [R-0028](0028-cross-cutting-resources.md) | Cross-cutting resources: a book that spans topics | POC — Knowledge content | Met |
| [R-0029](0029-clickable-bridges.md) | Clickable bridges: open a connection | POC — Navigation | Met |
| [R-0030](0030-topic-mastery.md) | Topic mastery: close a topic you've studied (self-tested, signed) | POC — Knowledge content | Met |
| [R-0031](0031-community-approved-topics.md) | Community-approved topics: a topic the crowd has mastered | POC — Knowledge content | Accepted |
