# R-0005 — Playable web POC: a navigable fog-world that syncs between two browser tabs without a server

- **Status:** Met
- **Milestone:** POC — Web fog-world (vertical slice across Phases 0–3)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-31
- **Depends on:** R-0001, R-0003, R-0004
- **Realized by:** SPEC-0005
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The project must have a **playable, shareable web artifact** that makes the core
idea legible in seconds: the knowledge graph rendered *as geometry*, with the
fog mechanic and serverless convergence both visible in a single static page.

A person opening the page sees the seed knowledge graph drawn as a 2D map —
plateaus placed by their geometric-algebra position, bridges drawn as labelled
edges between them. Plateaus the visitor cannot yet "reach" are shown **fogged**;
reachable ones are **lit**. Clicking a lit plateau *traverses* it, which grows
the visitor's understanding in that plateau's direction and **lifts the fog** on
newly-aligned neighbours — the central loop of the world, made interactive.

Opening the same page in a **second browser tab** yields a second, independent
replica. An edit made in one tab (adding a plateau, or casting a vote on a
resource) propagates to the other tab and both **converge to the same graph
state** — carried only as CRDT byte messages over a same-origin channel, with no
server and no shared JavaScript state. Reputation is never carried on that
channel; it stays local to each tab.

## 2. Rationale

Phases 0–3 produced a correct knowledge graph, a GA reputation/fog engine, a WASM
bridge, and a converging CRDT — but the only thing a person can *see* today is a
text log in a developer console. The vision ("knowledge graph as geometry"; an
offline-first, decentralized world) is impossible to convey or evaluate without a
visual, hands-on slice. This POC is that slice: it turns the existing audited
Rust core into something a non-developer can open and understand, and it proves
the two hardest-to-believe claims — *the map is the geometry* and *two clients
agree with no server* — in one shareable link. It also forces the first real
piece of "CRDT in the browser" plumbing (the sync engine compiled to and exposed
through WASM), which every later multiplayer phase depends on.

## 3. Acceptance criteria

- **AC1.** `mp-crdt` compiles for `wasm32-unknown-unknown`. `redb` and
  `CrdtStore` are gated behind a default-on `storage` cargo feature so the sync
  core (`CrdtDoc`, `SyncSession`, `ResourceVote`) builds with
  `--no-default-features`. Native `cargo test --workspace` is unchanged and green;
  `cargo build -p mp-crdt --target wasm32-unknown-unknown --no-default-features`
  succeeds. The native public API is unchanged (the `storage` feature is on by
  default).
- **AC2.** `mp-wasm` exposes the CRDT to JavaScript: construct a replica, add a
  plateau, cast a vote, read a plateau / the four root keys / a resource tally,
  produce the next sync message as bytes, and apply a peer's sync-message bytes.
  Every fallible call returns a thrown JS `Error` on bad input — no panic crosses
  the FFI.
- **AC3.** An automated test (runnable under `wasm-bindgen-test --node`) drives
  **two** in-process replicas through `generate_message`/`receive_message` to
  quiescence using only the WASM byte API; afterwards the receiver contains the
  sender's plateau and the two replicas report equal heads. This is the
  machine-checked proof behind the two-tab demo.
- **AC4.** `apps/web` is a static page (no bundler required) that loads the WASM,
  builds the seed graph, and renders it: each plateau drawn at a 2D position
  derived from its GA `position`, each bridge drawn as a labelled edge.
  Unreachable plateaus render **fogged** and reachable plateaus **lit**, driven by
  the WASM `reachable_plateaus` query.
- **AC5.** Clicking a lit plateau accumulates a reputation vector in that
  plateau's GA direction (client-side) and re-queries reachability; plateaus that
  become reachable visibly clear from fog. This reputation is an explicit
  **demo stand-in** for Phase-8 signed-event reputation — labelled as such in the
  UI/code — and is **not** synced.
- **AC6.** With the page open in two tabs of the same browser, an edit in tab A
  (add a plateau and/or cast a vote) appears in tab B, and both tabs converge to
  the same set of plateaus and the same vote tally. Propagation crosses tabs only
  as `mp-crdt` sync byte messages over a `BroadcastChannel`; there is no server
  and no shared mutable JS object between tabs.
- **AC7.** Reputation is not on the wire (CLAUDE.md §7): the cross-tab channel
  carries only graph CRDT bytes, the per-tab fog/reputation state never crosses
  it, and the synced document's root keys remain exactly
  `{bridges, plateaus, resources, votes}`.
- **AC8.** `cargo test --workspace` is green; the new WASM-binding test passes
  under `wasm-bindgen-test`; `cargo clippy --workspace --all-targets -- -D warnings`
  is clean on the host **and** the `wasm32-unknown-unknown` target; `cargo fmt` is
  clean; no `unwrap()` in library code without a `// SAFETY:` comment; no panic
  crosses a public WASM API; and the page loads with no uncaught console errors.

