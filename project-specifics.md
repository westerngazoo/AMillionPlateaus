# Project Specifics

This is the **single per-project file**. Every other document in this
methodology is generic and identical across all projects — only this file
changes. Fill it in when the project starts; keep it current as these facts
change.

`CLAUDE.md` imports this file, so its contents are always in context.

## Identity

- **Project name:** A Million Plateaus
- **One-line description:** A decentralized spatial learning world — a navigable knowledge graph rendered as an archipelago of plateaus, with wizard rank as geometric-algebra multivectors.
- **Owner / final decision authority:** Gustavo Delgadillo (gustavo.delgadillo@gmail.com, GitHub: westerngazoo)
- **Repository URL:** https://github.com/westerngazoo/AMillionPlateaus

## Language & toolchain

The concrete commands referenced by `CLAUDE.md` §6 and by the `architect` and
`qa` agents as merge gates. Leave blank until the stack is chosen.

- **Primary language / version:** Rust (stable) for the core workspace (`crates/mp-*`); TypeScript on Node.js 20 LTS for `apps/*` (pnpm workspaces)
- **Build command:** `cargo build --workspace` (Rust); `pnpm -r build` (Node apps)
- **Test command:** `cargo test --workspace` (Rust); `pnpm -r test` (Node apps)
- **Lint command:** `cargo clippy --workspace --all-targets -- -D warnings`
- **Format-check command:** `cargo fmt --all --check`

## Domain notes

The full design set lives in the repository root — read it before touching code:

- `VISION.md` — what the world is and why.
- `GARUST_INTEGRATION.md` — how geometric algebra maps to every core concept.
- `GRAPH_SCHEMA.md` — exact Rust types for plateaus, bridges, wizards, reputation.
- `SYSTEM_ARCHITECTURE.md` — component boundaries and data flows.
- `SDLC.md` — phased delivery plan (Phase 0 → Phase 9).
- `TECH_STACK.md`, `DECENTRALIZATION.md`, `API_CONTRACTS.md`, `ALEBRIJE_AI.md`, `REQUIREMENTS.md`.

Non-negotiable architecture rules (see `CLAUDE.md` in repo root for the full list):

- **garust is the only math layer.** Never use `glam`, `nalgebra`, or any other
  math lib for graph geometry. All positions, rotors, and reputation
  multivectors go through garust. garust is wired as a local **path** dependency
  in the workspace `Cargo.toml` — set it to garust's location on disk before the
  first `cargo build`. If garust is not present, stop and ask the owner; do not
  stub out GA functionality.
- `PlateauNode.position` is always Grade-1; `Bridge.rotor` is always even-grade —
  enforced at construction.
- Reputation is never a scalar — always a `Multivector` scoped by `DomainId`, and
  it is **not** stored in the CRDT (it is recomputed from signed events).
- No `unwrap()` in library code without a `// SAFETY:` comment. `mp-graph`,
  `mp-reputation`, `mp-crdt` are pure computation — no `async`.

## Milestone themes

Mirrors `SDLC.md`. Current phase: **Phase 0 — Foundation** (Cargo workspace
compiles, garust linked, core types defined, seed graph + redb round-trip).
Subsequent phases: GA reputation & fog (1), WASM bridge (2), CRDT sync (3),
Alebrije AI service (4), multiplayer presence (5), 3D world (6), resource
crystallization (7), Nostr identity (8), polish + beta (9).
