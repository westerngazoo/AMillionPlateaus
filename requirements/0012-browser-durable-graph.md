# R-0012 — Browser-durable graph: the Draft DB survives a reload

- **Status:** Accepted
- **Milestone:** POC — Draft DB (durability)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** R-0004 (CRDT doc + core save/load), R-0005 (BroadcastChannel sync), R-0011 (plateau authoring)
- **Realized by:** SPEC-0012 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Today the browser graph is ephemeral. The CRDT doc lives only in WASM memory:
on every page load it is rebuilt from the deterministic seed, and authored
plateaus (R-0011) survive only as long as a tab stays open or another tab is
live to re-sync them. Close every tab and the drafted world is gone.

This requirement makes the graph **durable in the browser**: the Automerge CRDT
document is snapshotted to **IndexedDB**, and on startup the world is restored
from that snapshot — so a wizard's drafted plateaus (and any synced-in state)
survive a full close and reload, with no server and no other tab open. This is
what turns the "Draft DB" (R-0011) into an actual db in the only app that exists.

It also closes the redb gap honestly: redb cannot target wasm32, so the browser
durable store is **IndexedDB** (binary-blob capable, large quota), holding the
same Automerge save-blob that the native `CrdtStore` (redb) holds — one logical
contract, two platform backings.

## 2. Rationale

R-0011 gave wizards a write operation but, as its corrected AC3 records, what
they write is not durable. Durability is the difference between a toy and a
db: a learning world you can grow but that forgets everything on reload is not
inhabitable. IndexedDB is the correct browser primitive — it stores binary blobs
natively (Automerge snapshots are `Uint8Array`, would need base64 bloat in
localStorage) and has a far larger quota than localStorage's ~5 MB string cap.

The core already has the hard parts: `CrdtDoc::save() -> Vec<u8>` and
`CrdtDoc::load(bytes)` exist and are tested (R-0004). The work is a thin WASM
bridge to expose them and a small JS persistence module — mirroring how the
signed event log already persists to localStorage (R-0010). Reputation stays
out of the snapshot (CLAUDE.md §7); only the four CRDT data maps are stored.

## 3. Acceptance criteria

- **AC1 — Save/load exposed to JS.** `WasmCrdtDoc` exposes a `save()` returning
  the document's bytes and a `load(bytes)` that reconstructs an equivalent
  document. A save → load round-trip preserves all plateaus, bridges, resources,
  and votes (delegates to the audited core `CrdtDoc::save`/`load`).

- **AC2 — Restore on startup (no other tab needed).** On page load, if a snapshot
  exists in IndexedDB, the world is restored from it: a plateau authored in a
  previous session reappears after a full browser close + reopen, with **no other
  tab open** and **no relay**. If no snapshot exists, the world starts from the
  deterministic seed exactly as today.

- **AC3 — Persist on change (debounced).** After any local CRDT edit (authoring a
  plateau, a vote) or an inbound sync that changes the doc, the current snapshot
  is written to IndexedDB. Writes are debounced/coalesced so rapid edits do not
  thrash the store; the last write reflects the final state.

- **AC4 — Seed is idempotent over a restore.** The deterministic seed
  (`seed_plateau`/`seed_bridge`, fixed ids) is applied on every load; applied on
  top of a restored snapshot it converges (no duplicated seed nodes, no lost
  authored nodes). Restore-then-seed and seed-then-restore yield the same world
  (CRDT convergence, R-0004 AC4).

- **AC5 — Restored authored plateaus traverse correctly.** State that maps a
  plateau id to its domain (`DOMAIN_OF`) is rebuilt from the restored document
  (each plateau carries its `domain_id`), so a restored authored plateau scores
  reputation under its own domain, not a fallback — traversal/fog behave as they
  did before reload.

- **AC6 — Snapshot holds only graph state (CLAUDE.md §7).** The IndexedDB snapshot
  is exactly the Automerge doc whose root keys stay `{bridges, plateaus,
  resources, votes}`. No reputation, persona, identity secret, model config, or
  voice is written into the snapshot (those remain their own local stores).
  Reputation is still recomputed from the signed event log, never restored.

- **AC7 — Offline/unavailable-safe.** If IndexedDB is unavailable (private mode,
  blocked, quota error), the app degrades gracefully to today's in-memory
  behavior — the world still loads from seed, authoring still works for the
  session — with **no uncaught console errors**. A persistence failure never
  takes down the world.

- **AC8 — Green across all suites.** The JS persistence helpers are unit-tested
  against a fake IndexedDB (no browser), proving put/get round-trip, the
  debounce/coalesce, and the no-IndexedDB fallback. `cargo test --workspace`,
  `wasm-pack test --node` (the new save/load bindings), `node --test
  apps/web/src/*.test.mjs`, clippy `-D warnings` (host + `wasm32`), and `cargo
  fmt --all --check` all green; the page authors a plateau, reloads, and shows it
  with no uncaught console errors.

## 4. Constraints & non-goals

- **IndexedDB, not redb, in the browser.** redb does not target wasm32. The
  native `CrdtStore` (redb) is unchanged and remains the durable store for a
  future `apps/server`; the browser uses IndexedDB for the same save-blob.
- **Thin WASM addition only.** The Rust changes are limited to exposing
  `save()`/`load()` on `WasmCrdtDoc` (wrappers over the existing core) plus one
  additive `domain_id` field on the plateau DTO (value marshalling, needed for
  AC5). No change to `mp-graph`, `mp-crdt` core logic, `mp-reputation`, or
  `mp-identity`.
- **One snapshot, whole-doc.** This POC persists the whole Automerge doc as one
  blob (matching `CrdtStore`'s model), not incremental change-chunks. Incremental
  persistence/compaction is a later optimization.
- **Snapshot is per-origin/browser, local-first.** It is not synced or uploaded;
  cross-device durability rides on the existing sync/relay path, not on the
  snapshot.
- **Non-goals:** server-side persistence / `apps/server` (separate track); IPFS
  content (Layer 3); migration/versioning of old snapshots beyond "unreadable →
  discard and reseed"; deletion/editing of plateaus (still create-only, R-0011).

## 5. Open questions

- **Restore vs. seed ordering.** Load snapshot then apply idempotent seed, or
  seed a fresh doc then merge the snapshot in? Both must converge (AC4); the spec
  picks one and justifies it.
- **Debounce window.** A fixed small delay (e.g. 250–500 ms) vs. persist-on-idle.
- **Snapshot key/versioning.** A single fixed IndexedDB key vs. a versioned key
  that lets a future schema bump invalidate cleanly.
- **Corrupt/older snapshot.** On `load` error, discard and reseed (AC7) — confirm
  that is acceptable for the POC vs. attempting a migration.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Browser durable store is IndexedDB, holding the Automerge save-blob | redb can't target wasm32; IndexedDB stores binary natively with large quota, unlike localStorage |
| 2026-06-02 | Reuse core `CrdtDoc::save`/`load`; only expose them on `WasmCrdtDoc` | The durable contract is already audited (R-0004); browser work is a thin bridge + JS module |
| 2026-06-02 | Snapshot excludes reputation/persona/identity | CLAUDE.md §7 — only the four CRDT data maps are graph state; reputation is recomputed from the event log |

## Changelog

- 2026-06-02 created (Draft) — carved out of R-0011's corrected AC3. Pending
  SPEC-0012 + architect design review, then acceptance.
- 2026-06-02 SPEC-0012 drafted and architect-reviewed (APPROVE-WITH-NITS; all
  findings folded in). **Status → Accepted**; ready for implementation.
