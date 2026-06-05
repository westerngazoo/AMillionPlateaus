# R-0016 — Presence: see other wizards as silhouettes in the fog

- **Status:** Accepted
- **Milestone:** POC — Multiplayer presence
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** R-0005 (fog-world + BroadcastChannel transport), R-0010 (wizard pubkey), R-0011 (plateaus to stand on)
- **Realized by:** SPEC-0016 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The world is currently solitary. This requirement makes other travelers
**visible**: each live session broadcasts a lightweight **presence beacon** —
who they are (public wizard id) and where they are (their current plateau) —
and every other open client renders them as a **silhouette** near that plateau.
When a wizard moves (focuses another plateau) their silhouette follows within a
beat; when they close the tab or go idle, their silhouette **fades from others'
views** within a short time-to-live.

Presence is **ephemeral, real-time state** — fundamentally unlike the graph.
It is **never** written to the CRDT (it is not graph data), **never** a signed
event (it is not reputation-bearing), and **never** persisted. It rides its own
transient channel and evaporates when you disconnect. This is the VISION's "you
can see other travelers as silhouettes in the fog," in its first form.

## 2. Rationale

Every prior POC made the world richer but still single-player. Presence is the
first **social** mechanic — the moment the world stops feeling empty. It is also
the cleanest possible such mechanic: no new Rust, no schema change, no
durability. It reuses the same same-origin BroadcastChannel transport R-0005
used to prove CRDT sync, and the wizard pubkey from R-0010 for identity. The
discipline that matters is *architectural*: presence must be kept strictly off
the CRDT and the signed-event log, so the "graph is the platform / reputation is
earned" invariants stay intact while a wholly separate, throwaway channel
carries who-is-where.

## 3. Acceptance criteria

- **AC1 — Presence beacon.** Each live session broadcasts a beacon
  `{ session, pubkey, plateau, ts }` on a **separate** ephemeral channel (not the
  CRDT graph-sync channel, not the signed-event channel): on position change and
  on a periodic heartbeat. `session` is a per-tab ephemeral id; `pubkey` is the
  PUBLIC wizard id (R-0010); `plateau` is the wizard's current plateau id.

- **AC2 — Silhouettes render.** Each remote wizard is drawn as a silhouette near
  their current plateau, visually distinct (a colour derived from their pubkey)
  and labelled with a short form of their pubkey. Multiple wizards on one plateau
  are laid out without fully overlapping. The local wizard's own session is **not**
  drawn as a silhouette.

- **AC3 — Ephemeral: never persisted, never on the graph.** Presence is **never**
  written to the CRDT (the synced doc's root keys stay
  `{bridges, plateaus, resources, votes}`), **never** a signed event, and
  **never** persisted (no localStorage/IndexedDB). A wizard who closes their tab
  or goes idle is dropped from others' views within a bounded **time-to-live**
  (no beacon within the TTL ⇒ their silhouette disappears).

- **AC4 — Position follows focus.** A wizard's position is their **current
  plateau** — the last plateau they focused/clicked (initialised to a faced
  trailhead so they appear immediately). Focusing another plateau updates their
  silhouette on every other client within one beacon.

- **AC5 — Keyed by session, not identity (cross-tab demoable).** Presence is keyed
  by the per-tab **session** id, and self-exclusion is by session — so two
  same-origin tabs show **each other's** silhouette even though they share one
  wizard key. (A wizard with two windows open is genuinely two live presences.)
  The pubkey rides along for display/colour, not as the presence key.

- **AC6 — Pure, tested.** The beacon framing (`buildBeacon`/`parseBeacon`) and the
  peer map + TTL garbage-collection are **unit-tested** with an injected channel
  and an injected clock (no browser): a well-formed beacon updates a peer; a
  malformed beacon is ignored; a peer with no beacon within the TTL is GC'd; the
  self session is excluded. Deterministic.

- **AC7 — No Rust, no secrets on the wire.** No change to any Rust crate, no new
  CRDT field. The beacon carries only the **public** pubkey and a plateau id —
  never the secret key, never reputation, never persona internals.

- **AC8 — Green across all suites.** `cargo test --workspace`, `wasm-pack test
  --node`, `node --test apps/web/src/*.test.mjs`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt --all --check` all green; two same-origin tabs show
  each other's silhouette moving and fading, with no uncaught console errors.

## 4. Constraints & non-goals

- **Reuse the BroadcastChannel transport** (same-origin), as R-0005 did for CRDT
  sync — on a **new, separate** channel (e.g. `"mp-presence"`). Cross-device
  presence over a relay / WebRTC is future work.
- **Presence is not graph state and not reputation.** It must not touch the CRDT
  or the signed-event log; it is throwaway. This is the load-bearing constraint.
- **Discrete position** (a plateau id) this phase, not a free continuous cursor.
- **Non-goals:** following a wizard's path / shared traversal; trail-marker
  authorship attribution; avatars / 3-D; presence-weighted reputation or
  discovery; persisting "last seen"; cross-host transport.

## 5. Open questions

- **TTL + heartbeat cadence.** Heartbeat ~3 s, TTL ~8–10 s (miss ~3 beats ⇒
  drop). Spec picks the numbers.
- **Silhouette look.** Pubkey-hashed hue + short pubkey label vs. a persona-driven
  glyph. Spec decides; cosmetic.
- **Position before first focus.** Initialise to a faced trailhead so a new
  wizard is immediately visible, vs. invisible until they click. Leans trailhead.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Presence rides a separate ephemeral BroadcastChannel; never CRDT/events/persistence | It is real-time, throwaway state — mixing it into the graph or event log would violate the graph-is-the-platform / reputation-earned invariants |
| 2026-06-04 | Keyed by a per-tab session id; self-excluded by session | Presence is per live connection, not per identity; makes the single-origin cross-tab demo work and is semantically correct (two windows = two presences) |
| 2026-06-04 | Position = current plateau (discrete), initialised to a trailhead | Reuses the existing click/hit-test; immediately visible; continuous cursor is a later enhancement |

## Changelog

- 2026-06-04 created (Draft) — pending SPEC-0016 + architect design review, then acceptance.
- 2026-06-04 SPEC-0016 drafted + architect-reviewed (APPROVE-WITH-NITS; crux AC3
  confirmed off-CRDT/off-events; nits folded). **Status → Accepted.**
