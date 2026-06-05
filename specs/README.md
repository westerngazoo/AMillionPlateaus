# Specs

A **spec** states *how* a feature is built — the technical design that realizes
one or more requirements. Requirements
([`requirements/`](../requirements/)) are the WHAT; specs are the HOW.

The project is built spec-first: before any code is written, the feature is
described here as a numbered spec — design, code outline, non-goals, acceptance
mapping — and reviewed by the `architect` agent.

## Process

1. **Draft.** Once the governing requirement is `Accepted`, create a spec from
   [`TEMPLATE.md`](TEMPLATE.md), numbered `SPEC-NNNN`: `NNNN-short-name.md`.
2. **Design review.** The `architect` agent reviews the design and code outline
   against the requirement (`CLAUDE.md` §4, step 2).
3. **Accept.** When the design is sound and unambiguous, status → `Accepted`.
   Only then does implementation begin.
4. **Implement.** Code satisfies exactly the accepted spec and cites its id.
5. **Verify.** Acceptance criteria are checked; status → `Implemented`.

A spec may later become `Superseded` or `Revised` (amended in place, logged).

## Status values

`Draft` → `Accepted` → `Implemented` · (or `Superseded` / `Revised`)

## Relationship to requirements

Every spec links back to the requirement(s) it realizes via its **Realizes**
field. The build order across requirements and specs is in
[`ROADMAP.md`](../ROADMAP.md).

## Index

| Spec | Title | Realizes | Status |
|------|-------|----------|--------|
| [SPEC-0001](0001-mp-graph-foundation.md) | mp-graph foundation crate | R-0001 | Implemented |
| [SPEC-0002](0002-ga-reputation-and-fog.md) | GA reputation engine + fog reachability | R-0002 | Implemented |
| [SPEC-0003](0003-wasm-graph-bridge.md) | mp-wasm: the WASM graph bridge | R-0003 | Implemented |
| [SPEC-0004](0004-crdt-sync.md) | mp-crdt: Automerge-backed graph sync | R-0004 | Implemented |
| [SPEC-0005](0005-web-fog-world-poc.md) | Web fog-world POC: CRDT-in-wasm + a 2D synced map | R-0005 | Implemented |
| [SPEC-0006](0006-persona-creator.md) | Persona creator: a client-side starting-orientation lens | R-0006 | Implemented |
| [SPEC-0007](0007-companion-graph-grounded.md) | Companion: provider-agnostic model client + GA-graph-grounded context | R-0007 | Implemented |
| [SPEC-0008](0008-ga-graph-store-generalization.md) | Generalize `mp-graph` into a domain-agnostic geometric graph store (RFC-0001 Scope A) | R-0008 | Implemented |
| [SPEC-0009](0009-visitor-authored-personas.md) | Visitor-authored personas: a pure `authorPersona` factory + authoring UI over the existing seed mapping | R-0009 | Implemented |
| [SPEC-0010](0010-nostr-identity-signed-events.md) | Wizard identity: Nostr-signed events + rank recomputed from the verified log (relay + discovery) | R-0010 | Accepted |
| [SPEC-0011](0011-plateau-authoring.md) | Plateau Authoring: Draft DB POC — pure factory + form replacing the add-plateau stub | R-0011 | Implemented |
| [SPEC-0012](0012-browser-durable-graph.md) | Browser-durable graph: IndexedDB snapshot of the CRDT doc (save/load bindings + persistence module) | R-0012 | Implemented |
| [SPEC-0013](0013-bridge-authoring.md) | Bridge Authoring: pure buildBridge factory + Draft Bridge form over the existing add_bridge binding | R-0013 | Implemented |
| [SPEC-0014](0014-trail-markers.md) | Trail Markers: Resource::new + add_resource binding + ResourceDto/render + buildResource factory/form | R-0014 | Implemented |
| [SPEC-0015](0015-vote-crystallize.md) | Vote → Crystallize: derive resource state from the votes tally in to_graph + place-a-stone form | R-0015 | Accepted |
