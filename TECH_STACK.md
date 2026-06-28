# TECH STACK — A Million Plateaus

## Rust Workspace

| Crate | Key deps | Why |
|---|---|---|
| mp-graph | petgraph 0.6, garust (path), uuid 1, serde 1, redb 1, bincode 1 | petgraph is the most mature Rust graph lib; redb is pure-Rust, faster than sled |
| mp-reputation | mp-graph (path), garust (path) | depends only on graph types, GA ops |
| mp-crdt | automerge 0.5, tokio 1 | automerge-rs is the production Rust CRDT lib |
| mp-wasm | wasm-bindgen 0.2, serde-wasm-bindgen 0.6, mp-graph (path), mp-reputation (path) | official WASM bridge |

### Cargo.toml workspace root
```toml
[workspace]
members = ["crates/mp-graph", "crates/mp-reputation", "crates/mp-crdt", "crates/mp-wasm"]
resolver = "2"

[workspace.dependencies]
garust      = { path = "../garust" }   # adjust path to your garust location
serde       = { version = "1", features = ["derive"] }
uuid        = { version = "1", features = ["v4", "serde"] }
petgraph    = "0.6"
redb        = "1"
bincode     = "1"
automerge   = "0.5"
wasm-bindgen = "0.2"
tokio       = { version = "1", features = ["full"] }
```

---

## Node.js Apps

| App | Key deps | Why |
|---|---|---|
| apps/server | colyseus 0.15, express 4, gun, typescript, ts-node | Colyseus is the standard for authoritative multiplayer rooms |
| apps/alebrije | @anthropic-ai/sdk, express 4, typescript | thin proxy; stateless by design |
| apps/web | three.js r165, colyseus-client, gun | Three.js for non-Godot rendering; Godot WASM loaded as module |

---

## Frontend / 3D

| Choice | Why |
|---|---|
| Godot 4 (primary 3D) | Free, GDScript fast to iterate, OpenXR for VR, exports to WASM |
| Three.js (fallback/overlay) | WebGL2 fallback renderer, good for 2D map overlay, UI layer |
| No React/Vue | Game loop and React render loop conflict; Godot owns the DOM canvas |

---

## AI-First OS / Kernel Integration

| Choice | Why |
|---|---|
| WASM Agent Plugins | Sandboxed execution layer allowing AI agents to hook directly into the core graph OS kernel. |
| Security Cloud Native | Agent-generated state is natively synchronized via CRDT/Nostr, treating the decentralized network as a secure extension of the local OS. |
| Dynamic Tooling Generation | Bypasses Linux-style package managers; agents generate bespoke tooling per user, company, or government on the fly. |

---

## Decentralization

| Layer | Tech | Why |
|---|---|---|
| Identity | Nostr (nostr-tools npm) | Keypair-native, signed events, no account creation |
| Content | IPFS + Pinata | Content-addressed, permanent, censorship-resistant |
| Graph sync | Automerge CRDT over Gun.js relay | Offline-first, no central DB |
| Presence | Colyseus | Stateful rooms, built for game presence |

---

## Deployment Targets

| Service | What | Why |
|---|---|---|
| Fly.io | apps/server + apps/alebrije | Edge-deployed, close to LATAM users |
| Cloudflare Pages | apps/web (static + WASM) | Global CDN, free for static |
| Pinata | IPFS pinning | Managed IPFS gateway |
| Nostr public relays | Identity events | Decentralized, no infra needed |

---

## Build Toolchain

```
Rust:   stable channel, wasm-pack for WASM builds
Node:   v20 LTS, pnpm workspaces for apps/
Godot:  4.x, export templates for web
CI:     GitHub Actions — cargo test + wasm-pack build + pnpm test
```
