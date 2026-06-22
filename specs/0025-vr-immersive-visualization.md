# SPEC-0025 — VR / immersive visualization: a Godot client over the unchanged core

- **Status:** Accepted
- **Realizes:** R-0025
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-13
- **Depends on:** SPEC-0005 (graph projection + the synced world), SPEC-0008 (domain-agnostic GA store), SPEC-0010 (signed events / recomputed reputation), SPEC-0016 (presence), SPEC-0024 (camera + `planLabels` declutter)
- **Module(s):** NEW `apps/godot/` (the Godot 4 project) + NEW `crates/mp-godot/` (a thin **GDExtension** binding for the native build). The web build reuses the existing `crates/mp-wasm` via Godot's JS interop. **No change to the core: `mp-graph`/`mp-domain`/`mp-reputation`/`mp-crdt`/`mp-identity`/garust.**

## 1. Motivation

R-0025: render the world as an immersive 3D/VR scene that stops collapsing the
empirical axis the 2D map projects away. The geometry is already 3D — a
plateau's `position` is a Grade-1 `(e1,e2,e3)` — so the immersive client is a
**pure consumer** of the existing graph + signed-event reputation, not a new data
model. The owner chose **Godot (OpenXR)** as the long-term engine, delivered as
**both** a native client and a Web export, developed **in parallel** on one shared
scene (R-0025 decision log). This spec fixes the architecture so the two bindings
stay thin and the GA/CRDT core is untouched.

## 2. Design

### 2.1 Topology — one scene, two bindings, one core

```
        apps/godot/   (one Godot 4 project — the shared scene + GDScript)
              │  calls a binding-agnostic GDScript interface: GraphSource
        ┌─────┴───────────────┐
   native build           web build
   crates/mp-godot         mp-wasm (existing, unchanged)
   = GDExtension           via Godot JS interop
        │                       │
        └──────── consume ──────┘
   mp-graph · mp-domain · mp-reputation · mp-crdt · garust   (UNCHANGED core)
```

The scene never calls a binding directly — it talks to a GDScript `GraphSource`
interface (§3). Native resolves it to `mp-godot` (GDExtension calling the crates
directly); web resolves it to a JS-interop shim over the existing `mp-wasm`
exports. Same scene, same data, two thin adapters.

### 2.2 Data contract (already exposed — see `mp-wasm` + `convert.rs`)

The client needs only what the core already surfaces; **no new core API**:

| Need | Source (today) |
|------|----------------|
| Plateaus | `PlateauDto { id, name, description, domain_id, position: { e1, e2, e3 } }` |
| Bridges | `BridgeDto { id, from, to, concept }` |
| Resources | `ResourceDto { id, title, kind, uri, state, vote_count }` |
| Reachability (fog) | `WasmGraph.reachable_plateaus(rep_json)` / `is_reachable` |
| Reputation | `recompute_reputation(events_json, pubkey) -> json` (`mp_identity::recompute`; never stored) |
| World load/save/sync | `WasmCrdtDoc.load`/`save`/`merge_bytes`, `to_graph`, `generate_message`/`receive_message` |
| Edits (study) | `vote(resource, wizard, weight)`, `add_resource(...)` |
| Identity | `WasmIdentity.sign_traversal` / `sign_vouch` (`mp_identity::sign`) |

