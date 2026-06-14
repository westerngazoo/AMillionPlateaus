# R-0025 — VR / immersive visualization: walk the true 3D GA geometry

- **Status:** Draft
- **Milestone:** Phase 11 — Immersive (VR)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-13
- **Depends on:** R-0005 (render/projection + the synced world), R-0008 (domain-agnostic GA store), R-0016 (presence), R-0019 (travel/`centerOn`), R-0020/R-0023 (plateau read & study surfaces), R-0024 (camera + label level-of-detail). Conceptually extends the roadmap's Phase 7 "3D World".
- **Realized by:** _none yet — Draft_
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Render the world as an **immersive 3D / VR scene** you can stand inside. A
plateau's `position` is already a **Grade-1 multivector in Cl(3,0,0)** — three
real coordinates `(e1, e2, e3)` = Formal/Mathematical, Empirical/Physical,
Creative/Expressive. The current map (R-0005, R-0024) is a **2D projection** of
that geometry: `project.js` flattens it to `x = e1 − ½e2`, `y = e3 − ½e2`,
collapsing the empirical axis into a shared diagonal. This requirement adds a
view that **stops collapsing it** — placing each plateau at its true
`(e1, e2, e3)` point in a navigable space, built as a **Godot** 3D/XR client so
a full game engine (scene tooling, physics, shaders, animation, mature **OpenXR**
support, and a path to native + console targets) backs the immersive world —
explored on a headset or as flat 3D without one. It reads the **same** CRDT world
and signed-event reputation as the existing 2D web app, over a defined binding to
the existing Rust graph core. You walk the fog, see bridges as arcs in space,
watch reachability light the region around you, and meet other wizards as avatars
at their positions.

## 2. Rationale

The geometry is the whole thesis ("knowledge graph as geometry"), and it is
*natively 3D* — the 2D map was only ever a convenience projection. VR is the
honest rendering of what the data already is: the axes a lens orients toward
(e1/e2/e3) become real directions you can turn your head to. It directly serves
the owner's spatial-learning goal — studying a career path becomes literally
walking toward an orientation.

**Why Godot (owner decision, 2026-06-13): the stronger long-term foundation.** An
immersive world is an open-ended graphics/interaction surface — scene graph,
physics, shaders, animation, asset pipeline, and a mature, hardware-agnostic XR
stack (**OpenXR**), with a path to native and console targets a browser renderer
can't reach. A full engine pays for itself over the lifetime of the 3D/VR world,
which is the axis the owner is optimising for. The **GA/CRDT/reputation core does
not change** — the Rust crates (`mp-graph`, `mp-domain`, `mp-reputation`,
`mp-crdt`) and garust are consumed, not rewritten. The honest cost vs. the earlier
WebXR/three.js lean: Godot is a **separate client + runtime**, not "another
renderer in the existing web app," so two real pieces of work appear — (a) a
**binding** from the Godot client to the graph core (via GDExtension natively, or
a wasm bridge on web), and (b) a **delivery decision** (Godot Web export vs. a
native client) that determines whether the in-browser/zero-install property is
kept. Both are scoped in §5, not hand-waved. The decentralized, offline-first,
no-server values hold either way (CRDT P2P + local persistence travel with the
client).

## 3. Acceptance criteria

_Draft-level — to be sharpened into testable form before status → `Accepted`._

- **AC1 — True-geometry scene.** Each plateau is rendered at its Grade-1
  `(e1, e2, e3)` coordinates in an immersive Godot (OpenXR) scene, with the three
  world axes carrying the same meaning as the lens/domain orientation (e1 Formal,
  e2 Empirical, e3 Creative) — **no projection collapse**, unlike the 2D map.

- **AC2 — Fog & reach in 3D.** Reachable plateaus are lit and fogged ones
  dimmed/hidden, derived from the **same reachability core** (the projection
  threshold against the reputation multivector) as the persona/camera changes —
  **no new reputation math**, no `f32` reputation, reputation still recomputed
  from the signed log (CLAUDE.md §4, §7).

- **AC3 — Bridges & legible labels in space.** Bridges draw as 3D connectors
  between plateau positions; plateau/bridge labels are **billboarded** and
  **decluttered** (the R-0024 overlap-cull discipline adapted to the view
  frustum) so the scene stays readable at the imported-vault's density.

- **AC4 — Embodied navigation.** Locomotion (teleport and/or comfort-vignetted
  smooth movement) plus **"travel to a plateau"** that moves the rig to that
  plateau — the 3D analogue of R-0019 `centerOn`. Presence (R-0016) shows other
  wizards as avatars/silhouettes at their live positions.

- **AC5 — Study in-world.** Opening a plateau surfaces its Markdown/KaTeX body
  and stone-ranked resources (R-0020/R-0023) on an in-VR panel, and the
  companion stays reachable — reading/studying a topic does not require leaving
  immersive mode.

