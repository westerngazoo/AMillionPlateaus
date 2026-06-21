# apps/godot — immersive client (R-0025 / SPEC-0025)

A Godot 4 client that renders the world as a 3D/immersive scene, **stopping the
empirical-axis collapse** the 2D map projects away. It is a **pure consumer** of the
unchanged GA/CRDT core: it places a plateau at its `{e1,e2,e3}` position and does
**no GA**.

## Status — Slice 1 (Track A foundation)

This slice ships the binding-agnostic, GPU-free foundation:

- `src/place_node.gd` — pure `place_node(e1,e2,e3,fit)` + `compute_fit(positions)`
  (axes `x=e1, y=e3, z=e2`; "up" is the Creative axis). **AC1.**
- `src/label_plan.gd` — pure `plan_labels(rects, focused, lit)` (a port of R-0024's
  `planLabels`) + `project_to_rect(pos, view, proj, viewport, size)` (the
  camera-dependent surface, modelled with a plain `Transform3D`+`Projection` so it is
  testable headless). **AC3.**
- `src/graph_source.gd` — the binding-agnostic interface the scene talks to (§2.1/§3).
- `src/graph_source_fixture.gd` — an in-memory fixture so the scene + tests run with no
  binding yet (the §3.1 parity fixture for later slices).
- `src/world.gd` + `scenes/World3D.tscn` — a flat-3D scene built from a `GraphSource`:
  plateaus placed, bridges drawn, the **reachable set emission-lit** (fog, **AC2** — the
  same set the 2D map lights, never recomputed here).

**Deferred to later slices:** the native `crates/mp-godot` GDExtension + the web
`mp-wasm` JS-interop binding (real data + the parity test, AC2/AC7); the `XROrigin3D`
OpenXR rig + teleport/travel (Track B, AC4); worldspace study (AC5); the native sync
transport (Track D, AC7). No core or `apps/web` change — additive only (AC6).

## Run

Requires Godot 4.x on `PATH` (`godot`).

```sh
# headless tests (pure place/label functions + flat-3D scene smoke)
godot --headless --path apps/godot --script res://test/run_tests.gd   # exit 0 = pass

# the flat-3D demo scene (builds from the fixture)
godot --path apps/godot
```

The `--script` runner is self-contained (no GUT dependency this slice) and exits
non-zero on any failure, so it drops straight into CI. GUT can replace it when the
binding slices land.
