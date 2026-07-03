# Parallel dev tasks — team dispatch (R-0025 + related)

Workstreams for the **web + Godot parallel** goal. Each track has file ownership so
multiple devs can land PRs without conflict. Complements [`BACKLOG.md`](BACKLOG.md)
(epics/issues) and [`../specs/0025-vr-immersive-visualization.md`](../specs/0025-vr-immersive-visualization.md).

**Status legend**

| Status | Meaning |
|--------|---------|
| **Ready** | No blockers — pick up now |
| **Blocked** | Waiting on spec, contract, or another task |
| **Done** | Landed on `main` or the active feature branch |

Last updated: 2026-07-03.

---

## Conflict avoidance (read first)

| Track | Owns | Do not touch without sync |
|-------|------|---------------------------|
| Godot | `apps/godot/**`, Godot slices of `crates/mp-godot` | — |
| Web | `apps/web/**` | `scripts/serve.py` sync contract |
| Core | `crates/mp-domain`, `mp-graph`, `mp-crdt`, `mp-identity`, `mp-reputation` | — |
| Bindings | `mp-wasm` **or** `mp-godot` per dev | Keep DTO JSON shapes identical |
| Shared | `apps/web/export/{world.bin, focus.json, reputation.json}` | Schema changes → short note in this doc + both clients |

**Merge rule:** core/bindings first; clients consume stable DTOs. One feature should not
edit `world.gd` and `main.js` in the same PR.

---

## Track A — Godot 3D explorer (R-0025)

| ID | Task | Status | Issue | Notes |
|----|------|--------|-------|-------|
| A1 | 3D path ribbons — glowing edges for followed path steps | **Blocked** | #28 | Needs **C1** `paths_json` in mp-godot |
| A2 | Fly-to topic — tween camera when `focus.json` updates | **Ready** | — | `fly_camera.gd`, `world.gd` |
| A3 | Domain colour bands — tint plateaus by `domain_id` | **Ready** | — | Read-only DTO |
| A4 | Bridge labels — billboard `concept` on hover / focus neighbor | **Ready** | — | |
| A5 | Resource markers — orbs from `resources_json` | **Ready** | R-0014 | Read-only |
| A6 | Minimap / compass — 2D inset (e1×e3) synced to camera | **Ready** | — | New `minimap.gd` |
| A7 | OpenXR rig — enable when OpenXR init succeeds | **Blocked** | SPEC-0025 AC4 | Needs **E4** interaction map |
| A8 | Worldspace study panel — description on focused plateau | **Blocked** | SPEC-0025 AC5 | Needs **E3** wireframe |
| A9 | Headless tests — focus file parse, path overlay, fog | **Ready** | — | `test/run_tests.gd` |
| A10 | In-world vote / sign | **Blocked** | — | Needs **C2** event-log sync |
| A11 | Signed-event-log ingestion | **Blocked** | #28 | Needs **C2** + **E2** contract |

**Done on active branch:** flat-3D scene, CRDT hot-reload, focus/reputation sync, label
declutter, native `reachable_plateaus_json`.

---

## Track B — Web 2D authoring & study

| ID | Task | Status | Issue | Notes |
|----|------|--------|-------|-------|
| B1 | Paths trust polish — weight published paths by author reach | **Ready** | #27 | `paths.js`, R-0035 |
| B2 | Path next-step HUD — persistent toolbar chip | **Ready** | #26 | `main.js`, `render.js` |
| B3 | Obsidian import UX — progress, overlap preview, summary | **Ready** | R-0021 | Import flow |
| B4 | Dense-graph layout presets — compact / study / overview | **Ready** | — | `layout.js` |
| B5 | 2D↔3D deep link — shareable URL hash for focus payload | **Ready** | — | Extends sync |
| B6 | Export panel — Godot sync status in toolbar | **Ready** | — | Read `export/` mtimes |
| B7 | Offline study digest — markdown/PDF of focused subgraph | **Ready** | R-0026 | New `digest.js` |
| B8 | Cross-cutting resources UI (multi-pin) | **Ready** | R-0028 | Study panel |
| B9 | Path grounding UI (meet-based shared islands) | **Blocked** | #17 | Needs **C4** + **E1** |

