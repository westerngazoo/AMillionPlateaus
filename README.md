# A Million Plateaus — Project Root

> *A decentralized, spatial, multiplayer learning world where knowledge is geometry.*
> Named after Deleuze & Guattari's *Mille Plateaux* — extended into navigable space.

---

## Quick orientation

| File | Purpose |
|---|---|
| `docs/VISION.md` | Philosophy, narrative, design principles |
| `docs/REQUIREMENTS.md` | Full functional & non-functional requirements |
| `docs/GARUST_INTEGRATION.md` | How garust powers graph geometry and ranking |
| `architecture/SYSTEM_ARCHITECTURE.md` | Full system design, components, data flow |
| `architecture/GRAPH_SCHEMA.md` | Knowledge graph schema in Rust types |
| `architecture/DECENTRALIZATION.md` | CRDT, Gun.js, Nostr, IPFS strategy |
| `architecture/ALEBRIJE_AI.md` | AI companion design, prompt architecture |
| `specs/SDLC.md` | Full SDLC: phases, milestones, deliverables |
| `specs/ROADMAP.md` | Phased roadmap with priorities |
| `specs/TECH_STACK.md` | Full stack decisions with rationale |
| `specs/API_CONTRACTS.md` | Internal API contracts between subsystems |
| `CLAUDE.md` | Instructions for Claude Code agent |

---

## Repo structure (target)

```
million-plateaus/
├── crates/
│   ├── mp-graph/        # Core knowledge graph (Rust + garust)
│   ├── mp-crdt/         # CRDT sync layer (automerge-rs)
│   ├── mp-reputation/   # Eigentrust via GA multivectors
│   └── mp-wasm/         # WASM bindings for browser
├── apps/
│   ├── web/             # Three.js / Godot WASM frontend
│   ├── server/          # Colyseus multiplayer node
│   └── alebrije/        # AI companion service (Claude API)
├── docs/
├── architecture/
└── specs/
```

---

## Local checks

CI (`.github/workflows/ci.yml`) gates every PR. To run the same checks locally:

- **Rust:** `cargo fmt --all -- --check` · `cargo clippy --workspace --all-targets -- -D warnings` · `cargo test --workspace` (needs a sibling `../garust` checkout).
- **Web tests:** `node --test apps/web/src/*.test.mjs` (Node ≥ 20, no npm install — plain ES modules).
- **Web lint/format (Biome):** Biome is a single binary — no `node_modules`. Install it once (`curl -fsSL https://github.com/biomejs/biome/releases/download/@biomejs/biome@2.5.2/biome-linux-x64 -o biome && chmod +x biome`, or `brew install biome`), then run `biome check apps/web/src` (add `--write` to auto-fix formatting). CI runs `biome ci apps/web/src`, scoped by root `biome.json` to `apps/web/src/**`.

---

## Philosophy in one sentence

> The graph IS the platform. The 3D world is one renderer. Wizard rank is geometry.
