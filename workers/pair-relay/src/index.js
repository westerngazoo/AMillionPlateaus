// pair-relay — an ephemeral per-room WebSocket relay for "Scan Note" (R-0058).
//
// The app's phone→desktop note capture needs a rendezvous both devices can reach:
// the PWA is HTTPS, so the capture page (same origin) can only talk to WSS, and
// plain WebRTC across two networks fails without a TURN server. This Worker is the
// smallest thing that works everywhere: a phone and a desktop each open a WebSocket
// to wss://…/room/<roomId>; a Durable Object keyed by that room forwards the
// (size-capped, ~256 KB) JPEG bytes from one to the other. Nothing is stored, no
// auth, no state beyond the two live sockets — a dumb byte forwarder OFF the app's
// CRDT/reputation path (CLAUDE.md §6 intact). The image still lands device-local on
// the desktop (IndexedDB) exactly as before; the relay only carries it across.
//
// Free-plan friendly: the DO uses the SQLite storage backend (the only one on the
// free tier) even though it stores nothing, and the WebSocket Hibernation API
// (ctx.acceptWebSocket + webSocketMessage) means an idle room incurs no duration
// charge while it waits for the phone to snap a photo.

import { DurableObject } from "cloudflare:workers";

const MAX_PEERS = 2; // a room is exactly one phone + one desktop
const MAX_FRAME = 300 * 1024; // hard ceiling above the app's 256 KB image cap — reject abuse

export class Room extends DurableObject {
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }
    // Hibernation-accepted sockets survive eviction and are returned here.
    if (this.ctx.getWebSockets().length >= MAX_PEERS) {
      return new Response("room full", { status: 409 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server); // hibernation API — no duration charge while idle
    return new Response(null, { status: 101, webSocket: client });
  }

  // Forward each frame to the OTHER peer in the room. Binary (the JPEG) is the
  // norm; a tiny text control frame ("ready"/"sent") also just passes through.
  webSocketMessage(ws, message) {
    const size = typeof message === "string" ? message.length : message.byteLength;
    if (size > MAX_FRAME) {
      ws.send(JSON.stringify({ type: "error", error: "frame too large" }));
      return;
    }
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === ws) continue;
      try { peer.send(message); } catch { /* peer went away mid-send */ }
    }
  }

  webSocketClose(ws, code, reason) {
    try { ws.close(code === 1006 ? 1000 : code, reason); } catch { /* already closing */ }
  }

  webSocketError(ws) {
    try { ws.close(1011, "relay error"); } catch { /* already closing */ }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("pair-relay: connect a WebSocket to /room/<id>", { status: 200 });
    }
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{1,64})$/);
    if (!m) return new Response("not found — use /room/<id>", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }
    // getByName → same roomId always routes to the same Durable Object instance.
    return env.ROOM.getByName(m[1]).fetch(request);
  },
};
