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
renderer that **stops collapsing it** — placing each plateau at its true
`(e1, e2, e3)` point in a navigable space, drawn through **WebXR** so the same
in-browser, offline-first, decentralized app can be explored on a headset (or as
desktop 3D without one). You walk the fog, see bridges as arcs in space, watch
reachability light the region around you, and meet other wizards as avatars at
their positions — over the **same** CRDT world and signed-event reputation.

## 2. Rationale

The geometry is the whole thesis ("knowledge graph as geometry"), and it is
*natively 3D* — the 2D map was only ever a convenience projection. VR is the
honest rendering of what the data already is: the axes a lens orients toward
(e1/e2/e3) become real directions you can turn your head to. Crucially this is
**additive and architecture-preserving**: it is a new *renderer* over the
existing graph + `VIEW`/reputation state, exactly as the 2D canvas is — **no GA,
CRDT, Rust, or identity change**. WebXR keeps every existing constraint intact
(in-browser, no server, works offline, syncs over the existing WebRTC/CRDT
layer), reuses the wasm core untouched, and degrades gracefully to flat 3D on
machines with no headset. It directly serves the owner's spatial-learning goal:
studying a career path becomes literally walking toward an orientation.

## 3. Acceptance criteria

_Draft-level — to be sharpened into testable form before status → `Accepted`._

- **AC1 — True-geometry scene.** Each plateau is rendered at its Grade-1
  `(e1, e2, e3)` coordinates in an immersive WebXR scene, with the three world
  axes carrying the same meaning as the lens/domain orientation (e1 Formal,
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

- **AC6 — Additive, graceful, no-headset fallback.** Runs as **desktop 3D**
  ("magic-window"/orbit controls) with no headset and enters immersive mode when
  a WebXR device is present. The existing 2D map and every current flow are
  **unchanged**; **no Rust/wasm/CRDT/GA/identity change** — a new renderer over
  the same graph + state. Existing suites stay green.

- **AC7 — One world, one data.** The VR view reads the **identical** CRDT
  document and signed-event reputation as the 2D app; an edit made in one is
  visible in the other; nothing authoritative is stored that isn't derivable
  from the graph (CLAUDE.md §6).

## 4. Constraints & non-goals

- **A renderer, not a new data model.** Space stays the three Grade-1 components
  `e1/e2/e3`; reputation's higher grades (bivectors/rotors) are **not**
  spatialized in v1. No 4th GA axis.
- **Browser-first / offline-first / decentralized.** WebXR, not a native
  app-store binary; no server; syncs over the existing WebRTC + CRDT layer.
- **Don't replace the 2D map.** It stays as the fast, legible default and the
  no-WebGL fallback (and remains the primary surface for authoring).
- **Hardware-agnostic.** Target the WebXR standard (Quest, PCVR, phone
  cardboard) — no single-vendor SDK lock-in.
- **Non-goals (v1):** hand-tracking, haptics, and controller-specific deep
  integration (basic gaze/point + teleport suffices); new multiplayer netcode
  beyond existing presence; voice; in-VR plateau/bridge *authoring* (read &
  study first); changing the projection or fog math.

## 5. Open questions

_Narrowed (first pass, 2026-06-13). Each now carries a proposed resolution; the
two marked **owner-gated** still need explicit sign-off before status →
`Accepted`._

- **Engine — proposed: WebXR via three.js** (babylon.js the fallback). A native
  engine (the roadmap's earlier "Godot" note for Phase 7) would mean a separate
  runtime + export pipeline and would break the single-browser-app, offline-first,
  reuse-the-wasm-core properties; three.js is the most mature WebXR path and runs
  over the existing graph bindings. **Owner-gated:** confirm WebXR over Godot.
- **World scale & origin — proposed:** auto-fit the bounding box of all plateau
  positions into a fixed, comfortable volume (the cluster ≈ a 10–15 m
  room-to-plaza around the spawn rig), recentred on the focused/travelled-to
  plateau — the 3D analogue of R-0024 "zoom to extent". Exact metrics tuned in
  the spec against the imported vault.
- **Reputation beyond position — resolved:** v1 is **position-only**; hinting the
  non-position grades (halo/colour/orientation/scale) is a deferred enhancement
  (kept a non-goal in §4).
- **Label legibility in 3D — proposed:** billboard labels toward the camera,
  distance-fade by range, and reuse R-0024's `planLabels` in **screen space after
  projection** (frustum-cull first) — the same pure declutter under a new
  projection, which reinforces the "additive renderer" claim.
- **Locomotion comfort / accessibility — proposed:** **teleport-first** (lowest
  motion sickness), smooth-fly as an opt-in with a comfort vignette;
  seated-friendly default, room-scale supported. Motion-sickness mitigation is
  first-class.
- **Relationship to Phase 7 — proposed (owner-gated):** build the 3D scene
  **once** — desktop 3D is the Phase 7 "3D World" deliverable, and R-0025 adds the
  **WebXR entry layer on top** of that same scene. So Phase 7 lands first and VR
  is its immersive mode, not a parallel rewrite. **Owner-gated:** confirm the
  single-scene sequencing.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-13 | Frame VR as a **renderer over the existing 3D geometry**, not a data-model change | Positions are already Grade-1 `(e1,e2,e3)`; the 2D map is a projection — VR just stops collapsing the axis. Keeps GA/CRDT/Rust untouched (additive, like the 2D canvas) |
| 2026-06-13 | Lean **WebXR** (browser) over a native engine | Preserves offline-first/decentralized/no-server and reuses the wasm core + graph bindings + presence/CRDT; degrades to desktop 3D with no headset. Final engine choice deferred to Accept |
| 2026-06-13 | First-pass narrowing of §5: v1 **position-only**, **teleport-first** locomotion, **auto-fit** world scale, **screen-space `planLabels`** reuse | Lets the draft converge toward Accept while staying a pure additive renderer; the only items left to the owner are the engine (WebXR vs Godot) and whether VR is Phase 7's immersive mode |
| 2026-06-13 | Proposed engine **WebXR / three.js**, superseding the earlier Phase 7 "Godot" note (pending owner confirm) | A native engine breaks the single-browser-app, offline-first, reuse-the-wasm-core properties; three.js is the most mature WebXR path |

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
