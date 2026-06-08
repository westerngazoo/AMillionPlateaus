# SPEC-0018 — WebRTC peer-to-peer sync: a data-channel transport for the CRDT pump

- **Status:** Accepted
- **Realizes:** R-0018
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** SPEC-0004 (sync sessions), SPEC-0005 (BroadcastChannel sync + the pump), SPEC-0012 (durability)
- **Module(s):** `apps/web/src/webrtc.js` + `webrtc.test.mjs` (new), `apps/web/index.html`, `apps/web/src/main.js`. **No Rust, no new deps.**

## 1. Motivation

R-0018: carry the CRDT graph across devices, peer-to-peer, over a WebRTC data
channel, with manual (serverless) signaling. The R-0004 sync pump
(`generate_message`/`receive_message`) is transport-agnostic — sync.js drives it
over a BroadcastChannel; this spec adds a second pipe, a WebRTC data channel,
behind a pure transport module that mirrors relay.js (injected connection, fake-
tested). No core change.

## 2. Design

### 2.1 Module layout

```
apps/web/src/webrtc.js       ← NEW  createPeer({rtcFactory,onMessage,onOpen}) — pure transport
apps/web/src/webrtc.test.mjs ← NEW  node --test; hand-rolled fake RTCPeerConnection, no WebRTC
apps/web/src/main.js         ← EDIT P2P panel wiring: offer/answer copy-paste + the sync pump
apps/web/index.html          ← EDIT the P2P invite/answer UI
```

### 2.2 `webrtc.js` — pure data-channel transport (mirrors relay.js)

Manual **non-trickle** signaling: each side produces ONE blob (its
`localDescription` once ICE gathering completes, so all candidates are inline).
The offerer creates the data channel; the answerer receives it via `ondatachannel`.
`RTCPeerConnection` is injected so tests use a fake.

```js
// webrtc.js — a WebRTC data channel as a CRDT-sync pipe (SPEC-0018 / R-0018).
// PURE transport: it knows nothing of the doc/wasm — it ships and receives bytes,
// exactly like relay.js. Signaling is manual/non-trickle (copy-paste one blob each
// way); no signaling server. The connection is injected for unit testing.

export const CHANNEL_LABEL = "mp-sync";

function defaultFactory() {
  // A public STUN server only helps candidate discovery; no data flows through it.
  // Empty iceServers also works on a LAN/loopback (host candidates).
  return new RTCPeerConnection({ iceServers: [] });
}

export function createPeer({
  rtcFactory = defaultFactory,
  onMessage = () => {},
  onOpen = () => {},
  onClose = () => {},
} = {}) {
  const pc = rtcFactory();
  let channel = null;
  const outbox = []; // bytes queued before the channel opens

  function wire(ch) {
    channel = ch;
    ch.binaryType = "arraybuffer";
    ch.onopen = () => {
      for (const m of outbox.splice(0)) ch.send(m);
      onOpen();
    };
    ch.onmessage = (e) => onMessage(new Uint8Array(e.data));
    ch.onclose = () => onClose();
  }

  // Resolve the full local SDP once ICE gathering completes (non-trickle).
  function gathered() {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve(pc.localDescription);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") resolve(pc.localDescription);
      };
    });
  }

  return {
    /// Offerer: create the channel + an invite blob to copy out.
    async createOffer() {
      wire(pc.createDataChannel(CHANNEL_LABEL));
      await pc.setLocalDescription(await pc.createOffer());
      return JSON.stringify(await gathered());
    },
    /// Answerer: ingest the invite, return an answer blob to copy back.
    async acceptOffer(offerBlob) {
      pc.ondatachannel = (e) => wire(e.channel);
      await pc.setRemoteDescription(JSON.parse(offerBlob));
      await pc.setLocalDescription(await pc.createAnswer());
      return JSON.stringify(await gathered());
    },
    /// Offerer: complete the handshake with the answer blob.
    async acceptAnswer(answerBlob) {
      await pc.setRemoteDescription(JSON.parse(answerBlob));
    },
    /// Ship bytes (queued until open). `send(Uint8Array)`.
    send(bytes) {
      if (channel && channel.readyState === "open") channel.send(bytes);
      else outbox.push(bytes);
    },
    isOpen: () => channel?.readyState === "open",
    close: () => pc.close(),
  };
}
```

(`acceptOffer`'s parameter is `offerBlob` — the spec snippet shows the intent;
the implementer writes valid ASCII identifiers. All async methods reject on a
malformed blob via `JSON.parse`/`setRemoteDescription`, which `main.js` catches.)

### 2.3 `main.js` — P2P panel + the sync pump over the data channel

A peer gets its **own** `WasmSyncSession`. On open, pump local state; on inbound
bytes, apply + re-pump + redraw — the same loop as sync.js, over `peer.send`:

```js
import { createPeer } from "./webrtc.js";

let peer = null;
let peerSession = null;

function pumpPeer() {
  if (!peer?.isOpen()) return;
  let msg;
  while ((msg = doc.generate_message(peerSession)) !== undefined) peer.send(msg);
}
function startPeer() {
  peerSession = new WasmSyncSession();
  return createPeer({
    onOpen: () => pumpPeer(), // catch the remote up with our state on connect
    onMessage: (bytes) => {
      doc.receive_message(peerSession, bytes);
      pumpPeer(); // a received change may unblock more to send
      draw();
      persist(); // durable (R-0012); presence/markers/votes all ride the doc
    },
  });
}
```

UI handlers (textareas `#p2p-offer` / `#p2p-answer`, buttons):
- **Create invite:** `peer = startPeer(); #p2p-offer.value = await peer.createOffer();`
- **Accept invite:** `peer = startPeer(); #p2p-answer.value = await peer.acceptOffer(#p2p-offer.value);`
- **Complete:** `await peer.acceptAnswer(#p2p-answer.value);`

