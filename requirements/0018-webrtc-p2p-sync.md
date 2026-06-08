# R-0018 — WebRTC peer-to-peer sync: two devices share a world, no server

- **Status:** Accepted
- **Milestone:** POC — Cross-device (P2P)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** R-0004 (CRDT sync sessions), R-0005 (the BroadcastChannel sync this extends), R-0012 (durable snapshot)
- **Realized by:** SPEC-0018 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Today two clients converge only **same-origin**, over a `BroadcastChannel`
(R-0005). This requirement carries the CRDT graph across **devices**, peer-to-
peer, over a **WebRTC data channel** — with **no server owning the data**.
Connection setup (signaling) is done **out-of-band by copy-paste**: one wizard
creates an invite blob, the other pastes it and returns an answer blob; once the
data channel opens, the two replicas exchange Automerge sync messages directly
and their graphs converge — exactly the R-0005 convergence, now between separate
browsers/machines with nothing in the middle.

This is the vision's "no central server owns the world" in its purest POC form:
the graph flows directly between peers; the only thing exchanged out-of-band is
the connection handshake, never the data.

## 2. Rationale

Every prior transport (BroadcastChannel for sync/presence, the Nostr relay for
events) is either same-origin or routes through a relay. WebRTC is the first
that lets two independent devices share the living graph **directly**, honoring
DECENTRALIZATION.md's first principle. Manual copy-paste signaling keeps the POC
**serverless** — no signaling server, no relay, no new infrastructure — so it is
the most honest demonstration that the world needs no central host. It also
composes cleanly: the CRDT sync pump (R-0004 `generate_message`/`receive_message`)
is transport-agnostic, so a WebRTC data channel is just another pipe for the same
bytes; and R-0017's `mp-host merge` already proved an independently-bootstrapped
replica converges, so cross-device convergence is low-risk on the data side.

## 3. Acceptance criteria

- **AC1 — Manual, serverless signaling.** A wizard can **create an invite** (a
  WebRTC offer blob, SDP + gathered ICE, as copy-able text) and another can
  **accept** it (ingest the offer, produce an **answer** blob to copy back) and
  the first **completes** with the answer. No signaling server, relay, or other
  network party is involved in setup — the blobs are exchanged out-of-band.

- **AC2 — Peers converge over the data channel.** Once the data channel opens,
  the two replicas exchange Automerge sync messages (R-0004) over it and their
  graphs **converge**: a plateau/bridge/marker/vote authored on one peer appears
  on the other, and a peer that connects later **catches up** to the full shared
  state. Convergence is the same property R-0005 proved, now peer-to-peer.

- **AC3 — No server owns the data.** The graph bytes flow only over the direct
  peer-to-peer data channel; nothing is sent to a signaling server, relay, or
  any central store during sync. (Signaling blobs carry only WebRTC connection
  descriptors — never graph/reputation/identity data.)

- **AC4 — Additive and offline-safe.** With no peer connected, the app behaves
  exactly as today: local `BroadcastChannel` sync (R-0005), durability (R-0012),
  and everything else are unchanged. WebRTC is **opt-in**; a malformed blob, a
  failed connection, or a dropped peer degrades gracefully — an inline error,
  never an uncaught exception, and the world keeps working.

- **AC5 — One sync session per peer; convergent + idempotent.** Each peer
  connection drives its **own** `WasmSyncSession` (R-0004/R-0005 model); inbound
  messages are applied and re-pumped to quiescence. Re-applying already-seen
  changes is a no-op (CRDT idempotence), and connection order does not change the
  converged result.

- **AC6 — Pure transport, unit-tested without WebRTC.** The peer-connection
  transport (`webrtc.js`) wraps an **injected** `RTCPeerConnection` factory and
  exposes offer/answer framing, a before-open send queue, and inbound-message
  routing — all **unit-tested with a hand-rolled fake** (no real WebRTC stack, no
  npm dependency), mirroring how `relay.js` is tested with a fake socket: framing
  round-trips, queued sends flush on open, inbound bytes route to the callback,
  two fake peers handshake and a message crosses, and a bad blob is rejected.

- **AC7 — No Rust change, no new deps, no secrets on the wire.** `RTCPeerConnection`
  is a browser global; tests use a hand-rolled fake — no npm dependency, no Rust
  change, no signaling server. The data channel carries only CRDT sync bytes (the
  four data maps), never reputation, the secret key, or persona internals.

- **AC8 — Green across all suites.** `node --test apps/web/src/*.test.mjs` (incl.
  the new `webrtc.test.mjs`), `cargo test --workspace`, `wasm-pack test --node`,
  clippy `-D warnings` (host + `wasm32`), and `cargo fmt --all --check` all green;
  the page can create an invite + complete a connection with no uncaught console
  errors (two-peer convergence demonstrated by the fake-peer tests and, where the
  runtime supports it, a loopback connection).

## 4. Constraints & non-goals

- **Serverless signaling this phase.** Copy-paste (out-of-band) offer/answer
  exchange; a signaling server or relay-brokered signaling is a later
  convenience, explicitly out of scope.
- **Reuse the audited sync pump.** WebRTC is a new pipe for the existing
  `generate_message`/`receive_message` sessions; no change to `mp-crdt`/`mp-wasm`.
- **`BroadcastChannel` stays the local default.** WebRTC is additive and opt-in;
  same-origin tabs still converge over BroadcastChannel with no peer setup.
- **Graph sync only.** Presence over WebRTC (cross-device silhouettes) is a
  natural follow-on but **not** in this requirement — presence already works
  same-origin (R-0016); extending it cross-device is a small later add.
- **Non-goals:** trickle-ICE / STUN/TURN for NAT traversal (the POC targets
  reachable peers / local networks; NAT traversal infrastructure is future);
  multi-peer mesh (one peer connection this phase); reconnection/keepalive;
  authenticating the peer's identity over the channel.

## 5. Open questions

- **Signaling UX.** Two textareas (invite / answer) + three buttons (create /
  accept / complete), vs. a single guided flow. Spec decides; cosmetic.
- **ICE strategy.** Non-trickle (wait for gathering to complete, ship one blob
  each way) is simplest and serverless-friendly; trickle would need a live
  signaling channel. Leans non-trickle.
- **Initial catch-up.** On open, does the offerer pump first, or both pump
  immediately? Both pumping (each generates from its session) converges; spec
  confirms the handshake order.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | WebRTC data channel for cross-device sync; manual copy-paste signaling | Truest "no server owns the world" — direct P2P data, zero infrastructure for the POC |
| 2026-06-04 | Reuse the transport-agnostic CRDT sync pump; WebRTC is just another pipe | `generate_message`/`receive_message` already carry the bytes (R-0005); no core change |
| 2026-06-04 | Pure `webrtc.js` transport with an injected RTCPeerConnection, fake-tested | Mirrors relay.js; the framing/queue/routing is verifiable without a real WebRTC stack or npm dep |
| 2026-06-04 | Graph sync only; presence-over-WebRTC deferred | Keeps the requirement focused; presence already works same-origin |

## Changelog

- 2026-06-04 created (Draft) — pending SPEC-0018 + architect design review, then acceptance.
- 2026-06-04 SPEC-0018 drafted + architect-reviewed (APPROVE-WITH-NITS, no blocking issues;
  handshake/pump/crux verified; test directives folded). **Status → Accepted.**
