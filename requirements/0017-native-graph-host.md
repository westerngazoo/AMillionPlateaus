# R-0017 — Native graph host: the durable redb backing, wired

- **Status:** Accepted
- **Milestone:** Infra — durable native host
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** R-0004 (CRDT doc + CrdtStore), R-0008 (domain-agnostic graph), R-0012 (browser save-blob)
- **Realized by:** SPEC-0017 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The redb-backed durable stores (`CrdtStore`, `GraphDb`) are **built and tested
but wired to no running application** (GA_DB.md §6): the only app is the browser
(WASM), which cannot link redb and persists to IndexedDB instead. This
requirement delivers the first application that actually uses the native durable
store — a small **native graph host** (`mp-host`) that owns a redb-backed
`CrdtStore`, seeds the canonical world into it, reports its state, and — the
payoff — **merges an Automerge save-blob exported from the browser** into the
durable store.

That last capability makes GA_DB.md's "one save-blob, two backings" concrete:
the exact bytes a browser writes to IndexedDB (`WasmCrdtDoc.save()`) merge into
the native redb store and converge, with **no network transport** (transport is
deferred). It is the durable, inspectable, native counterpart to the browser —
the Layer-1 store the layer stack always anticipated.

## 2. Rationale

GA_DB.md names the gap precisely: "redb — GraphDb + CrdtStore built + tested,
NOT wired to any app." Everything downstream of a real decentralized world (a
host that persists the graph, a node others can sync against, the eventual
relay) needs a durable native graph store that an actual process opens and
writes. This requirement is that process, in its simplest honest form: a CLI
host over the audited `CrdtStore`. It needs no transport, no browser, and no new
heavy dependencies — it is pure Rust, fully testable with `cargo test`, and it
turns a tested-but-dormant layer into a working one. The browser-snapshot
**merge** also de-risks the future relay: convergence between a browser replica
and a native replica is proven offline, on the save-blob, before any wire exists.

## 3. Acceptance criteria

- **AC1 — A native host binary.** A new Rust binary `mp-host` offers subcommands
  over a redb-backed `CrdtStore` at a caller-supplied path: `seed`, `stats`, and
  `merge`. Unknown/missing args print usage and exit non-zero; errors are
  reported clearly and never panic the process (no `unwrap` on fallible I/O).

- **AC2 — `seed <db>` creates a durable world.** Seeding builds the canonical
  graph (a small set of plateaus + bridges) as a `CrdtDoc` and persists it to the
  redb store at `<db>`. Seeding is convergent: running `seed` again on the same
  store does not duplicate the seed entities (CRDT idempotent upsert on fixed
  ids, R-0004).

- **AC3 — `stats <db>` reports the persisted graph.** Opening the store and
  projecting via `to_graph` reports counts: plateaus, bridges, resources, votes,
  and crystallized resources — all computed from the persisted CRDT (vote_count
  and crystallization are *derived*, R-0015), never from a side table.

- **AC4 — `merge <db> <snapshot>` ingests a browser save-blob.** Given a file of
  Automerge bytes produced by `WasmCrdtDoc.save()` (a browser's IndexedDB
  snapshot, R-0012), `merge` loads it, merges it into the store's document, and
  persists. The durable store then contains the union of its prior state and the
  snapshot (CRDT convergence, R-0004 AC4) — proving a browser replica and the
  native replica converge on the one save-blob with no transport. Merge is
  idempotent (re-merging the same snapshot changes nothing).

- **AC5 — Durable round-trip.** Whatever `seed`/`merge` persist, a subsequent
  `stats` (a fresh process opening the same redb file) reads back intact; the
  load path re-validates GA invariants (grade-1 positions, even-grade rotors),
  rejecting a corrupt store as an error, not a panic.

- **AC6 — Stateless w.r.t. derived/authoritative state (CLAUDE.md §6/§7).** The
  host persists **only** the CRDT document — exactly the four data maps
  `{bridges, plateaus, resources, votes}`. It stores **no** reputation (reputation
  is recomputed from the signed-event log, never persisted here), and computes no
  authoritative state of its own; resource crystallization remains derived in
  `to_graph`. The host is a durable holder of the graph, not a new authority.

- **AC7 — Pure Rust, no async, lean deps.** `mp-host` is a synchronous Rust
  binary using only `mp-crdt` (storage feature on) + `mp-domain` and the standard
  library for argument parsing — no `tokio`/`async`, no `clap` or other heavy CLI
  framework. It is covered by `cargo` integration tests (seed → stats counts;
  merge adds entities; durable reload across processes; corrupt-store error).

- **AC8 — Green across all gates.** `cargo test --workspace` (incl. the new
  `mp-host` tests), `cargo clippy --workspace --all-targets -- -D warnings`, and
  `cargo fmt --all --check` all green; `mp-host` runs all three subcommands with
  legible output and a correct exit code. (No browser/wasm gate is required —
  this is a native-only crate; the existing wasm gates stay green, untouched.)

## 4. Constraints & non-goals

- **Reuse the audited store.** `mp-host` is a thin CLI over `CrdtStore` /
  `CrdtDoc`; no new persistence logic, no change to `mp-crdt`/`mp-domain` core
  beyond (optionally) extracting a shared seed builder.
- **No transport.** No networking, no WebSocket/relay, no HTTP/API, no
  multiplayer rooms — cross-device transport is explicitly deferred (the prior
  open architecture choice). `mp-host` is local + offline.
- **Not the TS multiplayer server.** This is the durable **graph** host (Rust,
  redb). The anticipated TypeScript `apps/server` (Colyseus presence/rooms) is the
  *transport* layer and remains future work; the two are distinct concerns.
- **Single-writer.** redb's single-writer model is sufficient; no concurrent-host
  coordination, no locking protocol beyond what redb provides.
- **Non-goals:** IPFS/content (Layer 3); a query/HTTP API; auth; live two-replica
  sync (that is transport); `GraphDb` (the per-entity store) — this host uses the
  `CrdtStore` (whole-doc snapshot) path, matching the browser's save-blob.

## 5. Open questions

- **Seed sharing.** Build the seed inline in `mp-host`, or extract a shared
  `seed_graph()` into `mp-domain` reused by the host, the `seed_graph` example,
  and (conceptually) the web seed? Leans toward a small shared builder to avoid
  three diverging seeds, but inline is acceptable for the POC. Spec decides.
- **Crate placement / name.** `crates/mp-host` (consistent with the Cargo
  workspace, which is all `crates/*`) vs. a Rust crate under `apps/`. Leans
  `crates/mp-host`; the name evokes the durable host role.
- **CLI ergonomics.** Bare `std::env::args` matching vs. a tiny hand-rolled
  parser; either is fine given the lean-deps constraint.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Build a native `mp-host` CLI over the redb `CrdtStore` | Closes the GA_DB.md gap (redb built+tested but unwired) with the simplest honest app; pure Rust, fully testable, no transport |
| 2026-06-04 | Headline capability is `merge` of a browser save-blob | Makes "one save-blob, two backings" concrete and de-risks future relay convergence — offline, on the bytes |
| 2026-06-04 | Use `CrdtStore` (whole-doc snapshot), not `GraphDb` | Matches the browser's `WasmCrdtDoc.save()` blob exactly, so the merge demo is byte-compatible |

## Changelog

- 2026-06-04 created (Draft) — pending SPEC-0017 + architect design review, then acceptance.
- 2026-06-04 SPEC-0017 drafted + architect-reviewed (APPROVE-WITH-NITS; redb create-if-missing
  + storage-feature wiring + tidy-ups folded). **Status → Accepted.**
