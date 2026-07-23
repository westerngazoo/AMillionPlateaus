// live-sync.js — auto-connecting live P2P sync over the relay (R-0089). Pure.
//
// R-0088 syncs across TIME (the repo, async). This syncs across the ROOM: two of
// YOUR devices on the same network find each other through the R-0058 relay
// (which carries only the tiny WebRTC handshake), open a DIRECT WebRTC data
// channel (empty ICE → LAN host candidates, no server in the data path), and
// pump CRDT sync messages live. Graph bytes never touch the relay.
//
// This module is the pure HANDSHAKE STATE MACHINE. Given:
//   - a signaling `relay` { send(text), close() } fed inbound frames via handle()
//   - a `makePeer()` that returns an R-0018 createPeer handle
//   - `myId` (a random per-session nonce)
// it drives: hello → role-election (higher id offers) → offer/answer → connected,
// tolerant of EITHER join order and idempotent against duplicate frames. All I/O
// (WebSocket, RTCPeerConnection, crypto.randomUUID) is injected, so it's fully
// unit-testable with fakes. The impure wiring lives in main.js.

/** A short random session id — the higher one becomes the offerer (deterministic
 *  tiebreak, so both peers agree on roles without a coordinator). */
export function newSessionId(rand = Math.random) {
  return Math.floor(rand() * 2 ** 52).toString(36) + Math.floor(rand() * 2 ** 52).toString(36);
}

/** A stable, non-secret room id from a shared string (your sync repo). Two of
 *  your devices synced to the SAME repo derive the SAME room → auto-pair; the
 *  id is a one-way hash so the repo name isn't exposed in the relay path.
 *  `live-<base36>`, matching the relay's [A-Za-z0-9_-]{1,64} room grammar. */
export function roomIdFor(secret) {
  const s = String(secret || "");
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 ^ c) * 16777619) >>> 0;
    h2 = (((h2 << 5) + h2) ^ c) >>> 0;
  }
  return `live-${h1.toString(36)}${h2.toString(36)}`;
}

const HELLO = "hello";
const OFFER = "offer";
const ANSWER = "answer";

/**
 * Create a live session driver. `relay.send` ships a JSON text frame to the room
 * (the relay forwards it to the OTHER peer); inbound frames arrive via the
 * returned `handle(text)`. `makePeer()` → { createOffer, acceptOffer,
 * acceptAnswer, onOpen wired by the caller }. Callbacks: `onStatus(state)` with
 * "waiting" | "connecting" | "live" | "closed"; `onPeer(peer)` when the data
 * channel is created (so the caller can pump). Returns { start, handle, stop }.
 */
export function createLiveSession({ myId, relay, makePeer, onStatus = () => {}, onError = () => {} }) {
  let peerId = null;
  let role = null; // "offerer" | "answerer"
  let peer = null;
  let elected = false;
  let stopped = false;
  let state = "idle";

  const setState = (s) => {
    if (state !== s && !stopped) {
      state = s;
      onStatus(s);
    }
  };
  const send = (obj) => relay.send(JSON.stringify(obj));

  // Elect roles once both ids are known. Higher id offers. Idempotent.
  async function elect() {
    if (elected || peerId == null || stopped) return;
    elected = true;
    role = myId > peerId ? "offerer" : "answerer";
    setState("connecting");
    peer = makePeer();
    if (role === "offerer") {
      try {
        const sdp = await peer.createOffer();
        if (!stopped) send({ t: OFFER, sdp });
      } catch (e) {
        onError(e);
      }
    }
    // answerer waits for the OFFER frame (handled below).
  }

  return {
    /** Announce presence. Safe to call once after the relay is open. */
    start() {
      if (stopped) return;
      setState("waiting");
      send({ t: HELLO, id: myId });
    },
    /** Feed an inbound relay text frame. Tolerant of junk + duplicates. */
    async handle(text) {
      if (stopped) return;
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return; // not our frame (binary/scan-note/junk)
      }
      if (!msg || typeof msg.t !== "string") return;

      if (msg.t === HELLO) {
        if (msg.id === myId) return; // our own echo, if the relay ever loops it back
        const first = peerId == null;
        peerId = msg.id;
        // A late joiner missed our initial hello — re-announce once so it learns
        // our id, then elect. (The peer ignores our hello if it already has us.)
        if (first) send({ t: HELLO, id: myId });
        await elect();
        return;
      }
      if (msg.t === OFFER) {
        // We're the answerer (or a glare case): accept, answer back.
        if (!peer) {
          elected = true;
          role = "answerer";
          setState("connecting");
          peer = makePeer();
        }
        try {
          const sdp = await peer.acceptOffer(msg.sdp);
          if (!stopped) send({ t: ANSWER, sdp });
        } catch (e) {
          onError(e);
        }
        return;
      }
      if (msg.t === ANSWER) {
        if (peer && role === "offerer") {
          try {
            await peer.acceptAnswer(msg.sdp);
          } catch (e) {
            onError(e);
          }
        }
        return;
      }
    },
    /** The peer handle once created (for the caller to pump / close). */
    get peer() {
      return peer;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        peer?.close?.();
      } catch {
        /* already gone */
      }
      try {
        relay.close?.();
      } catch {
        /* already gone */
      }
      // Emit "closed" DIRECTLY — setState's `!stopped` guard (which silences late
      // async callbacks after teardown) would otherwise swallow this one.
      state = "closed";
      onStatus("closed");
    },
  };
}
