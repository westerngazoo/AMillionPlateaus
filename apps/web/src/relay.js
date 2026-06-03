// relay.js — optional Nostr relay transport (SPEC-0010 §2.3, R-0010 AC7).
//
// Publishes and subscribes signed events over a WebSocket to a configurable relay
// URL (`mp.relayUrl`, a local-only setting like the model config). Inbound events
// are handed to the caller's `onEvent`, which verify-gates them through the local
// log — the relay is NEVER trusted for validity or ordering. If the socket cannot
// open, errors, or closes, `onStatus("offline")` fires and the world keeps working
// from the local log (offline-safe).
//
// The wire framing is NIP-01: `["EVENT", e]` to publish, `["REQ", subId, filter]`
// to subscribe, inbound `["EVENT", subId, e]` / `["EOSE", subId]`. The framing
// helpers are pure and exported for host tests; the socket constructor is injected
// so the transport wiring is testable in node without a browser or a live relay
// (R-0010 AC8).

export const RELAY_KEY = "mp.relayUrl";
export const KIND_TRAVERSAL = 30078;
export const KIND_VOUCH = 30079;
const SUB_ID = "mp-events";

/// Frame a signed event JSON string as a NIP-01 publish message.
export function buildPublish(eventJson) {
  return JSON.stringify(["EVENT", JSON.parse(eventJson)]);
}

/// Frame a subscription request for our two reputation-bearing kinds.
export function buildSubscribe(kinds = [KIND_TRAVERSAL, KIND_VOUCH], subId = SUB_ID) {
  return JSON.stringify(["REQ", subId, { kinds }]);
}

/// Extract the inbound event as a JSON string, or null for non-event frames
/// (EOSE / NOTICE / OK / malformed). Never throws.
export function parseRelayMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch {
    return null;
  }
  if (!Array.isArray(msg)) return null;
  if (msg[0] === "EVENT" && msg.length >= 3 && msg[2]) return JSON.stringify(msg[2]);
  return null;
}

/// Open a relay connection. Returns `{ publish, close }`. `onEvent(json)` fires for
/// each inbound event (the caller verify-gates it); `onStatus("online"|"offline")`
/// reports connectivity for the HUD. With no URL or no WebSocket available it
/// reports offline and the returned `publish`/`close` are inert no-ops, so the rest
/// of the app is unaffected (offline-safe).
export function createRelay({ url, onEvent, onStatus, kinds, WebSocketCtor } = {}) {
  const WS = WebSocketCtor || (typeof WebSocket !== "undefined" ? WebSocket : null);
  const status = (s) => {
    if (onStatus) onStatus(s);
  };
  const inert = { publish() {}, close() {} };
  if (!url || !WS) {
    status("offline");
    return inert;
  }

  let ws;
  try {
    ws = new WS(url);
  } catch {
    status("offline");
    return inert;
  }

  let open = false;
  const queue = []; // frames produced before the socket opens

  const trySend = (m) => {
    try {
      ws.send(m);
    } catch {
      /* socket went away mid-send — the offline flag will follow via onclose */
    }
  };

  ws.onopen = () => {
    open = true;
    status("online");
    trySend(buildSubscribe(kinds));
    for (const m of queue.splice(0)) trySend(m);
  };
  ws.onmessage = (e) => {
    const json = parseRelayMessage(typeof e.data === "string" ? e.data : String(e.data));
    if (json && onEvent) onEvent(json);
  };
  ws.onerror = () => status("offline");
  ws.onclose = () => {
    open = false;
    status("offline");
  };

  return {
    publish(eventJson) {
      const frame = buildPublish(eventJson);
      if (open) trySend(frame);
      else queue.push(frame); // flushed on open; dropped if we never connect
    },
    close() {
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    },
  };
}
