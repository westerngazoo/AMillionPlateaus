# R-0004 — CRDT sync: two clients converge on graph state without a server

- **Status:** Met
- **Milestone:** Phase 3 — CRDT Sync
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-31
- **Depends on:** R-0001
- **Realized by:** SPEC-0004
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The shareable part of the knowledge graph — plateaus, bridges, resources, and
resource votes — must be representable as a conflict-free replicated data type
(CRDT) so that two clients holding their own replicas can each make local edits
offline and later **converge to the same state** by exchanging changes directly,
with no central authority deciding who wins. A peer must be able to: build a
replica from (and project it back to) an `mp-graph` `KnowledgeGraph`; record a
new plateau, bridge, or resource; cast a vote on a resource; produce a byte
stream of its changes for another peer; apply a peer's byte stream; and persist
the replica to / restore it from local storage.

Convergence is the core property: after any two peers have exchanged all
pending changes, their replicas are **equal**, regardless of the order edits
were made or messages were delivered. Concurrent edits merge — they never
silently overwrite or drop each other.

Reputation is **explicitly excluded** from the CRDT. It is derived locally from
a signed event log (Phase 8), never synced as mutable shared state, so it cannot
be spoofed by manipulating the replicated document (CLAUDE.md §7).

## 2. Rationale

"The graph is the platform" (CLAUDE.md §6) and the world is offline-first and
decentralized (VISION.md). For two wizards to see the same plateaus, bridges,
and resource votes without trusting a server to arbitrate, the graph's shared
state must merge deterministically on each client. A CRDT gives that: each peer
edits its own replica, and merges are associative, commutative, and idempotent,
so every peer that has seen the same set of changes holds the same graph — the
precondition for multiplayer presence (Phase 5) and resource crystallization
(Phase 7). Keeping reputation out of the CRDT is what prevents a peer from
inflating its own rank by editing the replicated document directly; rank stays a
*computed* function of signed events.

## 3. Acceptance criteria

- **AC1.** `CrdtDoc` wraps an Automerge document whose top level is exactly four
  maps — `plateaus`, `bridges`, `resources`, `votes` — keyed by UUID string.
  `add_plateau(&PlateauNode)`, `add_bridge(&Bridge)`, and `add_resource(&Resource)`
  write an entry; the matching reader reconstructs a valid `mp-graph` value (its
  `validate()` passes — Grade-1 position / even-grade rotor invariants survive the
  round trip) or returns a typed error, never a panic.
- **AC2.** `CrdtDoc::from_graph(&KnowledgeGraph)` hydrates a replica from a graph,
  and `to_graph(&self) -> Result<KnowledgeGraph>` projects it back. For the
  5-plateau / 4-bridge seed, `from_graph` then `to_graph` yields a graph with the
  same plateau ids, names, and positions and the same bridge ids, endpoints, and
  rotors (all invariants intact).
- **AC3.** `ResourceVote` is a **grow-only** counter over `Map<WizardId, weight>`:
  its API can only add or raise a wizard's weight, never remove one or lower it;
  `weighted_sum()` returns the sum of per-wizard weights. Two replicas that each
  record a vote from a *different* wizard on the same resource both retain both
  votes after a merge (the union, not one-wins).
- **AC4.** `SyncSession` drives the Automerge sync protocol transport-agnostically:
  `generate_message() -> Option<Vec<u8>>` and `receive_message(&[u8]) -> Result<()>`.
  In a two-peer test, peer A adds a plateau, the two sessions exchange messages to
  quiescence, and peer B's `CrdtDoc` then contains that plateau — byte streams are
  the only thing that crosses between peers.
- **AC5.** Convergence under concurrency: starting from a shared base, peer A and
  peer B each make a *different* concurrent edit (e.g. A adds plateau X and votes
  on resource R as wizard a; B adds plateau Y and votes on R as wizard b), then
  fully sync. Afterwards both replicas are **equal** (`doc.save()` bytes match,
  or equivalently the projected graphs match), contain the union of both edits,
  and resource R carries both votes. Merge order does not change the result.