Positions arrive as `{e1,e2,e3}` floats — the client places a node at that point
and does **no GA**. The native GDExtension answers the **same DTO shapes** the web
binding does, but it must **re-derive** those `serde` structs from the `mp-domain`
core types — it does **not** depend on `mp-wasm` (that would be a forbidden
binding→binding edge; `convert.rs`'s DTOs are private to `mp-wasm`). Equivalence
between the two transports is guaranteed **structurally by the §3.1 fixture-parity
test**, not by shared struct identity. (`PlateauDto.description` is included — AC5's
in-world study body needs it.)

Reputation/signing flow through **`mp-identity`** (which drives `mp-reputation`
transitively), so the native binding depends on `mp-domain` + `mp-crdt` +
`mp-identity` — the exact inward edge set `mp-wasm` already uses, never a direct
`mp-reputation` dep. The native `GraphSource` is **read-plus-vote** only (no bridge
construction; authoring is a non-goal), keeping the GDExtension surface minimal.

### 2.3 Scene model (`apps/godot/`)

- `World3D` (root) — holds the graph, the `XROrigin3D` rig (disabled in flat-3D),
  a flat-3D `Camera3D`, and the plateau/bridge containers.
- `Plateau.tscn` — `Node3D` → `MeshInstance3D` (disc/sphere) + `Label3D`
  (billboarded). Lit/fogged is a material **emission** toggle driven by the
  `reachable` set (AC2) — the same set the 2D map lights, never recomputed here.
- `Bridge.tscn` — a thin mesh/line between two plateau positions (AC3).
- `XR` — `XROrigin3D` + `XRCamera3D` + two `XRController3D`; enabled only when
  `XRServer.find_interface("OpenXR").is_initialized()` (AC1/AC6). Flat-3D path is
  the same scene with the plain `Camera3D` active.
- Reach/fog, focus ring, presence, markers all read the **same** `VIEW`-equivalent
  rig + the core's `reachable` set, exactly as the 2D renderer does.

### 2.4 Position map (pure, tested — AC1)

`place_node(e1, e2, e3, fit) -> Vector3` maps the three GA axes to the three world
axes (`x=e1, y=e3, z=e2` so "up" is the Creative axis, matching the 2D map's
vertical), scaled/offset by `fit`. The `fit` is produced by a **separate pure
function** `compute_fit(positions) -> Fit` (bounding box → scale + offset; the 3D
analogue of R-0024 "zoom to extent" — cluster ≈ a 10–15 m volume around spawn),
where `Fit` is a **plain value** (two `Vector3`s / floats), **not** a Godot scene
type. Both functions are pure and deterministic and are unit-tested
**independently with no engine** — `place_node` never reads scene state for the
bounds.

### 2.5 Label declutter (pure, tested — AC3)

Port R-0024's `planLabels` (priority focused→lit→rest, greedy overlap-drop) to
operate on **projected screen rects** (project each `Label3D` to the active
camera, frustum-cull, then the identical algorithm). The ported *algorithm* is
unchanged and reuses R-0024's pure unit test (rects in → kept set out). The new,
camera-dependent surface is the **projection adapter** `project_to_rect(pos,
camera) -> Rect | null` (null = behind/outside the frustum) — that is where the
port's real risk lives, so it gets its **own** handle: a pure test where `camera`
is a plain projection matrix, plus coverage in the headless scene smoke.
Distance-fade is a separate material concern.

### 2.6 Navigation & presence (AC4)

- **Teleport-first** locomotion (controller ray → floor/plateau), smooth-fly an
  opt-in with a comfort vignette.
- **Travel-to-plateau** lerps the `XROrigin3D`/camera rig to a plateau — the 3D
  analogue of R-0019 `centerOn` (and signs the same traversal via
  `WasmIdentity.sign_traversal`, growing earned reach exactly as the 2D app).
- **Presence** (R-0016): render other wizards as billboarded avatars/silhouettes
  at their positions. **Presence is a transport concern, not a `GraphSource`
  method** — R-0016 lives entirely in `apps/web/src/presence.js` (ephemeral
  beacons over a `BroadcastChannel`, deliberately outside the CRDT/signed-event
  channels), so there is **no core API to bind**. The native client carries its
  **own beacon implementation** of the R-0016 protocol over its sync transport;
  see §2.9.

### 2.9 Sync transport (native) — a named track, not "free"

The web app drives the CRDT pump, WebRTC datachannel, and presence beacons from
**JavaScript** (`sync.js`, `presence.js`); the Rust core only does the *merge*,
not the *transport*. So the native client needs its **own transport stack**:
drive `WasmCrdtDoc`-equivalent `generate_message`/`receive_message` over a native
WebRTC/datachannel and carry the presence beacons itself. This is the largest
hidden chunk of AC7 + AC4, is neither "the core" nor a `GraphSource` read method,
and is scoped as its **own sub-spec** (native-first). The web build inherits the
existing JS transport for free; only the native build owns this work.

### 2.7 Study in-world (AC5)

Opening a plateau instances a worldspace UI (a Godot `Control` rendered into a
`SubViewport` on a quad) showing the plateau body + stone-ranked resources
(reusing the R-0023 ranking), with `vote`/`add_resource` wired through
`GraphSource`. Markdown/KaTeX rendering fidelity is a deferred sub-spec (see §5);
v1 may show source/plain text.

### 2.8 Parallel work breakdown (the R-0025 "in parallel" decision)

- **Track A — the gate (shared):** `GraphSource` + the native `mp-godot`
  GDExtension + the flat-3D scene placing plateaus/bridges/fog from the fixture.
  Everything else depends on this; it is the real dependency, not "Phase 7".
- **Track B — parallel:** the `XROrigin3D` rig + OpenXR enable + controller input
  can be built against a stub scene the moment Track A's `GraphSource` interface
  is fixed.
- **Track C — after scene stability:** comfort-sensitive VR UX (locomotion feel,
  vignette, worldspace panels) — sequenced last so it isn't tuned against a
  shifting scene.
- **Track D — native sync transport (parallel, native-only):** the §2.9
  stack (drive the CRDT pump + presence beacons over a native datachannel).
  Gates AC7 + native presence; independent of the scene; its own sub-spec.

## 3. Code outline

```
apps/godot/
  project.godot
  src/
    graph_source.gd        # interface: plateaus(), bridges(), resources(),
                           #   reachable(rep), recompute_rep(events,pubkey),
                           #   load(bytes)/save()/merge(bytes), vote(...), sign_*(...)
    graph_source_native.gd # -> mp-godot (GDExtension)
    graph_source_web.gd    # -> mp-wasm via JavaScriptBridge
    place_node.gd          # pure: place_node(e1,e2,e3,fit) -> Vector3   (+ test)
    label_plan.gd          # pure: plan_labels(rects, focused, lit) -> Set  (+ test)
    world.gd               # builds the scene from GraphSource
  scenes/ World3D.tscn  Plateau.tscn  Bridge.tscn
  test/   place_node_test.gd  label_plan_test.gd  parity_test.gd   # GUT, headless

crates/mp-godot/           # GDExtension (godot-rust / gdext)
  Cargo.toml               # depends on mp-domain, mp-crdt, mp-identity
                           #   (mp-reputation transitive via mp-identity; NOT mp-wasm)
  src/lib.rs               # #[gdextension] entry; re-derives the DTO serde shapes
                           #   from mp-domain types (parity via the fixture test)
```

```rust
// crates/mp-godot/src/lib.rs — representative, not final.
// A GDExtension class that owns a CrdtDoc and answers the SAME shapes mp-wasm does.
#[derive(GodotClass)]
#[class(base=RefCounted)]
struct GraphSourceNative { doc: mp_crdt::CrdtDoc }   // core, unchanged

#[godot_api]
impl GraphSourceNative {
    #[func] fn plateaus_json(&self) -> GString { /* serde the existing PlateauDto */ }
    #[func] fn reachable(&self, rep_json: GString) -> PackedStringArray { /* mp-graph */ }
    // vote / add_resource / sign_* / save / merge_bytes — all delegate to the crates
}
```

## 4. Non-goals

- **No core change.** `mp-graph`/`mp-domain`/`mp-reputation`/`mp-crdt`/garust are
  consumed, not edited; `mp-godot` and `apps/godot/` are purely additive.
- **No replacement of the 2D web app** (stays the zero-install/authoring surface).
- Per R-0025 §4: no 4th GA axis / reputation-grade visualization in v1; no
  hand-tracking/haptics; no in-VR authoring; no projection/fog-math change.
- **Deferred sub-specs (not this spec):** worldspace Markdown/KaTeX fidelity;
  avatar art; the Web-export delivery details (`SharedArrayBuffer`/threading, the
  two-wasm-modules-in-one-page bridge) — native-first per R-0025, web follows.

## 5. Open questions (resolved here / deferred)

- **Godot version + GDExtension lib — resolved:** Godot 4.x; native binding via
  **godot-rust (`gdext`)** (mature, `serde`-friendly, links the existing crates).
- **Test harness — resolved:** **GUT** for GDScript unit tests + `--headless`
  scene smoke in CI; the pure `place_node`/`plan_labels`/parity tests need no GPU.
- **Worldspace UI tech — leaning:** Godot `Control` in a `SubViewport` on a quad;
  fidelity (esp. KaTeX) deferred to a sub-spec.
- **Web JS-interop shape — deferred:** exact `JavaScriptBridge` glue to `mp-wasm`
  (native-first, so this lands with the Web-export deliverable).

## 6. Acceptance criteria

Maps to R-0025 AC + its §3.1 test handles:

- [ ] AC1 — plateaus at `(e1,e2,e3)` in the Godot/OpenXR scene; `place_node` pure
      unit-tested; headless scene smoke instantiates the nodes.
- [ ] AC2 — fog/reach from the core's `reachable` set (parity test vs the 2D app
      on the committed fixture); no `f32`/CRDT reputation field.
