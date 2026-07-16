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
| [R-0031](0031-community-approved-topics.md) | Community-approved topics: a topic the crowd has mastered | POC — Knowledge content | Met |
| [R-0032](0032-ai-checked-proof-mastery.md) | Math mastery by AI-checked proof: write a proof, the model judges it | POC — Knowledge content | Met |
| [R-0033](0033-browsable-progress-map.md) | Browsable progress map: explore freely, color by progress, trace your trail | POC — Navigation | Met |
| [R-0034](0034-cas-checked-answers.md) | CAS-checked answers: solve it, the machine verifies it (deterministic, offline) | POC — Knowledge content | Met |
| [R-0035](0035-trusted-master-weighting.md) | Trusted-master weighting: community approval by earned domain reach, not a head-count | POC — Knowledge content | Met |
| [R-0036](0036-persist-share-mastery.md) | Persist & share a proof/solution: keep it locally, publish it deliberately | POC — Knowledge content | Met |
| [R-0037](0037-mobile-web.md) | Mobile web: the fog-world works on a phone (responsive + touch) | POC — Reach | Met |
| [R-0038](0038-author-your-own-domain.md) | Author your own domain: more lenses than Math/Physics/Music (name + place a custom lens) | POC — Knowledge content | Met |
| [R-0039](0039-learning-paths.md) | Learning paths: author/follow/publish a route through the islands; paths intersect over grounded ground | POC — Knowledge content | Accepted |
| [R-0043](0043-view-pipeline-phase1.md) | View pipeline, Phase 1: extract the injectable render seam (pure view-model/Frame + canvasRenderer + pure hit-test), behaviour-preserving (RFC-0003) | Infra / DX | Accepted |
| [R-0044](0044-rhizome-drilldown.md) | Rhizome drill-down: select a term while reading → grow a nested, bridged, drillable plateau (companion-drafted); go as deep as you want | POC — Knowledge content | Draft |
| [R-0045](0045-rich-note-capture.md) | Rich note capture: external search deep-links (done) + QR-paired mobile photo of handwritten notes → attach + OCR via the connected multimodal companion | POC — Knowledge content | Draft |
| [R-0046](0046-in-browser-compute-cell.md) | In-browser compute cell: run real Python (Pyodide, numpy/sympy) on a plateau, offline & self-hosted; save a cell as a shareable "Notebook" resource | POC — Knowledge content | Accepted |
| [R-0047](0047-installable-pwa.md) | Installable offline PWA: install to desktop/phone/Boox; the whole app works with no network after one load | POC — Reach | Accepted |
| [R-0048](0048-deep-study-prompts.md) | Deep study: the NotebookLM prompt patterns (mental models, disagreements, deep quiz, hidden connections, gap map, Feynman), graph-grounded | POC — Knowledge content | Accepted |
| [R-0049](0049-model-quick-switch.md) | Local ⇄ hosted model quick-switch: one click between the free local runtime and the pasted-key provider, no re-pasting | POC — Reach | Accepted |
| [R-0050](0050-audio-overview.md) | Audio overview (🎧 model-written two-host episode + browser TTS, $0) + study pack: study guide, FAQ, flashcards, briefing, timeline | POC — Knowledge content | Accepted |
| [R-0051](0051-personal-library.md) | Personal library: pin your own PDFs (device-local, browser viewer, $0) + Drive links readable in the split pane | POC — Knowledge content | Accepted |
| [R-0052](0052-private-shelf.md) | Private shelf: per-plateau resources that never enter the CRDT — Boox notes + private book collection, publish-when-ready | POC — Knowledge content | Accepted |
| [R-0053](0053-suggested-path.md) | Suggested path: the app proposes your next route — continue, best existing, or a bridge-BFS generated walk from where you stand | POC — Knowledge content | Accepted |
| [R-0054](0054-gemini-native-adapter.md) | Native Gemini adapter: make Google's new `AQ.` keys work — `:generateContent` + `x-goog-api-key`, OpenAI↔Gemini translation incl. vision | POC — Reach | Accepted |
| [R-0055](0055-density-adaptive-layout.md) | Density-adaptive decluttering: clearance grows with graph size so dense imported vaults stay readable; seed world unchanged (salvaged from PR #41) | POC — Navigation | Accepted |
| [R-0056](0056-study-handoff-notepad.md) | Study without the API: hand off a topic to NotebookLM (owner's full prompt pack) / Gemini / AI Studio in a new tab, + a private per-topic Markdown notepad (local, autosaved) | POC — Reach | Accepted |
| [R-0057](0057-physics-ga-sia-lenses.md) | GA + SIA lenses over the physics-degree core: re-see the physics (mechanics→Maxwell→relativity→spin) through geometric algebra (∇F=J, rotors, spinors) and synthetic infinitesimals (ε²=0), with cross-lens + meet bridges | POC — Knowledge content | Accepted |
| [R-0058](0058-cross-device-capture-relay.md) | Cross-device "Scan Note": a tiny Cloudflare Worker + Durable Object relays the phone/Boox photo to the desktop over WSS (works off-LAN, free plan); completes R-0045 AC1–AC3 | POC — Knowledge content | Accepted |
| [R-0059](0059-menu-declutter.md) | Declutter the top toolbar: 15 buttons + the identity/relay row collapse into one compact bar (☰ Menu + HUD + status) with a grouped dropdown | POC — Reach | Accepted |
| [R-0060](0060-teach-me-lesson.md) | Guided “Teach me this topic”: a stepped Feynman lesson (summary → ground → analogy → example → check → teach-back → recall) sequencing the notes, audio, hand-off, notepad + mastery | POC — Knowledge content | Accepted |
| [R-0061](0061-course-builder.md) | 🎓 Build a course from a reference: hand-off for a parseable syllabus → paste → authored as one plateau per topic (in the active lens’ domain, stepped along its axis) + prerequisite bridges + a followable path, each topic carrying the R-0060 lesson | POC — Knowledge content | Accepted |
| [R-0062](0062-boot-resilience.md) | Boot resilience: never wedge on a skewed service-worker cache — code served network-first (no fresh-shell/stale-module skew), cache bumped, + an inline boot-guard that self-heals a failed boot (clear caches + reload, then a manual “Couldn’t load the world” panel); fixes the “all black” PWA report | POC — Reach | Accepted |
| [R-0063](0063-lesson-progress.md) | Resume your Teach-me lesson: the guided lesson remembers your step + a done flag per topic (localStorage), resumes where you left off, reflects state on the button (Teach me / Resume — step k/n / ✓ Reviewed), and rolls a built course up to “d/n studied” | POC — Knowledge content | Accepted |
| [R-0064](0064-course-continue.md) | One-tap “Continue → next topic”: a button on the course line flies to + opens the course’s first unfinished topic (hidden when you’re on it or the course is complete); makes a built course followable end to end | POC — Knowledge content | Accepted |
| [R-0065](0065-lens-path.md) | “Your path”: picking a lens opens its curriculum as a NUMBERED path (Start step + progress + one-tap Continue); adds a physics-core path + a lens→path map (slice 1 — the mechanism; deepening the content is R-0066/R-0067) | POC — Knowledge content | Accepted |