Each handler is wrapped in try/catch → an inline error (`#p2p-error`), never an
uncaught throw (AC4). Also `pumpPeer()` is called from the existing local-edit
sites (alongside `sync.pump()`), so a local authoring/vote also flows to the peer.
`BroadcastChannel` sync is untouched (additive).

### 2.4 Why this honours the ACs

- **AC3/AC7:** `peer.send` carries only `doc.generate_message` bytes (the four
  data maps); the signaling blobs are `RTCSessionDescription` JSON (SDP+ICE) —
  no graph/reputation/identity data. No server: `iceServers: []` (or a public
  STUN for candidate discovery only — no data traverses it).
- **AC4:** `peer` starts null; with no connection the app is unchanged. Every
  handler try/catches; a dropped channel → `onClose`, `isOpen()` false, `pumpPeer`
  no-ops.
- **AC5:** one `WasmSyncSession` per `peer`; the pump runs to quiescence; CRDT
  idempotence + R-0004 convergence give order-independence.

## 3. Code outline

See §2 — one ~60-line pure `webrtc.js`, its fake-peer test, ~12 lines of P2P
markup, ~30 lines of `main.js` wiring. No Rust, no new deps.

### 3.1 The fake `RTCPeerConnection` (test shape)

`webrtc.test.mjs` hand-rolls a fake (no `wrtc`/npm), mirroring `relay.test.mjs`'s
`FakeWS`. It supports: `createDataChannel` → a fake channel (readyState, send,
onopen/onmessage/onclose); `createOffer/createAnswer` → `{type, sdp}`;
`setLocalDescription`/`setRemoteDescription` → resolve + set `localDescription`;
`iceGatheringState = "complete"` (immediate, non-trickle); and a test helper that
**links two fake channels** (A.send → B.onmessage) so a two-peer handshake can be
driven and a sync message can cross. Tests:
- `createOffer`/`acceptOffer` produce parseable blobs; `acceptAnswer` resolves.
- a `send` before open is queued, then flushed on open.
- inbound channel bytes route to `onMessage` as a `Uint8Array`.
- two linked fake peers: offer→accept→answer→complete, both channels open, a
  byte sent on A arrives on B (and back).
- a malformed blob rejects (caught upstream).

## 4. Non-goals

- No signaling server / trickle ICE / STUN-TURN NAT traversal (reachable peers /
  LAN this phase).
- No multi-peer mesh (one peer), no reconnection/keepalive, no peer-identity auth.
- No presence-over-WebRTC (graph sync only; presence stays same-origin, R-0016).
- No Rust change, no new deps, no `BroadcastChannel` change.

## 5. Open questions (resolved here)

- Signaling: manual non-trickle, two textareas + create/accept/complete buttons
  (§2.3).
- Catch-up: both peers `pumpPeer()` on open (each from its own session) →
  converge (§2.3).
- ICE: `iceServers: []` (host/loopback candidates) with an optional public STUN
  for discovery only; no data path through any server (§2.4).

## 6. Acceptance criteria

Maps 1-to-1 to R-0018 AC:

- [ ] AC1 — create-invite / accept / complete copy-paste signaling; no signaling
      server.
- [ ] AC2 — data channel open ⇒ peers converge; late joiner catches up.
- [ ] AC3 — only CRDT bytes over the channel; signaling blobs carry only SDP/ICE.
- [ ] AC4 — additive/opt-in; no peer ⇒ unchanged; bad blob / drop ⇒ inline error,
      no uncaught throw.
- [ ] AC5 — one `WasmSyncSession` per peer; pump to quiescence; idempotent +
      order-independent.
- [ ] AC6 — pure `webrtc.js` unit-tested with a fake RTCPeerConnection (framing,
      before-open queue, inbound routing, two-peer handshake + message, bad blob).
- [ ] AC7 — no Rust change, no new deps, no secrets on the wire.
- [ ] AC8 — all suites green; page creates an invite + completes with no uncaught
      console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Pure `webrtc.js` transport, injected RTCPeerConnection, fake-tested | Mirrors relay.js; framing/queue/routing verifiable without a real WebRTC stack or npm dep |
| 2026-06-04 | Non-trickle manual signaling (one blob each way) | Serverless; the full SDP+ICE ships in one copy-paste, no live signaling channel |
| 2026-06-04 | Reuse the sync pump per-peer (own WasmSyncSession), additive to BroadcastChannel | The data channel is just another pipe for R-0004 sync bytes; local sync unchanged |
| 2026-06-04 | `iceServers: []` (+ optional public STUN for discovery only) | No data traverses any server; honours "no server owns the world" |

## Changelog

- 2026-06-04 created (Draft) — pending architect review, then Accepted.
- 2026-06-04 architect design review: **APPROVE-WITH-NITS, no blocking issues**.
  Handshake ordering (ondatachannel before setRemoteDescription), the pure-
  transport design, the per-peer-session pump (verified independent of the
  BroadcastChannel session, no double-apply), and the AC3/AC7 crux (only CRDT
  bytes on the channel, only SDP/ICE in the blobs) all confirmed correct against
  the real code. Implementer directives folded into code/tests: the fake channel
  starts non-open + exposes a fireOpen() so the before-open-queue test isn't
  vacuous; the fake `onmessage` delivers an `ArrayBuffer` to exercise the
  `new Uint8Array(e.data)` wrap; keep the strict `!== undefined` pump guard; add
  explicit bad-blob-rejects + acceptAnswer-misuse tests; a one-line comment on
  `gathered()`'s race-free fast path. **Status → Accepted**; ready to implement.
