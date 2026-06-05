# SPEC-0016 — Presence: ephemeral silhouettes over a separate BroadcastChannel

- **Status:** Accepted
- **Realizes:** R-0016
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** SPEC-0005 (fog-world + render + BroadcastChannel), SPEC-0010 (pubkey), SPEC-0011 (plateaus)
- **Module(s):** `apps/web/src/presence.js` + `presence.test.mjs` (new), `apps/web/src/render.js`, `apps/web/src/main.js`. **No Rust.**

## 1. Motivation

R-0016: show other wizards as silhouettes. Presence is ephemeral real-time state
— it must stay off the CRDT and the signed-event log. This spec adds a pure
beacon-framing + peer-map/TTL module (mirroring `relay.js`'s injected-transport
shape), a render pass for silhouettes, and the `main.js` wiring. No Rust change.

## 2. Design

### 2.1 Module layout

```
apps/web/src/presence.js       ← NEW  buildBeacon/parseBeacon (pure) + createPresence (peer map + TTL)
apps/web/src/presence.test.mjs ← NEW  node --test; injected channel + clock, no browser
apps/web/src/render.js         ← EDIT draw remote silhouettes near their plateau
apps/web/src/main.js           ← EDIT session id; announce on focus + heartbeat; redraw with peers
apps/web/index.html            ← (no change — silhouettes draw on the existing canvas)
```

### 2.2 `presence.js` — pure framing + peer map (mirrors relay.js)

```js
// presence.js — ephemeral multiplayer presence over a SEPARATE BroadcastChannel.
// NOT the CRDT channel (sync.js) and NOT the signed-event channel (eventbus.js):
// presence is throwaway real-time state — never persisted, never on the graph,
// never a signed event (R-0016 AC3). Transport + clock are injected so the peer
// map + TTL GC are unit-testable without a browser (mirrors relay.js).

export const CHANNEL = "mp-presence";
export const HEARTBEAT_MS = 3000;
export const TTL_MS = 9000; // miss ~3 beats ⇒ dropped

// pure framing
export function buildBeacon({ session, pubkey, plateau, ts }) {
  return JSON.stringify({ t: "presence", session, pubkey, plateau, ts });
}
export function parseBeacon(raw) {
  try {
    const b = JSON.parse(raw);
    // Reject a non-presence frame or an empty session: session is the peer-map
    // key AND the self-exclusion key, so a "" session would collapse all such
    // peers into one bucket (architect finding 1). `ts` is informational only —
    // GC uses the RECEIVER's local clock (lastSeen), never the sender's ts, so
    // clock skew is a non-issue (finding 8).
    if (b?.t !== "presence" || typeof b.session !== "string" || b.session === "") return null;
    return { session: b.session, pubkey: b.pubkey ?? "", plateau: b.plateau ?? null, ts: b.ts ?? 0 };
  } catch {
    return null;
  }
}

// createPresence({ session, channel?, now?, ttlMs? }) →
//   { announce({ pubkey, plateau }), peers(), onMessage(raw), close() }
// `session` is THIS tab's ephemeral id (self-exclusion key). `now` and the
// channel are injectable; default to Date.now and a real BroadcastChannel.
export function createPresence({
  session,
  channel = new BroadcastChannel(CHANNEL),
  now = () => Date.now(),
  ttlMs = TTL_MS,
  onChange = () => {}, // fires on peer ARRIVED/updated (a beacon landed), NOT on
  // expiry — a gone peer fades via the heartbeat-driven redraw, with no leave
  // event (architect finding 3). Don't wire teardown logic expecting a "left".
} = {}) {
  const seen = new Map(); // session → { pubkey, plateau, lastSeen }
  channel.onmessage = (e) => ingest(e.data);

  function ingest(raw) {
    const b = parseBeacon(raw);
    if (!b || b.session === session) return; // ignore malformed + our OWN session
    seen.set(b.session, { pubkey: b.pubkey, plateau: b.plateau, lastSeen: now() });
    onChange();
  }
  function announce({ pubkey, plateau }) {
    channel.postMessage(buildBeacon({ session, pubkey, plateau, ts: now() }));
  }
  // Live peers only; GC stale entries (no beacon within ttl) on read.
  function peers() {
    const cutoff = now() - ttlMs;
    const live = [];
    for (const [s, p] of seen) {
      if (p.lastSeen < cutoff) seen.delete(s);
      else if (p.plateau) live.push({ session: s, pubkey: p.pubkey, plateau: p.plateau });
    }
    return live;
  }
  return { announce, peers, onMessage: ingest, close: () => channel.close() };
}
```

`onChange` lets `main.js` redraw the instant a beacon arrives; `peers()` GCs on
every read so a gone wizard disappears on the next heartbeat-driven redraw.

### 2.3 `render.js` — draw silhouettes