- [ ] AC3 — bridges + billboarded, decluttered labels; `plan_labels` pure
      unit-tested (port of `planLabels`).
- [ ] AC4 — teleport + travel-to-plateau move the rig (travel signs a traversal);
      presence avatars — manual in-headset e2e.
- [ ] AC5 — plateau body + ranked resources on a worldspace panel; vote/add wired
      through `GraphSource` — manual in-headset e2e.
- [ ] AC6 — flat-3D with no headset, immersive when OpenXR present; repo-diff
      gate: **no diff to the protected core** (`mp-graph`, `mp-domain`,
      `mp-reputation`, `mp-crdt`, `mp-identity`, garust) or `apps/web/` product
      code — all additions confined to `crates/mp-godot/`, `apps/godot/`, and the
      single workspace-member line in the root `Cargo.toml`; existing suites green.
- [ ] AC7 — same CRDT doc + recomputed reputation as the 2D app; a VR edit syncs
      to the 2D app (parity + manual e2e).

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-13 | Scene talks to a GDScript `GraphSource` interface; native = `mp-godot` GDExtension, web = `mp-wasm` JS-interop | Keeps both bindings thin and swappable; the scene is binding-agnostic; the core stays unchanged |
| 2026-06-13 | Client does **no GA** — consumes `{e1,e2,e3}` DTOs and the core's `reachable` set | Honours CLAUDE.md §1/§6: GA lives only in the core; the client is a pure view |
| 2026-06-13 | `mp-godot` **re-derives** the DTO serde shapes from `mp-domain`; it does **not** depend on `mp-wasm` | `convert.rs` DTOs are private to `mp-wasm`; a binding→binding dep would invert the topology (§2.1). Equivalence is guaranteed by the fixture-parity test, not struct identity |
| 2026-06-13 | `mp-godot` depends on `mp-domain` + `mp-crdt` + `mp-identity` (not `mp-reputation` directly) | Reputation recompute + signing flow through `mp-identity` (which drives `mp-reputation`) — the exact inward edge set `mp-wasm` already uses |
| 2026-06-13 | Presence is a **transport-side** concern, not a `GraphSource` method; native sync transport is its own sub-spec | R-0016 lives in `apps/web/src/presence.js` (BroadcastChannel beacons), and the core does the merge not the transport — neither is bindable as a graph read |
| 2026-06-13 | Port `planLabels` to screen-space rather than invent a 3D declutter | The R-0024 algorithm is projection-agnostic; only the input rects change |