- **AC6.** Reputation is not in the CRDT (CLAUDE.md §7): `CrdtDoc` exposes no
  reputation or wizard-profile field or method, the Automerge document has no
  `reputation`/`wizards` key, and `mp-crdt` does not depend on `mp-reputation`.
  A test asserts the document's top-level keys are exactly the four data maps.
- **AC7.** redb persistence: a `CrdtDoc` can be saved to and restored from a
  redb-backed store. The "load → apply a peer's changes → persist" cycle round-
  trips: the reloaded document equals the merged document, and projects to the
  same graph.
- **AC8.** `cargo test --workspace` is green including the two-peer sync test and
  the concurrent-merge test; `cargo clippy --workspace --all-targets -- -D warnings`
  is clean; `cargo fmt` is clean; no `unwrap()` in `mp-crdt` library code without a
  `// SAFETY:` comment, and no panic crosses a public `mp-crdt` API (boundary
  failures are `Result`).

## 4. Constraints & non-goals

- `mp-crdt` depends inward on `mp-graph` only (for the entity types and their
  invariants). It must **not** depend on `mp-reputation`, must not add a math
  library, and reuses `mp-graph`'s serde representation (incl. the `serde_mv`
  adapter) rather than inventing its own encoding of GA values.
- The replica stores only data that is **derivable/shareable** graph state.
  Authoritative reputation is never stored (CLAUDE.md §6, §7).
- **Non-goals:**
  - *Network transport.* `SyncSession` is transport-agnostic (bytes in / bytes
    out). The Gun.js relay and real peer connections are Phase 5; no `tokio`/async
    in `mp-crdt` yet.
  - *Nostr signatures.* A resource's `signature` field is synced as an opaque
    string; verifying it (and recomputing reputation from signed events) is
    Phase 8.
  - *Resource crystallization state machine / UI.* Phase 3 syncs resource records
    and the grow-only vote tally; deriving `ResourceState` transitions
    (Floating → Crystallizing → Crystallized → …) from thresholds and rendering
    them is Phase 7.
  - *Editing existing plateaus/bridges.* Phase 3 treats plateau and bridge
    records as write-once identities (add, not mutate); field-level co-editing of
    a single record is out of scope. Votes are the only mutable shared state and
    are modelled as the grow-only counter.

## 5. Open questions

- Should each entity be stored as a structural Automerge sub-map (field-level
  merge) or as an opaque serde-JSON blob keyed by id? **To settle in SPEC-0004.**
- Should the redb-backed CRDT store live in `mp-crdt` (own table) or extend
  `mp-graph`'s `GraphDb`? **To settle in SPEC-0004.**
- Vote weight is the voter's domain-reputation scalar (SYSTEM_ARCHITECTURE.md).
  Since reputation is out of the CRDT, the weight is supplied by the caller at
  vote time as a plain `f32`. Confirm that is acceptable for Phase 3.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | CRDT holds exactly {plateaus, bridges, resources, votes}; no reputation/wizard state | CLAUDE.md §7 — reputation is computed from signed events, never synced; prevents rank spoofing via document edits |
| 2026-05-31 | `mp-crdt` depends on `mp-graph` only, not `mp-reputation` | Dependencies point inward to the core; reputation has no place in the replicated document |
| 2026-05-31 | `SyncSession` is transport-agnostic (bytes in/out); no async this phase | Keeps Phase 3 pure and host-testable; real transport (Gun.js relay) is Phase 5 per SDLC |
| 2026-05-31 | Vote weight supplied by caller as `f32` at vote time | The reputation that produces the weight lives outside the CRDT; the counter only stores the resulting per-wizard weight |

## Changelog

- 2026-05-31 created and accepted; SPEC-0004 realizes it (architect-approved design)
- 2026-05-31 implemented in `mp-crdt`; `qa` verified all eight acceptance criteria
  (incl. AC3 same-wizard concurrent-vote convergence after a single-writer-cell
  fix). `cargo test --workspace` green (59 host tests), clippy `-D warnings` + fmt
  clean. Status Accepted → **Met**