`render({ …, peers = [] })` — after markers, draw each remote wizard near their
plateau (skip if the plateau isn't on screen). Colour from a pubkey hash so
wizards are distinguishable; short pubkey label; fan multiple at one plateau:

```js
ctx.save();
const at = new Map(); // plateauId → count (stacking)
for (const w of peers) {
  const pt = points.get(w.plateau);
  if (!pt) continue;
  const i = at.get(w.plateau) ?? 0; at.set(w.plateau, i + 1);
  const sx = pt.x - RADIUS - 10 - i * 12; // fan to the LEFT (markers are on the right)
  const sy = pt.y - RADIUS + i * 6;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = hueFor(w.pubkey);     // deterministic hsl from the pubkey
  ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = LABEL; ctx.textAlign = "right"; ctx.font = "10px system-ui, sans-serif";
  ctx.fillText(short(w.pubkey), sx - 8, sy + 3);
}
ctx.restore();
```

`hueFor(pubkey)` = a small pure hash → `hsl(h,70%,60%)`; `short(pubkey)` = first
6 chars. Both pure, in render.js (presentation only). Silhouettes are drawn to
the LEFT of the disc so they never collide with markers (R-0014, on the right).

### 2.4 `main.js` — session, announce, redraw

```js
import { createPresence } from "./presence.js";

// A per-TAB ephemeral session id (NOT persisted) — two tabs of the same wizard
// are two presences. crypto.randomUUID is available in the browser.
const sessionId = crypto.randomUUID();
let myPlateau = null; // current position (a plateau id)

const presence = createPresence({ session: sessionId, onChange: draw });
function announcePresence() {
  if (myPlateau) presence.announce({ pubkey: myPubkey, plateau: myPlateau });
}
// Heartbeat: re-announce (keep-alive) AND redraw (so stale peers expire visually).
setInterval(() => { announcePresence(); draw(); }, HEARTBEAT_MS);
```

- `draw()` passes `peers: presence.peers()` to `render(...)`.
- On a canvas click that hits a plateau (existing handler), set
  `myPlateau = hit.id` and `announcePresence()` (in addition to the traversal).
- On persona choose, initialise `myPlateau` to the first faced trailhead
  (`trailheadIds()[0]`) and `announcePresence()` so the wizard is immediately
  visible (AC4). A persona facing **no** domain (authored, R-0009 AC6) has no
  trailhead, so `myPlateau` stays `null` and `announcePresence()` no-ops — that
  wizard appears only after their first focus (architect finding 7).

`render()` draws silhouettes from the `peers` array but **must not** add them to
the `points` map it returns — `points` stays the per-plateau screen points the
click hit-test uses, so silhouettes are inherently unclickable and never
interfere with plateau hit-testing (architect finding 4).

No change to the CRDT, the event log, or any persisted store; `root_keys()` stays
the four data maps (AC3).

## 3. Code outline

See §2 — one pure `presence.js` (~50 lines) + its test, ~14 lines of silhouette
render, ~12 lines of `main.js` wiring. No Rust, no HTML change.

## 4. Non-goals

- No relay/WebRTC cross-host presence (BroadcastChannel, same-origin, this phase).
- No continuous cursor position; presence is a plateau id.
- No path-following, no avatars/3-D, no presence-weighted reputation.
- Nothing persisted; nothing on the CRDT or the signed-event log.

## 5. Open questions (resolved here)

- Heartbeat 3 s / TTL 9 s (miss 3 beats → drop). §2.2.
- Silhouette = pubkey-hashed hue dot + 6-char pubkey label, drawn left of the
  disc. §2.3.
- Pre-focus position → the first faced trailhead, so a wizard is visible at once.

## 6. Acceptance criteria

Maps 1-to-1 to R-0016 AC:

- [ ] AC1 — beacon `{session,pubkey,plateau,ts}` on the separate `mp-presence`
      channel, on focus + heartbeat.
- [ ] AC2 — remote wizards render as pubkey-coloured silhouettes near their
      plateau, short-pubkey labelled, self excluded, fanned when co-located.
- [ ] AC3 — never persisted, never CRDT (root keys unchanged), never a signed
      event; TTL drops a gone wizard within ≤ TTL + one heartbeat (~9–12 s) — the
      silhouette clears on the first heartbeat redraw after the TTL lapses.
- [ ] AC4 — position = current plateau (trailhead-initialised); focus change
      moves the silhouette within one beacon.
- [ ] AC5 — keyed by per-tab session; two same-origin tabs (same key) show each
      other.
- [ ] AC6 — `buildBeacon`/`parseBeacon` + peer map + TTL GC unit-tested (injected
      channel + clock): valid updates, malformed (incl. empty-session) ignored,
      stale GC'd (assert the peer map actually shrinks, not just absence from the
      returned list), self excluded, deterministic.
- [ ] AC7 — no Rust change; beacon carries only the public pubkey + plateau id.
- [ ] AC8 — all suites green; two tabs show each other moving + fading, no
      uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Separate `mp-presence` BroadcastChannel; injected channel + clock | Keeps presence off the CRDT/event channels; mirrors relay.js so the peer map + TTL are unit-testable without a browser |
| 2026-06-04 | Peer map keyed by per-tab session; self-excluded by session | Per-connection presence; makes the single-origin cross-tab demo work; pubkey rides for display only |
| 2026-06-04 | GC on read + heartbeat-driven redraw | A gone wizard's silhouette expires on the next ~3 s tick without any explicit "leave" message |
| 2026-06-04 | Silhouettes drawn left of the disc | Markers (R-0014) sit on the right; no visual collision |

## Changelog

- 2026-06-04 created (Draft) — pending architect review, then Accepted.
- 2026-06-04 architect design review: **APPROVE-WITH-NITS** (crux AC3 confirmed —
  presence is genuinely off the CRDT/event log/persistence). Folded: `parseBeacon`
  rejects empty-session; AC3 fade latency restated as ≤ TTL+heartbeat (~9–12 s);
  GC test must assert the peer map shrinks; `onChange` doc'd as arrived-only (no
  leave event); `ts` informational (GC uses receiver-local lastSeen); render must
  not add silhouettes to `points` (hit-test isolation); no-domain persona is
  invisible until first focus. (Also noted: DECENTRALIZATION.md's stale
  `trail_markers` 5th-map mention — a separate doc fix; the code's four root keys
  are authoritative.) **Status → Accepted**; ready to implement.