**Done on active branch:** force layout, focus lens, paths author/follow/publish (slices 1–4).

---

## Track C — Rust core & bindings

| ID | Task | Status | Issue | Notes |
|----|------|--------|-------|-------|
| C1 | `paths_json` in mp-godot (read-only Path DTOs) | **Ready** | #25 / #28 | Unblocks **A1** |
| C2 | Event-log sync — `export/events.json` for Godot | **Blocked** | #28 | Needs **E2** contract |
| C3 | RFC-0002 Phase 2 — overlap markers in wasm | **Ready** | #17 | `mp-domain`, `mp-wasm` |
| C4 | Path grounding — meet-based shared islands | **Blocked** | #17 | Needs **E1** SPEC-0039 §2.5 |
| C5 | Binding parity tests — wasm vs gdext JSON | **Ready** | — | Test-only |
| C6 | `nearest_plateaus_json` in mp-godot | **Ready** | R-0007 | Mirrors wasm |

**Done on active branch:** `reachable_plateaus_json`, reputation parse in mp-godot.

---

## Track D — Import, infra & DX

| ID | Task | Status | Notes |
|----|------|--------|-------|
| D1 | CI: Godot headless tests | **Ready** | `.github/workflows` |
| D2 | CI: GDExtension build (Linux) | **Ready** | `cargo build -p mp-godot --features gdext` |
| D3 | JS lint gate (ESLint + Prettier) | **Ready** | `apps/web/src` |
| D4 | `start-dev.sh` health check — fail if Godot/.so missing | **Ready** | `scripts/` |
| D5 | Sample dense vault fixture + import demo script | **Ready** | `fixtures/` |
| D6 | PWA manifest — installable web client | **Ready** | `apps/web` |
| D7 | Docker dev image (Godot + Rust + serve) | **Ready** | Optional |

---

## Track E — Spec & design (unblocks code)

| ID | Task | Status | Unblocks |
|----|------|--------|----------|
| E1 | Finalize SPEC-0039 §2.5 (meet-grounding) | **Ready** | C4, B9 |
| E2 | Sync contract doc — `focus.json`, `reputation.json`, future `events.json` | **Ready** | C2, B5, B6 |
| E3 | Godot study panel wireframe | **Ready** | A8 |
| E4 | OpenXR interaction map (point / grab / teleport) | **Ready** | A7 |

---

## Suggested 4-person split (all **Ready** tasks)

| Dev | Focus | Tasks |
|-----|-------|-------|
| 1 — Godot | 3D explorer | A2, A3, A4, A5, A6, A9 |
| 2 — Web | 2D study + import | B1, B2, B3, B4, B6, B8 |
| 3 — Rust | Bindings + domain | C1, C3, C5, C6 |
| 4 — Infra | CI + fixtures | D1, D2, D3, D4, D5 |

Architect / tech lead: **E1–E4** (can run in parallel with all tracks).

---

## Quick wins (**Ready**, ~1–2 days each)

1. **A2** — camera fly-to on web focus sync  
2. **B6** — Godot sync status in web toolbar  
3. **A3** — domain colour in 3D  
4. **C5** — binding parity tests  
5. **D1** — Godot headless in CI  

---

## Serial dependencies (do not parallelize)

```
E2 ──► C2 ──► A10, A11
E1 ──► C4 ──► B9
C1 ──► A1
E3 ──► A8
E4 ──► A7
```

Export schema changes: **one PR**, both clients updated together.

---

## Weekly sync checkpoints

1. **DTO parity** — wasm JSON === gdext JSON (**C5**)  
2. **Before path in 3D** — **C1** merged, then **A1**  
3. **Before OpenXR** — **E4** accepted, then **A7**  

---

## GitHub issue mapping

Create or label issues with track prefix (`A2`, `B6`, …) and status `ready` when picking
up work. Epic parents: **#13** (RFC-0002), **#24** (R-0039), R-0025 (Godot — see
[`BACKLOG.md`](BACKLOG.md) Front 3).
