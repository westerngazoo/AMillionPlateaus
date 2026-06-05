// presence.test.mjs — node --test, no browser. Proves the beacon framing and the
// peer map + TTL GC (SPEC-0016 §2.2, R-0016 AC6). The channel is faked and the
// clock injected, so timing-dependent GC is deterministic (mirrors relay.test.mjs).
// Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { buildBeacon, parseBeacon, createPresence } from "./presence.js";

// ── pure framing ────────────────────────────────────────────────────────────

test("buildBeacon/parseBeacon round-trips a presence frame", () => {
  const raw = buildBeacon({ session: "s1", pubkey: "pk", plateau: "p1", ts: 5 });
  assert.deepEqual(parseBeacon(raw), { session: "s1", pubkey: "pk", plateau: "p1", ts: 5 });
});

test("parseBeacon rejects malformed frames, incl. empty session (AC6)", () => {
  assert.equal(parseBeacon("not json"), null);
  assert.equal(parseBeacon(JSON.stringify({ t: "other", session: "s" })), null);
  assert.equal(parseBeacon(JSON.stringify({ t: "presence" })), null); // no session
  assert.equal(parseBeacon(JSON.stringify({ t: "presence", session: "" })), null); // empty
  assert.equal(parseBeacon(JSON.stringify({ t: "presence", session: 7 })), null); // non-string
});

test("parseBeacon defaults missing/!string optional fields", () => {
  const b = parseBeacon(JSON.stringify({ t: "presence", session: "s" }));
  assert.deepEqual(b, { session: "s", pubkey: "", plateau: null, ts: 0 });
});

// ── peer map + TTL GC (injected channel + clock) ─────────────────────────────

class FakeChannel {
  constructor() {
    this.sent = [];
  }
  postMessage(m) {
    this.sent.push(m);
  }
  deliver(m) {
    if (this.onmessage) this.onmessage({ data: m });
  }
  close() {
    this.closed = true;
  }
}

function clock(start = 1000) {
  const t = { v: start };
  return { now: () => t.v, advance: (ms) => (t.v += ms), set: (ms) => (t.v = ms) };
}

test("a beacon from another session becomes a live peer (AC1/AC2)", () => {
  const ch = new FakeChannel();
  const c = clock();
  let changes = 0;
  const p = createPresence({ session: "me", channel: ch, now: c.now, onChange: () => changes++ });
  ch.deliver(buildBeacon({ session: "other", pubkey: "PK", plateau: "p1", ts: c.now() }));
  assert.equal(changes, 1, "onChange fires on arrival");
  assert.deepEqual(p.peers(), [{ session: "other", pubkey: "PK", plateau: "p1" }]);
});

test("our OWN session is excluded — two tabs differ by session, not pubkey (AC5)", () => {
  const ch = new FakeChannel();
  const p = createPresence({ session: "me", channel: ch, now: clock().now });
  // Same pubkey, different session (the other tab of the same wizard) → shows.
  ch.deliver(buildBeacon({ session: "tab2", pubkey: "SAME", plateau: "p1", ts: 1 }));
  // Our own session echoed back → ignored.
  ch.deliver(buildBeacon({ session: "me", pubkey: "SAME", plateau: "p9", ts: 1 }));
  assert.deepEqual(p.peers().map((x) => x.session), ["tab2"]);
});

test("a peer with no plateau is not rendered, but a later positioned beacon is", () => {
  const ch = new FakeChannel();
  const p = createPresence({ session: "me", channel: ch, now: clock().now });
  ch.deliver(buildBeacon({ session: "o", pubkey: "pk", plateau: null, ts: 1 }));
  assert.deepEqual(p.peers(), []);
  ch.deliver(buildBeacon({ session: "o", pubkey: "pk", plateau: "p2", ts: 1 }));
  assert.deepEqual(p.peers(), [{ session: "o", pubkey: "pk", plateau: "p2" }]);
});

test("a stale peer is GC'd from the map after the TTL (AC3/AC6)", () => {
  const ch = new FakeChannel();
  const c = clock();
  const p = createPresence({ session: "me", channel: ch, now: c.now, ttlMs: 9000 });
  ch.deliver(buildBeacon({ session: "o", pubkey: "pk", plateau: "p1", ts: c.now() }));
  assert.equal(p.peers().length, 1);

  c.advance(9001); // past the TTL with no fresh beacon
  assert.deepEqual(p.peers(), [], "stale peer is gone from the live list");
  // And actually removed from the map (not just filtered) — a fresh beacon from a
  // NEW session is the only entry, proving the stale one was deleted.
  ch.deliver(buildBeacon({ session: "n", pubkey: "pk2", plateau: "p3", ts: c.now() }));
  assert.deepEqual(p.peers().map((x) => x.session), ["n"]);
});

test("a refreshed beacon keeps a peer alive past the original TTL", () => {
  const ch = new FakeChannel();
  const c = clock();
  const p = createPresence({ session: "me", channel: ch, now: c.now, ttlMs: 9000 });
  ch.deliver(buildBeacon({ session: "o", pubkey: "pk", plateau: "p1", ts: c.now() }));
  c.advance(5000);
  ch.deliver(buildBeacon({ session: "o", pubkey: "pk", plateau: "p1", ts: c.now() })); // heartbeat
  c.advance(5000); // 10s since first, but only 5s since refresh
  assert.equal(p.peers().length, 1, "still live thanks to the refresh");
});

test("announce frames our session/pubkey/plateau onto the channel (AC1)", () => {
  const ch = new FakeChannel();
  const c = clock(42);
  const p = createPresence({ session: "me", channel: ch, now: c.now });
  p.announce({ pubkey: "PK", plateau: "p1" });
  assert.deepEqual(parseBeacon(ch.sent[0]), { session: "me", pubkey: "PK", plateau: "p1", ts: 42 });
});

test("close() closes the channel; the world keeps working", () => {
  const ch = new FakeChannel();
  const p = createPresence({ session: "me", channel: ch, now: clock().now });
  p.close();
  assert.equal(ch.closed, true);
});
