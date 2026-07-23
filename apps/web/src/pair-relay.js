// pair-relay.js — the cross-device "Scan Note" transport (R-0058).
//
// The phone→desktop image hand-off (R-0045) needs a rendezvous both devices can
// reach. Same-browser pairing uses a BroadcastChannel (see main.js / capture.html);
// this module adds the CROSS-device path: a WebSocket to a tiny relay Worker
// (workers/pair-relay) that forwards the JPEG bytes by room id. The URL building is
// pure; the one impure edge (the WebSocket) is injectable so the queue/framing is
// node-testable with a fake socket, exactly like relay.js.
//
// Trust boundary: the relay is a dumb byte forwarder. The image still lands only in
// this browser's IndexedDB; the relay URL is a LOCAL setting (never synced), the
// bytes never touch the CRDT/reputation, and nothing is stored on the relay.

// The relay this app talks to. Set this to your deployed Worker (wss://…workers.dev)
// after `wrangler deploy`, OR override per-browser via localStorage `mp.pairRelayUrl`.
// Empty ⇒ no cross-device relay; the app falls back to same-browser BroadcastChannel.
export const DEFAULT_PAIR_RELAY = "";
export const PAIR_RELAY_KEY = "mp.pairRelayUrl";

/** The configured relay base (localStorage override → DEFAULT). Trimmed; "" if none. */
export function loadPairRelay(storage) {
  try {
    const v = storage?.getItem(PAIR_RELAY_KEY);
    return (v && v.trim()) || DEFAULT_PAIR_RELAY;
  } catch {
    return DEFAULT_PAIR_RELAY;
  }
}

/**
 * The WebSocket URL for a room. Normalizes the scheme to ws/wss (so an https base
 * pasted by mistake still works) and strips a trailing slash. Returns null when no
 * base is configured — the caller then uses the same-browser fallback. Pure.
 */
export function pairRoomUrl(base, roomId) {
  if (!base || !roomId) return null;
  const b = String(base).trim().replace(/\/+$/, "").replace(/^http(s?):/i, "ws$1:");
  return `${b}/room/${encodeURIComponent(roomId)}`;
}

/**
 * Open a pairing channel to the relay. `onImage(Uint8Array)` fires on the RECEIVING
 * side (desktop) for each inbound binary frame; `onStatus("online"|"offline"|
 * "unavailable")` reports connectivity. Bytes sent before the socket opens are
 * queued and flushed on open. `WebSocketCtor` is injected for tests. Returns
 * `{ send, close }`; both are inert no-ops when no url/WebSocket is available, so
 * the caller's fallback path is unaffected.
 */
export function createPairChannel({ url, onImage, onText, onStatus, WebSocketCtor } = {}) {
  const WS = WebSocketCtor || (typeof WebSocket !== "undefined" ? WebSocket : null);
  const status = (s) => onStatus && onStatus(s);
  if (!url || !WS) {
    status("unavailable");
    return { send() {}, close() {} };
  }
  let ws;
  try {
    ws = new WS(url);
    ws.binaryType = "arraybuffer";
  } catch {
    status("unavailable");
    return { send() {}, close() {} };
  }

  let open = false;
  const queue = [];
  const flush = () => {
    for (const buf of queue.splice(0)) {
      try { ws.send(buf); } catch { /* closed mid-flush */ }
    }
  };

  ws.onopen = () => { open = true; status("online"); flush(); };
  ws.onmessage = (e) => {
    const d = e.data;
    if (d == null) return;
    // Text frames carry the R-0089 live-sync WebRTC handshake (JSON); binary
    // frames carry a scanned-note image (R-0058). The same 2-peer room serves
    // both — they never collide because live-sync uses its OWN room id.
    if (typeof d === "string") {
      onText?.(d);
      return;
    }
    if (!onImage) return;
    if (d instanceof ArrayBuffer) onImage(new Uint8Array(d));
    else if (ArrayBuffer.isView(d)) onImage(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
  };
  ws.onerror = () => status("offline");
  ws.onclose = () => { open = false; status("offline"); };

  return {
    /** Send image bytes (Uint8Array/ArrayBuffer). Queued until the socket opens. */
    send(bytes) {
      const buf = bytes?.buffer instanceof ArrayBuffer ? bytes.buffer : bytes;
      if (open) {
        try { ws.send(buf); } catch { queue.push(buf); }
      } else {
        queue.push(buf);
      }
    },
    /** Send a text frame (R-0089 live-sync signaling JSON). Queued until open. */
    sendText(str) {
      const s = String(str);
      if (open) {
        try { ws.send(s); } catch { queue.push(s); }
      } else {
        queue.push(s);
      }
    },
    close() {
      try { ws.close(); } catch { /* already closed */ }
    },
  };
}
