# R-0089 — 🔴 live sync: same-network P2P, auto-connected

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-23
- **Depends on:** R-0018 (WebRTC peer + CRDT pump), R-0058 (pair-relay Worker), R-0088 (repo sync).
- **Source:** the owner: "lets do the p2p live same room thing which i presume could be same
  network not room."

## 1. Statement

R-0088 syncs across TIME (the repo, async). This syncs across the ROOM: two of your devices on
the same network **auto-pair** and sync **live, directly device-to-device**. The old "Connect a
peer (P2P)" needed manual copy-paste of SDP blobs; this replaces the handshake with an automatic
one carried by the R-0058 relay — which sees **only the tiny WebRTC handshake**. Once connected,
the CRDT sync messages flow over a **direct WebRTC data channel** (empty ICE → LAN host
candidates, no server in the data path); the graph bytes never touch the relay.

Flow: both devices open 🔴 Live sync and tap Go live → each joins a relay room (the room id is a
one-way hash of your synced repo, so your own devices share it with no code to type; a manual code
pairs with someone else) → they exchange `hello` and elect roles by nonce (higher offers) →
offer/answer over the relay → the direct data channel opens → the existing peer pump
(`startPeer`/`pumpPeer`) streams changes both ways in real time. Tolerant of either join order and
of a late joiner. Additive: with Live off, nothing changes; it composes with 📓 Sync (repo) and
the old manual P2P.

## 2. Acceptance criteria

- **AC1** — pure `live-sync.js`: `createLiveSession` drives hello → role-election (higher id
  offers) → offer/answer → connected, idempotent against duplicate frames, tolerant of either
  join order + a late joiner, and tolerant of junk/non-JSON frames; `stop()` tears down and
  reports "closed"; `roomIdFor` is a stable relay-grammar-safe hash; `newSessionId` varies.
  Unit-tested. `pair-relay.js` gains `onText`/`sendText` (text frames = signaling; binary =
  scan-note; same 2-peer room, distinct room ids).
- **AC2** — a 🔴 Live sync panel: relay URL (prefilled from the saved pair-relay), room code
  (auto-filled from the synced repo, editable), Go live / Stop, live status; reuses the R-0018
  peer pump so a connected channel streams CRDT changes both ways; Stop tears down cleanly.
- **AC3** — the data path is direct WebRTC (empty ICE); the relay carries only SDP; graph state
  never enters the relay (CLAUDE.md §6 intact).
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-23 created (Accepted) + implemented. Suite 578/578 (7 new live-sync tests). Live-verified
  in-browser with **two real `createLiveSession` instances + real `RTCPeerConnection`** wired by an
  in-memory 2-peer relay bus: the auto-handshake drove WebRTC to an **open data channel on both
  sides**, and a message passed **directly A→B** over it — the exact transport the CRDT pump uses.
  App boots clean; the panel renders and prefills the relay/room.

## Notes / runtime prerequisites

- Needs the R-0058 relay Worker deployed and its URL set (prefilled here). Two devices, same
  network, both tap Go live.
- Empty ICE = LAN host/mDNS candidates only: designed for same-network. Cross-network would need a
  STUN/TURN server (not in scope; the repo sync already covers across-network/across-time).
