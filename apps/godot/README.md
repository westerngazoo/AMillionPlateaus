# apps/godot — immersive 3D client (R-0025)

The **3D explorer** for A Million Plateaus. Plateaus sit at real `(e1, e2, e3)` positions with **e2 as depth** — the axis the 2D map collapses. This is the long-term goal for dense imported worlds (Obsidian vaults, 50+ topics).

## Parallel dev with the web app

From the **repo root**:

```bash
./scripts/start-dev.sh
```

This starts:

| Client | URL / window |
|--------|----------------|
| **2D web** | http://localhost:8145 |
| **3D Godot** | desktop window |

**Sync:** every graph edit in the browser `PUT`s the CRDT blob to `apps/web/export/world.bin`. Godot watches that file and reloads ~every second.

### First-time setup

```bash
./scripts/install-godot.sh      # Linux x86_64 — or install Godot 4.4 yourself
./scripts/build-godot-ext.sh    # native GDExtension (GraphSourceNative)
```

### Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/start-dev.sh` | **Web + Godot in parallel** (recommended) |
| `./scripts/start-web.sh` | 2D only |
| `./scripts/start-godot.sh` | 3D only |
| `./scripts/build-godot-ext.sh` | Build `libmp_godot.so` / `.dylib` |

### 3D controls

- **Right-drag** — look around
- **WASD** — fly
- **E / Q** — up / down
- **Wheel** — zoom
- **Shift** — faster
- **Left-click plateau** — focus lens (current topic full size, neighbors medium, rest dim)

## Architecture

- `src/place_node.gd` — `x=e1, y=e3, z=e2` + `spread_positions` for dense graphs
- `src/world.gd` — scene builder, blob hot-reload, focus lens
- `src/graph_source_native.gd` — wraps `mp-godot` GDExtension
- `crates/mp-godot` — Rust core → JSON DTOs (same shapes as `mp-wasm`)

## Tests

```bash
godot --headless --path apps/godot --script res://test/run_tests.gd
```

## Status

- ✅ Slice 1: flat-3D scene, fixture + native binding, fly camera
- ✅ Parallel dev: web → `world.bin` → Godot hot-reload
- ✅ 3D focus lens (click plateau)
- 🔜 Web Godot export embed
- 🔜 OpenXR rig (VR)
- 🔜 Worldspace study panel