## 4. Constraints & non-goals

- **Reuses the existing core.** Rendering and interaction call the already-audited
  `mp-graph` / `mp-reputation` / `mp-crdt` logic through `mp-wasm`. No graph, GA,
  or CRDT logic is re-implemented in JavaScript. No new math library.
- **`mp-crdt` stays reputation-free** (CLAUDE.md §7). The `storage` feature-gate
  must not change the crate's public API on native builds, and must not introduce
  any reputation field into the synced document.
- **Non-goals:**
  - *3D / Godot.* A 2D canvas (or SVG) is sufficient to prove the mechanic; the
    navigable 3D world is Phase 6 (and will also be served from `apps/web`).
  - *AI companion (Alebrije).* Phase 4.
  - *Real networking / relay.* `BroadcastChannel` is a same-origin, two-tab
    stand-in for the Gun.js relay and real peer transport, which are Phase 5. No
    `tokio`/async, no WebSocket, no relay in this POC.
  - *Identity & signed events.* Phase 8. The traverse-time reputation is a local
    demo stand-in, not the `mp-reputation` Eigentrust engine, and is never synced.
  - *Persistence.* No `redb`/IndexedDB persistence in the browser this POC; a
    reload starts fresh. (`redb` persistence remains the native default.)
  - *Production polish.* Styling, accessibility, mobile, and bundle optimization
    are Phase 9.

## 5. Open questions

- **Wasm randomness.** `automerge` needs a randomness source for actor ids on
  `wasm32`; confirm whether a `getrandom`/`js` feature (as already used for
  `uuid`) must be wired, and where. **To settle in SPEC-0005 / implementation.**
- **2D projection.** How to project the grade-1 GA `position` (e1, e2, e3) to
  screen coordinates — orthographic drop of e3, or a fixed 2-axis projection with
  labelled axes? **To settle in SPEC-0005.**
- **Binding shape.** Whether the CRDT methods extend the existing `WasmGraph`
  type or live on a new `WasmCrdtDoc` type. **To settle in SPEC-0005.**
- **App home & build.** Confirm `apps/web/` as the home and a zero-build static
  ES-module layout (matching the existing `mp-wasm/www` harness), including how
  the `wasm-pack` `pkg/` output is referenced. **To settle in SPEC-0005.**

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Build a 2D web POC now as a vertical slice across Phases 0–3, ahead of the roadmap's Phase 4 | The core is invisible today; a shareable visual is needed to convey/evaluate the vision and to stand up the first browser-CRDT plumbing every later multiplayer phase needs |
| 2026-05-31 | Two-tab sync uses `BroadcastChannel` carrying only `mp-crdt` byte messages; no server | Demonstrates serverless convergence with a same-origin stand-in for the Phase-5 relay, keeping the POC pure-client and matching `SyncSession`'s transport-agnostic design |
| 2026-05-31 | Traverse-time reputation is a client-side, un-synced demo stand-in | Real reputation is computed from signed events (Phase 8) and must stay out of the CRDT (CLAUDE.md §7); the POC only needs *a* reputation vector to drive the fog query |
| 2026-05-31 | Expose the CRDT to wasm by feature-gating `redb`/`CrdtStore` behind a default-on `storage` feature, not by splitting the crate | Keeps the native API and crate boundary intact while letting wasm depend on the sync core with `--no-default-features` |

## Changelog

- 2026-05-31 created (Draft) — pending architect design review of SPEC-0005, then acceptance
- 2026-05-31 SPEC-0005 architect-approved (with changes folded in); all four open
  questions settled in the spec. Status Draft → **Accepted**
- 2026-05-31 implemented (SPEC-0005) and QA signed off — all of AC1–AC8 PASS.
  Both open questions settled in implementation: wasm randomness flows through
  `uuid`'s `js` feature (enabled on `wasm32` in *both* `mp-wasm` and, for AC1's
  standalone build, `mp-crdt`); no `getrandom` dep needed. Gates green: native
  `cargo test --workspace` (59), `wasm-pack test --node` (4, incl. the AC3
  two-replica sync), clippy `-D warnings` on host + `wasm32` (mp-wasm and mp-crdt
  `--no-default-features`), fmt, `project.js` node unit test. Verified in-browser:
  page loads clean, renders the geometry + labelled bridges, fog lifts on
  traverse, a fresh peer converges over `BroadcastChannel` with no doubling, and
  only `Uint8Array` CRDT bytes cross the wire (`root_keys` == the four data maps).
  Architect PR review: APPROVE. Status Accepted → **Met**
