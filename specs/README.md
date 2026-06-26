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
| [SPEC-0010](0010-nostr-identity-signed-events.md) | Wizard identity: Nostr-signed events + rank recomputed from the verified log (relay + discovery) | R-0010 | Implemented |
| [SPEC-0011](0011-plateau-authoring.md) | Plateau Authoring: Draft DB POC — pure factory + form replacing the add-plateau stub | R-0011 | Implemented |
| [SPEC-0012](0012-browser-durable-graph.md) | Browser-durable graph: IndexedDB snapshot of the CRDT doc (save/load bindings + persistence module) | R-0012 | Implemented |
| [SPEC-0013](0013-bridge-authoring.md) | Bridge Authoring: pure buildBridge factory + Draft Bridge form over the existing add_bridge binding | R-0013 | Implemented |
| [SPEC-0014](0014-trail-markers.md) | Trail Markers: Resource::new + add_resource binding + ResourceDto/render + buildResource factory/form | R-0014 | Implemented |
| [SPEC-0015](0015-vote-crystallize.md) | Vote → Crystallize: derive resource state from the votes tally in to_graph + place-a-stone form | R-0015 | Implemented |
| [SPEC-0016](0016-presence.md) | Presence: ephemeral silhouettes over a separate BroadcastChannel (presence.js + render) | R-0016 | Implemented |
| [SPEC-0017](0017-native-graph-host.md) | Native graph host: mp-host CLI (seed/stats/merge) over the redb CrdtStore | R-0017 | Implemented |
| [SPEC-0018](0018-webrtc-p2p-sync.md) | WebRTC P2P sync: a data-channel transport for the CRDT pump (webrtc.js + manual signaling) | R-0018 | Implemented |
| [SPEC-0019](0019-onboarding-wayfinding.md) | Onboarding & wayfinding: career-lens copy, pure `centerOn` travel, remembered first-run tutorial | R-0019 | Implemented |
| [SPEC-0020](0020-plateau-content.md) | Plateau content: Markdown body + vendored-KaTeX typeset math + a read view | R-0020 | Implemented |
| [SPEC-0021](0021-obsidian-import.md) | Obsidian vault importer: mp-host `import` (pure parse → GA position → blob) + browser "Import a world" | R-0021 | Implemented |
| [SPEC-0022](0022-physicist-lens.md) | Physicist lens: PHYSICS domain row + archetype + Motion trailhead (seeds extracted to seeds.js) | R-0022 | Implemented |
| [SPEC-0023](0023-study-view.md) | Study view: stone-ranked resources + inline add + plateau-scoped companion (pure study.js) | R-0023 | Implemented |
| [SPEC-0024](0024-map-zoom-lod.md) | Map zoom/pan (cursor-anchored `zoomAt`) + label overlap-culling (`planLabels`) | R-0024 | Implemented |
| [SPEC-0025](0025-vr-immersive-visualization.md) | VR/immersive: Godot client over the unchanged core (`GraphSource`, native GDExtension + web wasm, pure `place_node`/`plan_labels`) | R-0025 | Accepted |
| [SPEC-0026](0026-offline-study-digest.md) | Offline study digest: pure `offline-digest.js` behind the study actions when no model is connected | R-0026 | Implemented |
| [SPEC-0027](0027-seeded-example-resources.md) | Seeded example resources: fixed-id `seed_resource` + `SEED_RESOURCES` (Calculus/Algebra/Harmony) | R-0027 | Implemented |
| [SPEC-0028](0028-cross-cutting-resources.md) | Cross-cutting resources: pure URL threading (`normalizeUrl`/`crossLinks`) + "Also covers" + multi-pin | R-0028 | Implemented |
| [SPEC-0029](0029-clickable-bridges.md) | Clickable bridges: pure `pickBridge` hit-test + read-only connection view (`openBridge`) | R-0029 | Implemented |
| [SPEC-0030](0030-topic-mastery.md) | Topic mastery: `KIND_MASTERY` signed event + pure `masteredTopics` + self-tested "Mark as mastered" + ✓ (recompute unchanged) | R-0030 | Implemented |
| [SPEC-0031](0031-community-approved-topics.md) | Community-approved topics: pure `communityApproved` distinct-wizard count + bedrock overlay ring | R-0031 | Implemented |
| [SPEC-0032](0032-ai-checked-proof-mastery.md) | Math mastery by AI-checked proof: pure `parseVerdict`/`buildProofGrading` + model-gated "Prove it" box wired to `signMastery` | R-0032 | Implemented |
| [SPEC-0033](0033-browsable-progress-map.md) | Browsable progress map: ungate clicks + `visitedTopics` + progress palette (unexplored/studying/mastered) + covered trail | R-0033 | Implemented |
| [SPEC-0034](0034-cas-checked-answers.md) | CAS-checked answers: self-contained equivalence engine (seeded sampling + numeric-derivative) + drill generator + author `solve` blocks, gating `signMastery` (model-free) | R-0034 | Implemented |
| [SPEC-0035](0035-trusted-master-weighting.md) | Trusted-master weighting: weighted `communityApproved` (summed domain reach ≥ bar) via injected `rank_wizards` reach; Sybils grade-collapse to ~0 | R-0035 | Implemented |
| [SPEC-0036](0036-persist-share-mastery.md) | Persist & share: durable local `mp.proofs` store + opt-in `KIND_PROOF` signed publish (recompute ignores it); pure `publishedProofs` | R-0036 | Implemented |
| [SPEC-0037](0037-mobile-web.md) | Mobile web: responsive `@media` (bottom-sheet drawer, wrapping HUD) + touch pan/pinch (pure `pinch` reducer + `touch-action:none`) | R-0037 | Implemented |
| [SPEC-0038](0038-author-your-own-domain.md) | Author your own domain: pure `authorDomain` (name-derived uuid) + `SUGGESTED_DOMAINS` + `allDomains()` merge + creator "Add a lens"; a custom lens is any grade-1 direction (no core change) | R-0038 | Implemented |
| [SPEC-0039](0039-learning-paths.md) | Learning paths: Rust-core `Path` + signed `KIND_PATH` (30082, recompute ignores it), local-keep + opt-in publish (mirrors R-0036), grounded on the domain meet (RFC-0002 §2.5, deferred to Phase 1) | R-0039 | Draft |
