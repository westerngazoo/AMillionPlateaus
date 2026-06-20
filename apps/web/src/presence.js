// presence.js — ephemeral multiplayer presence over a SEPARATE BroadcastChannel
// (SPEC-0016 / R-0016). This is throwaway real-time state: who is where, right
// now. It is NOT the CRDT channel (sync.js, "mp-graph-sync") and NOT the
// signed-event channel (eventbus.js, "mp-nostr-events"). Presence is never
// persisted, never written to the CRDT, and never a signed event (R-0016 AC3) —
// it evaporates on disconnect. Transport + clock are injected so the peer map +
// TTL GC are unit-testable without a browser (mirrors relay.js).

export const CHANNEL = "mp-presence";
export const HEARTBEAT_MS = 3000;
export const TTL_MS = 9000; // miss ~3 beats ⇒ dropped

// ── pure framing ────────────────────────────────────────────────────────────

export function buildBeacon({ session, pubkey, plateau, ts }) {
  return JSON.stringify({ t: "presence", session, pubkey, plateau, ts });
}

export function parseBeacon(raw) {
  try {
    const b = JSON.parse(raw);
    // Reject a non-presence frame or an empty session: session is the peer-map
    // key AND the self-exclusion key, so a "" session would collapse all such
    // peers into one bucket. `ts` is informational only — GC uses the RECEIVER's
    // local clock (lastSeen), never the sender's ts, so clock skew is a non-issue.
    if (b?.t !== "presence" || typeof b.session !== "string" || b.session === "") return null;
    return {
      session: b.session,
      pubkey: typeof b.pubkey === "string" ? b.pubkey : "",
      plateau: typeof b.plateau === "string" ? b.plateau : null,
      ts: typeof b.ts === "number" ? b.ts : 0,
    };
  } catch {
    return null;
  }
}

// ── peer map + TTL GC ─────────────────────────────────────────────────────────

// createPresence({ session, channel?, now?, ttlMs?, onChange? }) →
//   { announce({ pubkey, plateau }), peers(), onMessage(raw), close() }
//
// `session` is THIS tab's ephemeral id (the self-exclusion key — presence is per
// live connection, not per identity, so two tabs of one wizard see each other).
// `channel`/`now` are injectable; default to a real BroadcastChannel + Date.now.
// `onChange` fires when a beacon ARRIVES/updates a peer (not on expiry — a gone
// peer fades via the heartbeat-driven redraw, there is no "leave" event).
export function createPresence({
  session,
  channel = new BroadcastChannel(CHANNEL),
  now = () => Date.now(),
  ttlMs = TTL_MS,
  onChange = () => {},
} = {}) {
  const seen = new Map(); // session → { pubkey, plateau, lastSeen }

  function ingest(raw) {
    const b = parseBeacon(raw);
    if (!b || b.session === session) return; // ignore malformed + our OWN session
    seen.set(b.session, { pubkey: b.pubkey, plateau: b.plateau, lastSeen: now() });
    onChange();
  }
  channel.onmessage = (e) => ingest(e.data);

  function announce({ pubkey, plateau }) {
    channel.postMessage(buildBeacon({ session, pubkey, plateau, ts: now() }));
  }

  // Live peers with a position; GC stale entries (no beacon within ttl) — the
  // Map actually shrinks, so a gone wizard frees memory, not just visibility.
  function peers() {
    const cutoff = now() - ttlMs;
    const live = [];
    for (const [s, p] of seen) {
      if (p.lastSeen < cutoff) {
        seen.delete(s);
      } else if (p.plateau) {
        live.push({ session: s, pubkey: p.pubkey, plateau: p.plateau });
      }
    }
    return live;
  }

  return { announce, peers, onMessage: ingest, close: () => channel.close() };
}
