# R-0058 — Cross-device "Scan Note": a Cloudflare Worker pairing relay

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-15
- **Depends on:** R-0045 (rich note capture — the QR + `capture.html` + the media pipeline this
  completes), #73 (the real QR encoder), R-0018 (WebRTC media channel — kept as the same-browser
  fallback), R-0012 (IndexedDB media store).
- **Realized by:** direct implementation — a Worker+DO under `workers/pair-relay/`, a pure
  `apps/web/src/pair-relay.js` transport, and the `main.js`/`capture.html` wiring.
- **Source:** the owner: "do it through phone/desktop and directly from the boox." Resolves
  SPEC-0045 §5 (transport) and the "off-LAN phones" follow-up flagged there.

## 1. Statement

Finish the phone/Boox → desktop note hand-off so it works **on any network**, not just same-browser.
A tiny **Cloudflare Worker + Durable Object** brokers by room id: the desktop and the phone each open
a WebSocket to `wss://…/room/<roomId>`, and the DO forwards the (size-capped) JPEG bytes from one to
the other. The desktop encodes the relay URL into the QR, so the phone needs no setup; the image still
lands only in the desktop's IndexedDB, and the relay stores nothing.

## 2. Rationale

R-0045 shipped the QR, the camera page, the bounded image, and the media channel — but the signaling
ran over `BroadcastChannel`, which is same-browser only, so a real phone never connected and the QR
went nowhere. The app is served over **HTTPS**, so the capture page can only reach **WSS**, and plain
WebRTC across two networks needs a **TURN server** to be reliable. A one-hop WSS relay is the smallest
thing that works everywhere. It is the project's first server component, but it holds **no
authoritative graph state** — a dumb byte forwarder off the CRDT/reputation path (CLAUDE.md §6
intact). Durable Objects run on the Workers **free plan** (SQLite backend) and the WebSocket
Hibernation API means an idle room (a QR waiting to be scanned) costs nothing.

## 3. Acceptance criteria

- **AC1 — The relay.** A Cloudflare Worker (`workers/pair-relay/`) exposes `wss://…/room/<id>`; a
  SQLite-backed Durable Object per room accepts up to **two** WebSockets (hibernation API) and
  forwards each binary frame to the other peer, rejecting a third connection and frames above a hard
  cap. It stores nothing and has a `/health` endpoint. Deployable with one `wrangler deploy`.
- **AC2 — Desktop → QR.** When a relay is configured (`DEFAULT_PAIR_RELAY` or the local
  `mp.pairRelayUrl` override), "Scan Note (QR)" encodes `capture.html#<roomId>|<relay>` into the QR
  and opens the desktop end of the room; on an inbound image it stores it exactly as the WebRTC path
  does (IndexedDB blob + a `resource://local/` "Scanned Note" on the current plateau).
- **AC3 — Phone → send.** `capture.html` reads the relay from the QR hash, connects to the room, and
  sends the bounded JPEG over the relay. No relay in the QR ⇒ it uses the same-browser WebRTC/
  BroadcastChannel path unchanged; no transport at all ⇒ the QR degrades to a copyable text URL.
- **AC4 — Same trust boundary.** The relay URL is a LOCAL setting (never synced). Image bytes never
  touch the CRDT/reputation; the relay never sees graph state and persists nothing. The note is
  device-local on the desktop.
- **AC5 — Pure + tested.** The transport (`pair-relay.js`: URL normalization, queue-before-open,
  inbound-binary decode, inert fallback) is pure with a node unit test. The Worker's forwarding is
  verified with a real WebSocket round-trip against `wrangler dev`.

## 4. Constraints & non-goals

- **No auth / short-lived rooms.** Room ids are a fresh 8-hex per QR; the relay is a byte forwarder,
  not a store. Acceptable for a personal study note; not a general file-transfer service.
- **Owner deploys the Worker.** The app ships with `DEFAULT_PAIR_RELAY` empty; the owner runs
  `wrangler deploy` on their own Cloudflare and points the app at the URL (a one-line edit or the
  `mp.pairRelayUrl` setting). Until then, cross-device is off and same-browser still works.
- **Non-goals:** TURN/WebRTC across NAT (superseded by the relay); a hosted multi-user service;
  end-to-end encryption of the in-flight bytes (a personal LAN/short-lived transfer).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-15 | Cloudflare Worker relay over the earlier Nostr-signaling pick | Nostr signaling needed a new `sign_generic` wasm/Rust binding AND WebRTC-across-NAT needs TURN; the Worker needs no core change, uses the owner's existing Cloudflare, and passes the image straight through (no NAT). |
| 2026-07-15 | Relay the IMAGE bytes, not just the WebRTC handshake | Removes WebRTC/TURN from the cross-device path entirely — simpler and works on any network. |
| 2026-07-15 | SQLite-backed DO + WebSocket Hibernation API | The only DO backend on the free plan; hibernation means an idle room (QR waiting) incurs no duration charge. |
| 2026-07-15 | Encode the relay URL into the QR | The phone auto-configures from the scan; no setup on the phone/Boox. |
| 2026-07-15 | Keep BroadcastChannel/WebRTC as the same-browser fallback | Two-tab demo still works with no relay; honest degradation to a text URL if neither is available. |

## Changelog

- 2026-07-15 created (Accepted) + implemented — `workers/pair-relay` (Worker + SQLite DO,
  hibernation, room cap, frame cap, health), `pair-relay.js` transport (+ unit tests), desktop QR
  handler + `capture.html` rewired, relay URL configurable/local. Verified: `wrangler dev` byte
  round-trip (phone→relay→desktop) and room-cap; app E2E — the QR encodes the relay, a relayed image
  becomes a "Scanned Note" on the plateau, a second image adds a second note; 462 web tests pass.
  Completes R-0045 AC1–AC3.
