# `obsidian-dense` — sample dense vault fixture

A small, self-contained **Obsidian-style vault** (30 interlinked notes) for
exercising the importer and demoing a dense world in both the 2D web map and the
3D Godot client. Data only — no code.

The notes deliberately span the three concept-space axes so the imported world
spreads across geometry rather than collapsing to one point
(`GARUST_INTEGRATION.md`): **e1 = Formal / Mathematics**, **e2 = Physical /
Physics**, **e3 = Creative / Music**. Cross-domain notes (e.g.
`Fourier Analysis`, `Symmetry`, `Waves`, `Chords`) create the bridges that make
the graph *dense* — every cluster links to the others.

```
fixtures/obsidian-dense/
├── README.md          ← you are here (NOT part of the vault)
└── vault/             ← the vault to import (30 *.md notes)
    ├── Linear Algebra.md
    ├── Quantum Mechanics.md
    ├── Music Theory.md
    └── … (27 more)
```

## What the importer makes of it

`mp-host import` (SPEC-0021 / R-0021) maps the vault to a knowledge graph:

| Vault element                | Becomes                                             |
| ---------------------------- | --------------------------------------------------- |
| each `*.md` note             | a **plateau** (name = filename, body = its Markdown) |
| each resolved `[[wikilink]]` | a **bridge** between the two plateaus                |
| external / `.pdf` links      | **resources** on the plateau                         |
| note text keywords           | the plateau's deterministic **GA position**          |

Ids are UUIDv5 over stable keys, so re-importing the same vault is idempotent.

## Import it (native → blob)

Build the host CLI and turn the vault into a browser-loadable CRDT save-blob:

```bash
# from the repo root
cargo run -p mp-host -- import fixtures/obsidian-dense/vault /tmp/obsidian-dense.bin
# → imported … (30 notes · N bridges · M resources)
```

## Demo it in 2D (web)

1. Start the web server: `./scripts/start-web.sh` → <http://localhost:8145>
2. Use **Import a world** in the toolbar and select `/tmp/obsidian-dense.bin`.
3. The 30 plateaus merge in and lay out; dense cross-domain bridges appear.

## Demo it in 3D (Godot)

The 3D client reads the CRDT blob at `apps/web/export/world.bin`. Point it at the
imported world and launch Godot:

```bash
cargo run -p mp-host -- import fixtures/obsidian-dense/vault apps/web/export/world.bin
MP_WORLD_BLOB="$PWD/apps/web/export/world.bin" ./scripts/start-godot.sh
```

Or run `./scripts/start-dev.sh` and use the browser's **Import a world** — every
edit re-syncs `export/world.bin`, and Godot hot-reloads the dense vault in 3D
(e2 = depth, the axis the 2D map collapses).

## Regenerating / extending

Add more `.md` files under `vault/`, link them with `[[Note Name]]`, and re-run
the import. To keep the world spread out, bias a note's wording toward one axis
(formal/physical/creative keywords) — the positioner is a simple deterministic
keyword reading (see `crates/mp-host/src/import.rs`).