- **AC6 — Core untouched; flat-3D fallback; existing app unchanged.** The Godot
  client runs as **flat 3D** (no headset) and enters immersive mode when an
  OpenXR device is present. The **GA/CRDT/reputation core is not modified** — the
  Rust crates + garust are consumed through a defined binding, not rewritten — and
  the **existing 2D web app and every current flow stay intact** (the Godot client
  is additive, not a replacement). Existing suites stay green.

- **AC7 — One world, one data.** The Godot client reads the **identical** CRDT
  document and signed-event reputation as the 2D app; an edit made in one is
  visible in the other after sync; nothing authoritative is stored that isn't
  derivable from the graph (CLAUDE.md §6). Reputation is never persisted as a
  scalar or a CRDT field — it is recomputed from the signed log on both clients
  (CLAUDE.md §4, §7).

## 4. Constraints & non-goals

- **A view, not a new data model.** Space stays the three Grade-1 components
  `e1/e2/e3`; reputation's higher grades (bivectors/rotors) are **not**
  spatialized in v1. No 4th GA axis. The GA/CRDT/reputation core is consumed,
  never rewritten.
- **Decentralized + offline-first, regardless of delivery.** No server; the world
  syncs over the existing WebRTC + CRDT layer and persists locally. This must hold
  whether the Godot client ships as a **Web export** or a **native binary** — the
  delivery target (and thus whether the zero-install/in-browser property is kept)
  is the open question in §5, but the no-server/offline values are not negotiable.
- **Don't replace the 2D web app.** It stays as the fast, zero-install, legible
  default and the no-GPU fallback, and remains the primary surface for authoring;
  the Godot client is the richer 3D/VR companion.
- **Hardware-agnostic via OpenXR.** Godot's XR is OpenXR-based (Quest, PCVR, and
  others) — no single-vendor SDK lock-in.
- **Non-goals (v1):** hand-tracking, haptics, and controller-specific deep
  integration (basic gaze/point + teleport suffices); new multiplayer netcode
  beyond existing presence; voice; in-VR plateau/bridge *authoring* (read &
  study first); changing the projection or fog math.

## 5. Open questions

_Both owner-gated items are now settled (engine + delivery target, 2026-06-13).
What remains before `Accepted` is sharpening the AC into testable form — no
further owner decisions are blocking._

- **Engine — resolved: Godot** (OpenXR). Owner decision: the stronger long-term
  foundation (full engine + path to native/console). Supersedes the earlier
  WebXR/three.js lean. See §2 for the cost (a separate client + a graph binding).
- **Delivery target — resolved: both, native + web** (owner decision). Native
  (desktop/standalone-headset) is the fidelity target; a Godot **Web export** is
  the zero-install, in-browser fallback. *Proposed sequencing (spec to confirm):*
  **native-first** — it carries the clean GDExtension binding and full OpenXR
  fidelity, with the existing 2D web app already covering zero-install reach;
  the Godot Web export then follows as a second deliverable, not a simultaneous
  build. This keeps each milestone shippable rather than blocking on two
  integrations at once.
- **Graph-integration binding — two bindings, one core.** Native → **GDExtension**
  calling `mp-graph`/`mp-domain`/`mp-reputation`/`mp-crdt` directly; Web → a
  **wasm bridge** to the existing `mp-wasm` exports. Both consume the **unchanged**
  core crates; the spec defines the shared boundary so the two bindings stay thin
  and equivalent. Web export carries the known threading/`SharedArrayBuffer`
  constraints + two-wasm-modules-in-one-page concern (Godot engine + `mp-wasm`).
- **World scale & origin — proposed:** auto-fit the bounding box of all plateau
  positions into a fixed, comfortable volume (the cluster ≈ a 10–15 m
  room-to-plaza around the spawn rig), recentred on the focused/travelled-to
  plateau — the 3D analogue of R-0024 "zoom to extent". Exact metrics tuned in
  the spec against the imported vault.
- **Reputation beyond position — resolved:** v1 is **position-only**; hinting the
  non-position grades (halo/colour/orientation/scale) is a deferred enhancement
  (kept a non-goal in §4).
- **Label legibility in 3D — proposed:** billboarded `Label3D`/viewport labels
  with distance fade + frustum culling, applying R-0024's **declutter principle**
  (priority focused→lit→rest, drop overlaps) reimplemented Godot-side. The pure JS
  `planLabels` code doesn't transfer to GDScript/Godot, but the algorithm does.
- **Locomotion comfort / accessibility — proposed:** **teleport-first** (lowest
  motion sickness), smooth-fly as an opt-in with a comfort vignette;
  seated-friendly default, room-scale supported. Motion-sickness mitigation is
  first-class.