## Changelog

- 2026-06-13 created (Draft) — Godot client as a pure consumer over the unchanged
  core; one shared scene, native GDExtension + web wasm bindings behind a
  `GraphSource` interface, pure `place_node`/`plan_labels`, parallel work
  breakdown. Pending architect review, then `Accepted`.
- 2026-06-13 architect design review: **APPROVE-WITH-NITS** — the core-untouched/
  pure-consumer/`GraphSource`/reputation-recompute design holds against the code.
  Folded all four must-fix findings: (1) `mp-godot` deps corrected to
  `mp-domain`+`mp-crdt`+`mp-identity` (reputation/signing flow through
  `mp-identity`, not a direct `mp-reputation` dep); (2) `mp-godot` **re-derives**
  the DTO shapes from `mp-domain` (no `mp-wasm` binding→binding dep; parity via
  the fixture test); (3) presence is a **transport** concern (R-0016 is JS-only,
  not in the core) — added §2.9 native transport track + Track D, removed the
  implied presence binding; (4) additivity gate sharpened to whitelist
  `crates/mp-godot/`+`apps/godot/`+the workspace-member line and enumerate the
  protected core (incl. `mp-identity`). Plus minors: `compute_fit` split out as a
  pure `Fit`-returning fn, `project_to_rect` given its own test handle,
  `PlateauDto.description` added for AC5. **Status → Accepted.**
