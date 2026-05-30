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

## Philosophy in one sentence

> The graph IS the platform. The 3D world is one renderer. Wizard rank is geometry.