- **Relationship to Phase 7 / parallelism — proposed:** with one engine chosen
  this is clean — **Godot _is_ the Phase 7 "3D World"** and R-0025 is its
  **OpenXR mode** within the *same project + same scene*. Because flat-3D and VR
  render the **identical Godot scene**, VR is **not a strictly-later phase**: the
  shared work (graph binding + scene + content) serves both, the **OpenXR rig can
  be stood up in parallel** with it, and only the **comfort-sensitive VR UX**
  (locomotion feel, vignette, worldspace panels) is sequenced *after* scene
  stability so it isn't tuned against shifting ground. So — **parallel tracks
  converging on one scene, gated only by the graph binding**, not by Phase 7
  shipping in full first.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-13 | Frame VR as a **renderer over the existing 3D geometry**, not a data-model change | Positions are already Grade-1 `(e1,e2,e3)`; the 2D map is a projection — VR just stops collapsing the axis. Keeps GA/CRDT/Rust untouched (additive, like the 2D canvas) |
| 2026-06-13 | Lean **WebXR** (browser) over a native engine | Preserves offline-first/decentralized/no-server and reuses the wasm core + graph bindings + presence/CRDT; degrades to desktop 3D with no headset. Final engine choice deferred to Accept |
| 2026-06-13 | First-pass narrowing of §5: v1 **position-only**, **teleport-first** locomotion, **auto-fit** world scale, **screen-space `planLabels`** reuse | Lets the draft converge toward Accept while staying a pure additive renderer; the only items left to the owner are the engine (WebXR vs Godot) and whether VR is Phase 7's immersive mode |
| 2026-06-13 | Proposed engine **WebXR / three.js**, superseding the earlier Phase 7 "Godot" note (pending owner confirm) | A native engine breaks the single-browser-app, offline-first, reuse-the-wasm-core properties; three.js is the most mature WebXR path |
| 2026-06-13 | **Engine = Godot (OpenXR)** — owner decision, supersedes the WebXR/three.js lean above | Owner: stronger long-term foundation (full engine, native/console path) for an open-ended 3D/VR world. Accepts the cost of a separate client + a graph binding; GA/CRDT/reputation core stays unchanged. Re-frames Phase 7 as the Godot 3D world and R-0025 as its OpenXR mode |
| 2026-06-13 | Delivery target (Godot **Web export vs native client**) left **open/owner-gated** | It determines the integration (wasm bridge vs GDExtension) and whether zero-install/in-browser is kept; decentralized + offline hold either way. Lean native-first with the 2D web app as the zero-install entry |
| 2026-06-13 | **Delivery = both (native + web)** — owner decision | Owner wants full native/OpenXR fidelity *and* a zero-install in-browser fallback. Two thin bindings over one unchanged core (GDExtension native, wasm bridge web). Proposed native-first sequencing so milestones stay shippable; spec confirms. Closes the last owner-gated fork |
| 2026-06-13 | VR **develops in parallel** with the flat-3D world, not strictly after it | In Godot flat-3D and VR are the *same scene*; the real dependency is the graph binding + a stable scene, which both modes share, so the OpenXR rig parallelizes. Only the comfort-sensitive VR UX is sequenced after scene stability. Refines the earlier "Phase 7 lands first" note |

## Changelog

- 2026-06-13 created (Draft) — captured at the owner's request for a later phase
  (Phase 11 — Immersive/VR), extending the roadmap's Phase 7 "3D World". Pending
  refinement of acceptance criteria + resolution of the open questions before
  `Accepted`; no spec until then.
- 2026-06-13 first-pass narrowing of §5 — reputation-grade, world-scale,
  label-legibility, and locomotion questions resolved or given a proposed
  resolution. Two items remain **owner-gated**: the engine (WebXR/three.js vs the
  earlier Godot note) and whether VR is Phase 7's immersive mode vs a parallel
  track. Still `Draft`.
- 2026-06-13 **engine decided: Godot (OpenXR)** at the owner's direction
  ("better long term"). Reframed the title/statement/rationale/AC/constraints
  around a Godot 3D/XR client that consumes the unchanged Rust graph core;
  Phase-7 relationship resolved (Godot _is_ the 3D world, VR is its XR mode). One
  owner-gated fork now remains before `Accepted`: **delivery target — Godot Web
  export vs. native client** (drives wasm-bridge vs. GDExtension and the
  in-browser property). Still `Draft`.
- 2026-06-13 **delivery decided: both (native + web)** at the owner's direction.
  Two thin bindings over one unchanged core (GDExtension native, wasm bridge
  web), proposed native-first. **All owner-gated forks are now closed** — the
  only thing between here and `Accepted` is sharpening the draft-level AC into
  testable form, which can wait until the phase approaches. Still `Draft`.
- 2026-06-13 refined the sequencing per owner: VR **develops in parallel** on the
  shared Godot scene (gated only by the graph binding + scene stability), not as
  a strictly-later phase — only the comfort-sensitive VR UX follows scene
  stability. Still `Draft`.
