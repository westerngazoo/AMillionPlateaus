# RFC-0003 — A composable view pipeline: injectable layout, view-model, and renderer

- **Status:** Draft (2026-07-03) — proposal for discussion. No production behaviour changes in this RFC.
- **Author:** Gustavo Delgadillo (with Claude)
- **Created:** 2026-07-03
- **Affects:** `apps/web/src` (`render.js`, `main.js`, `project.js`, `layout.js`, `labels.js`), `apps/godot/src`, `crates/mp-godot`; any future renderer (WebGL/Three, native)
- **Decision needed:** adopt the `place → layout → view-model → renderer` pipeline as the client presentation contract, and approve Phase 1 (an additive, behaviour-preserving extraction in the web client). See §8/§10.
- **Relates to:** R-0024 (map zoom/label LOD), R-0025 (Godot/VR), R-0033 (progress map), the map focus+context work (PR #42), the force-layout + Godot work (PR #41). Does **not** touch RFC-0001 (the core store) or RFC-0002 (domains) — this is purely the presentation seam.

## 1. Summary

The project already renders the same knowledge graph two ways — a **2D canvas** in the
browser and a **3D scene** in Godot — from **one core** through **two pure-consumer
bindings**. That cross-client composability is real and load-bearing (§3.1). But *within*
a client the presentation is a single hard-wired function (`render.js`'s `render(ctx, …)`),
with layout, emphasis, and drawing entangled. This RFC proposes naming the pipeline that
is **already emergent on both clients** —

```
place(graph, view) → layout(positions) → view-model(state) → renderer.draw(frame)
```

— and turning its two soft joints into **injection points**: a **layout strategy**
(spread / force / none) and a **`Renderer`** backend (canvas2d today; WebGL, or an embedded
Godot view, tomorrow). The immediate payoff: PR #41 (force layout) and PR #42 (focus +
context) stop being rival rewrites of `render.js` and become two **stages that compose**
(§5). The long payoff: a third renderer is a drop-in, not a fork. **No core/GA change, no
DTO change, no behaviour change in Phase 1.**

## 2. Motivation

- **Two renderers already exist; a third is wanted.** Web canvas + Godot 3D ship today; an
  in-browser 3D (WebGL/Three) is the obvious next surface. Without a named seam, each new
  renderer copies orchestration and re-solves layout/emphasis.
- **The #41 / #42 collision is the symptom.** Both PRs edit `render.js` **in place**, and
  both introduce an emphasis/focus model — #42 (`inFocus`/`focusDomains`/`SHADOW_RADIUS`,
  merged) and #41 (`nodeTier`/`lensId`/`lensMode`, draft) — so they are **rivals on emphasis**,
  not complements. #41's *other* half (a force layout) is genuinely a different concern. With a
  seam, the resolution is clean: keep #41's `forceLayout` as a layout strategy, drop its
  redundant emphasis rewrite (main already has #42's), and stop hand-merging one `render.js`
  (§5).
- **The discipline already exists at the crate boundary.** The core forbids a client from
  depending on another client (mp-godot never imports mp-wasm, §3.1). This RFC extends the
  same "depend on a contract, not an implementation" rule *inside* a client.
- **Testability.** A pure `view-model(state) → Frame` is snapshot-testable with no canvas
  and no GPU — the same reason the pure `place`/`layout`/`label` modules already are.

## 3. What exists today (inventory)

### 3.1 The client seam is already dependency-injected ✅

`crates/mp-godot/src/dto.rs` imports **only `mp_domain`** (the core) and re-derives its own
`PlateauDto`/`BridgeDto`/`ResourceDto`/`PathDto`; it has **zero dependency on `mp-wasm`**.
So the browser (canvas 2D, via `mp-wasm`) and Godot (3D, via `mp-godot`) are *independent
consumers of the same core*, fed identical DTO shapes. The "renderer" is injected at the
**app boundary** — you run `apps/web` or `apps/godot`; a third renderer is another pure
consumer of the same DTOs. This is the strong, working part of the design and this RFC
does **not** change it.

### 3.2 The pipeline is already emergent — on both clients

The stages exist as separate pure units; they are just orchestrated ad-hoc rather than
behind a named contract:

| Stage | Web (`apps/web/src`) | Godot (`apps/godot/src`) |
|-------|----------------------|---------------------------|
| **place** — GA position → screen/world | `project.js` (`project`) | `place_node.gd` (`compute_fit` + `place_node`) |
| **layout** — declutter positions | `layout.js` (`spreadNodes` only — `forceLayout` is *unmerged* draft on `cursor/obsidian-lens-3d-8126`) | **none** — 3D has room; no declutter pass in `world.gd` |
| **label-plan** — which labels/captions | `labels.js` (`planLabels`/`planBoxes`) | `label_plan.gd` (`LabelPlan` — a faithful port of `planLabels`) |
| **draw** | `render.js` (`render`) | `world.gd` (`MPWorld`) builds the scene |
| **hit-test** | `main.js` node-pick loop + `wayfinding.js` `pickBridge` — a **pure function over the placement map** `render` returns | *(scene-native / future raycast)* |

The **layout** row is the one asymmetry: it is **web-only**. Godot mirrors `place`,
`label-plan`, and `draw`; it has no layout stage, and PR #41's Godot changes are 3D
coordinate *separation* inside `place`/`world`, not a `Layout` strategy behind a shared
interface (§4/§6). Hit-test is deliberately its *own* row, not fused with draw — see §4.

Two facts this RFC leans on: (a) **hit-testing already reuses the placement map** —
`render()` returns `points`, and `main.js:1194` hit-tests bridges against exactly those
points, so "draw" and "hit" already share one source of truth; (b) the Godot client is the
existing proof that the *shape* transfers across languages/runtimes.

### 3.3 The weak joint: no in-client renderer/layout seam

`apps/web/src/main.js` does `import { render } from "./render.js"` and calls `render(ctx,
{…})` directly. There is no `Renderer` interface and no way to select a layout strategy —
so canvas↔WebGL is not swappable, and layout vs emphasis cannot vary independently. This is
the single thing the RFC adds.

## 4. The model: the view pipeline

One paint is four pure-ish steps over the DTOs. The middle three are **backend-agnostic**;
only the last touches a canvas/GPU/scene.

```
                 view: {scale, cx, cy}      state: {progress, lens, focusedId, path, peers}
                        │                            │
graph(DTOs) ─► place ─► positions ─► layout ─► positions′ ─► view-model ─► Frame ─► renderer.draw(Frame) ─► HitIndex
   │                                   ▲                                                    │
   └──────────────── renderer.hitTest(x, y) ◄── HitIndex ◄─────────────────────────────────┘
```

**The `Frame`** — everything a renderer needs for one paint, computed once, free of drawing
concerns. It must cover *everything `render.js` draws today* (verified block-by-block against
`render.js`, so Phase 1 finds no un-modeled element mid-extraction), including the pieces that
**co-occur** on one node (a community "bedrock" ring *and* a mastered lit-ring, both at once)
and the **z-tiers** the current draw order encodes:

```js
Frame = {
  // draw tiers are explicit (see the z-order note below), not implied by array position
  nodes: [{
    id, pos, radius, alpha,                 // shadow tier ⇒ small radius + α 0.4
    fill, ring?,                            // progress fill + progress ring (R-0033)
    communityRing?,                         // bedrock ring at RADIUS+4 (R-0031) — SEPARATE from ring
    mastered?,                              // draw the ✓ glyph (R-0030)
    label?, emphasis: "focus" | "shadow",
  }],
  edges: [{ from, to, covered, caption? }],
  markers: [{                               // R-0014/R-0015 — carries stacking + state
    plateauId, stackIndex, crystallized, caption?,
  }],
  peers:   [{ plateauId, fanIndex, hue, label }],   // R-0016 silhouettes: fanning + deterministic hue
  overlays: {
    pathRoute?,                             // drawn UNDER discs (z-tier 0)
    focusRing?, nextStepRing?,
  },
}
```

**Injection point 1 — a `Layout` strategy (web-only in Phases 1–2):**

```js
// Maps raw placements to decluttered ones. Pure, swappable. Web only — Godot's 3D scene
// has room and runs no declutter pass (§3.2/§9).
//   spreadLayout (today's spreadNodes)  |  forceLayout (PR #41, unmerged)  |  identityLayout
type Layout = (positions: Map<Id,Pos>, opts) => Map<Id,Pos>;
```

**Injection point 2 — a `Renderer` (draw) + a `HitTest` strategy (kept pure over placements):**

```js
// The RENDERER owns drawing only — the backend-specific I/O.
interface Renderer { draw(frame: Frame): void; }

// Hit-testing is NOT on the Renderer. Today it is already a pure function over the placement
// map (`pickBridge(points, …)` + the node-pick loop), correctly decoupled from drawing — this
// RFC keeps it that way. It is polymorphic over the PLACEMENT GEOMETRY, not the draw object:
// the canvas2d and webgl-orthographic cases share one screen-space implementation; a
// perspective-3D renderer supplies its own raycast impl. This avoids forcing the renderer to
// retain per-frame `points` as internal state (the retained-state coupling §7 warns against).
type HitTest = (positions: Map<Id,Pos>, x, y) => Id | null;
```

**The view-model** — `viewModel(graph, positions, state) → Frame` — is where progress colours
(R-0033), focus/context emphasis (PR #42), label/caption planning (R-0024, incl. the
obstacle-chained `planBoxes` passes), and path overlays (R-0039) live. Pure, snapshot-testable,
renderer-independent. It does **not** know the renderer's coordinate space — it emits tiers +
styles; the renderer maps them to pixels/scene.

**Z-order is part of the contract.** `render.js` draws in a specific emphasis-dependent order
that the `Frame` makes explicit (not implied by array index): path route → shadow discs (α 0.4)
→ focus discs (+ community/mastered decorations) → **names last** (so text is never occluded by
a neighbouring disc) → overlays/markers/peers. Any renderer must honour these tiers.

`main.js` becomes an orchestrator that *injects* a layout + a renderer + a hit-test:

```js
const layout   = mode3d ? forceLayout : spreadLayout;   // web
const renderer = mode3d ? webglRenderer(canvas) : canvasRenderer(canvas);
const hitTest  = mode3d ? raycastHit : screenHit;       // pure, over the placement map
// per frame:
const positions = layout(place(graph, view));
renderer.draw(viewModel(graph, positions, state));
// pointer:  const hit = hitTest(positions, x, y);   // same `positions` that were drawn
```

## 5. #41 and #42: split #41 into the half worth keeping

Be precise about what each PR actually contains (verified against #41's diff, not its title):

- **PR #42 (merged)** is a pure **view-model** concern — `inFocus`/`focusDomains`/`SHADOW_RADIUS`
  decide `emphasis` (focus vs shadow) and which labels survive. It is on `main` now.
- **PR #41 (draft)** is *two* things: (a) a **force layout** (`layout` concern — produces
  positions), and (b) **its own emphasis rewrite** — `nodeTier() → lens|neighbor|context|full`,
  `LENS/NEIGHBOR/CONTEXT_RADIUS`, `lensId`/`lensMode`, a tier-based `drawOrder`. Half (b) is a
  **rival** to #42's already-merged emphasis, not a complement.

So the two PRs **do not compose as-is** — they collide on *emphasis* as well as on the
`render.js` edit surface. The seam's value is that it lets us **take exactly the half of #41
that is new and drop the half that is redundant**:

> Keep #41's `forceLayout` as a `Layout` strategy next to `spreadLayout`; **discard #41's
> emphasis rewrite** (`main` already has #42's focus/context in the view-model). Then
> `renderer.draw(viewModel(graph, forceLayout(place(...)), state))` runs #41's layout under
> #42's emphasis — one seam, no hand-merged `render.js`, one emphasis model.

#41's **Godot half is separate and additive** (§3.2/§6) and lands regardless. This is the
concrete, near-term reason to adopt the seam.

## 6. Cross-client: same shape, two languages

The pipeline is a **contract, not shared code** — each client implements the stages in its
own runtime (JS modules; GDScript classes). Godot already mirrors **`place` + `label-plan` +
`draw`** (`place_node` / `label_plan` / `world`, §3.2), which is the existing evidence the
decomposition is right. It does **not** implement the `Layout` stage (its 3D scene has room;
no declutter pass) — so the `Layout` seam is web-only in Phases 1–2, and a 3D layout strategy
is speculative (§9). The core→client DTO seam (§3.1) is the injection point *between* clients;
the `Layout`/`Renderer`/`HitTest` seam is the injection point *within* one. Godot needs no
change to validate the `place`/`label-plan`/`draw` shape; it already is a second renderer.

## 7. Non-goals

- **No core/GA/DTO change.** The store (RFC-0001), domains (RFC-0002), and the DTO shapes are
  untouched; this is presentation-only.
- **No behaviour change in Phase 1** — the extraction must be pixel-for-pixel (a Frame snapshot
  + the same canvas draw).
- **Not porting Godot into the JS pipeline.** Godot implements the same *shape* in GDScript; it
  is not refactored to consume JS modules.
- **Not building the WebGL renderer here.** That is a *consumer* that proves the seam (Phase 3),
  specced separately.
- **No renderer plugin registry / dynamic loading.** Injection is a constructor choice in
  `main.js`, not a plugin system.

## 8. Phased plan

- **Phase 1 — name the seam in the web client (additive, behaviour-preserving).** Extract a pure
  `viewModel(graph, positions, state) → Frame` from `render.js` and a `canvasRenderer()` that
  draws the `Frame`. **Hit-testing does NOT move onto the renderer** — `pickBridge` + the
  node-pick loop stay pure functions over the placement map (that is why "no behaviour change" is
  achievable: they don't move at all); `main.js` injects `{ layout, renderer, hitTest }`.
  **The riskiest part is z-order + declutter chaining**, not the model: `render.js` draws
  shadow discs (α 0.4) → focus discs → **names last**, with `planBoxes` caption declutter using
  the kept name-boxes as obstacles mid-render. The extraction must reproduce that exactly.
  **Acceptance criteria:** (a) a `Frame` snapshot test proves the model is stable; (b) a **golden
  canvas snapshot** (offscreen-canvas pixel/hash compare on the seed world) proves the pixels are
  unchanged — a `Frame` snapshot alone does *not* prove pixel parity if the renderer re-orders or
  re-plans; (c) preserve the current invariant that every plateau is present in the placement map
  before a click dereferences it (`main.js`'s node-pick has no null guard — keep that guarantee
  explicit so the extraction can't NPE on a plateau added between draw and click).
  **This is the tracked requirement to approve now.**
- **Phase 2 — make layout a strategy; compose #41 + #42.** Promote `spreadNodes`→`spreadLayout`
  and land PR #41's `forceLayout` as a sibling strategy; confirm focus/context (viewModel) +
  force (layout) compose. Land #41's Godot half straight to main (additive).
- **Phase 3 — prove it with a second web renderer.** A `webglRenderer()` (Three.js or raw WebGL)
  implementing the same `Renderer` — an in-browser 3D view, drop-in via the injection point. This
  is the in-client analogue of what Godot already proves cross-client.
- **Phase 4 (optional) — lift the shared shape into a doc/contract** both clients cite (a tiny
  `VIEW_PIPELINE.md`), so new renderers on either side implement the same four stages.

## 9. Open questions

- **Hit-testing ownership — resolved (§4).** Kept as a pure `HitTest(positions, x, y)` strategy,
  *not* on `Renderer`, so the web path is untouched in Phase 1 and a 3D renderer supplies its own
  raycast implementation over its own placements. Recorded here so the decision is traceable.
- **A 3D `Layout`?** In 3D the scene has room, so `spreadLayout` is a no-op and GA placement may
  suffice; a 3D `forceLayout` is speculative. `Layout` stays web-only until there's evidence
  (Phase 2+). PR #41's Godot changes are 3D *separation* inside `place`/`world`, not a `Layout`.
- **Frame granularity.** Is one `Frame` per paint the right unit, or do we want a retained
  scene-graph diff for large graphs? (Start with immediate-mode `Frame`; revisit only if perf
  demands — and beware coupling retained state into the renderer.)
- **`viewModel` vs LOD (#31 / R-0040).** Semantic zoom (expand a plateau into a sub-roadmap) is a
  *view-model* transform — this RFC's seam is where it will live. Sequencing: land the seam first.

## 10. Proposed plan & decision

**Recommendation:** approve the `place → layout → view-model → renderer` pipeline as the client
presentation contract, and **Phase 1** (the additive, behaviour-preserving extraction in the web
client) as the next tracked requirement. Phase 2 (compose #41+#42) follows immediately and is the
concrete reason to do this now; Phase 3 (a WebGL renderer) is gated on Phase 1's seam.

> Decision requested: adopt the view-pipeline abstraction + Phase 1 as a tracked requirement
> (presentation-only, additive, no behaviour change), or hold.

## 11. Changelog

- 2026-07-03 architect design review: **REQUEST-CHANGES → resolved.** (#1, BLOCKING) the original
  "#41 and #42 compose" was factually wrong — #41's diff *also* rewrites emphasis
  (`nodeTier`/`lensId`/`lensMode`), a rival to the merged #42 → §5 rewritten to "keep #41's
  `forceLayout`, drop its redundant emphasis half" (the sharper argument). (#2) `Layout` is
  web-only; Godot mirrors `place`/`label-plan`/`draw`, not `layout` → §3.2/§4/§6/§9 corrected.
  (#3) hit-test kept a **pure `HitTest(positions,x,y)` strategy**, NOT moved onto `Renderer`
  (which today's code already does right) → §4/§8/§9. (#4) Phase 1 pixel-parity de-risked: named
  z-order + declutter-chaining as the acceptance criterion + a **golden canvas snapshot**, not
  only a Frame snapshot. (#5) expanded the `Frame` to cover community ring (co-occurring with the
  mastered ring), ✓ glyph, marker stacking/state, peer fanning/hue, and explicit z-tiers. (#6/#7)
  noted the node-pick null-guard invariant and that `forceLayout` is unmerged draft. Architect
  confirmed §3.1 (the client DTO seam is genuinely DI'd) and §3.2 (the pipeline is really emergent
  on both clients, not retrofitted). **Status stays Draft** (RFC), core sections now accurate.
- 2026-07-03 created (Draft) — proposal + phased plan. Formalizes the pipeline already emergent
  on both clients (web `project/layout/labels/render`; Godot `place_node/label_plan/world`) and
  adds the `Layout` / `Renderer` / `HitTest` injection points. No production code changed.
