# ROADMAP — A Million Plateaus

## Priority tiers

```
P0 — Blocking everything else (do first)
P1 — Core experience (Phase 0–4)
P2 — Social layer (Phase 5–8)
P3 — Polish (Phase 9)
```

## Phase map

| Phase | Weeks | P | Output |
|---|---|---|---|
| 0 — Foundation | 1–2 | P0 | Cargo workspace + seed graph compiles |
| 1 — GA Reputation | 3–4 | P0 | Fog mechanic works via multivector |
| 2 — WASM Bridge | 5–6 | P1 | Graph queryable from browser JS |
| 3 — CRDT Sync | 7–8 | P1 | Two clients sync without server |
| POC — Web fog-world | slice 0–3 | P1 | ✅ Playable 2D fog map; two tabs converge over BroadcastChannel (R-0005); persona creator seeds per-visitor orientation across two domains (R-0006); always-present companion embodies the persona, talks to a bring-your-own model (hosted/local), grounded in the GA graph (R-0007 — Phase 4 brought forward) |
| 4 — Alebrije Service | 9–10 | P1 | AI companion live per plateau |
| 5 — Multiplayer Presence | 11–12 | P2 | Two players see each other |
| 6 — 3D World | 13–18 | P2 | Navigable world in browser |
| 7 — Resource Crystallization | 19–20 | P2 | Voting changes terrain |
| 8 — Nostr Identity | 21–22 | P2 | Signed events, verifiable rank |
| 9 — Beta Polish | 23–26 | P3 | Deployable, shareable |

## First week checklist (start here)

- [ ] `cargo new --name million-plateaus` workspace
- [ ] Copy garust as sibling directory or add as git submodule
- [ ] Scaffold 4 crates: `mp-graph`, `mp-reputation`, `mp-crdt`, `mp-wasm`
- [ ] Paste types from `GRAPH_SCHEMA.md` into `mp-graph/src/types.rs`
- [ ] `cargo build --workspace` → green
- [ ] Write first test: `PlateauNode::new()` produces Grade-1 position vector
- [ ] Commit: "Phase 0 scaffold"