- 2026-06-21 **Slice 1 (Track A foundation)** implemented in `apps/godot/` — the
  GPU-free, binding-agnostic base, headless-verified with the installed Godot 4.6
  (`godot --headless --script test/run_tests.gd`, exit 0, 20 checks): pure
  `place_node`/`compute_fit` (the AC1 placement math, axes x=e1/y=e3/z=e2),
  `plan_labels` (the AC3 `planLabels` port) + `project_to_rect` (the camera-dependent
  surface, matrix-modelled), the `GraphSource` interface + a fixture, and a flat-3D
  `World3D` scene that places plateaus/bridges and emission-lights the reachable set
  (AC2 lighting, from the source's set — no recompute). **Additive only** — only
  `apps/godot/` touched; no core/`apps/web`/Cargo change (AC6 diff-gate holds); no Rust
  this slice. **Deferred to later slices:** the native `crates/mp-godot` GDExtension +
  web `mp-wasm` binding (real data + the §3.1 parity test → AC2/AC7), the OpenXR rig +
  teleport/travel (Track B → AC4), worldspace study (AC5), the native sync transport
  (Track D → AC7). R-0025 stays **Accepted** (not yet Met) until those land.
- 2026-06-21 **Slice 2 (Track A — the native `mp-godot` GDExtension)** — the data gate.
  New `crates/mp-godot/` (godot-rust / gdext 0.5): owns a `mp_crdt::CrdtDoc` and answers
  the SAME DTO JSON shapes `mp-wasm` does, **re-derived from `mp-domain`** (never a
  `mp-wasm` dep — §2.2 decision). Deps = `mp-domain`+`mp-crdt`+`mp-identity` (the exact
  inward set `mp-wasm` uses). The engine-free `GraphData` (plateaus/bridges/resources JSON
  + load) is host-tested (4 tests incl. the **shape-parity** test — the DTO keys match the
  documented contract); the `#[gdextension]` wrapper is **feature-gated** (`--features
  gdext`) so `cargo test --workspace` stays green without pulling the engine crate. Added
  the `apps/godot/mp_godot.gdextension` config + `graph_source_native.gd` adapter
  (DTO JSON → the flat interface shape) and extended the headless runner: the adapter
  JSON-mapping is contract-tested, and a **live-extension smoke** (built cdylib loaded into
  Godot 4.6.3) confirms `GraphSourceNative` instantiates and an empty native world → empty
  arrays. **Additive** — only `crates/mp-godot/`, `apps/godot/`, and the root Cargo
  workspace-member line (AC6 gate holds); the cdylib + `.godot/`/`.uid` are gitignored build
  artifacts. **Still deferred:** native `reachable`/vote/sign + cross-binding byte-parity vs
  `mp-wasm` on a populated doc (AC2/AC7), the web `mp-wasm` JS-interop binding, the OpenXR
  rig (Track B → AC4), worldspace study (AC5), native sync transport (Track D → AC7).
  R-0025 stays **Accepted**.
- 2026-06-21 **Slice 2.1 (flat-3D fix + navigation)** — visual check found the scene
  rendered **black**: `world.build()` cleared *all* children, freeing the scene's
  `Camera3D`/light. Fixed: plateaus/bridges now build under a dedicated **`Graph`**
  child, so a rebuild clears only them (a regression-guard test asserts a sibling
  `Camera3D` survives `build()`); added a dark-navy `WorldEnvironment` + ambient and a
  camera "zoom-to-extent" framing, and enlarged the plateau spheres/emission. Added a
  **flat-3D free-fly camera** (`fly_camera.gd`: right-drag look · WASD move · E/Q
  up/down · wheel dolly · Shift sprint) + an on-screen controls hint, so the no-headset
  view (AC6) is navigable. This is the desktop fallback, **not** the VR locomotion
  (teleport/travel-to-plateau — Track B/C → AC4, still deferred). Verified: headless
  suite green (incl. the new guard) + the scene runs in Godot 4.6.3 (gdext API
  v4.6.stable). Additive — only `apps/godot/`.
