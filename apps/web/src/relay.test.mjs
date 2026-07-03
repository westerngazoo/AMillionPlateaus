// relay.test.mjs — node --test, no browser/relay. Proves the NIP-01 framing
// helpers and the WebSocket transport wiring (SPEC-0010 §2.3, R-0010 AC7). The
// socket is faked; what is under test is publish/subscribe framing, the
// before-open send queue, inbound event routing, and the offline flag.
// Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublish,
  buildSubscribe,
  parseRelayMessage,
  createRelay,
  KIND_TRAVERSAL,
  KIND_VOUCH,
} from "./relay.js";

const eventJson = JSON.stringify({ id: "a", pubkey: "me", kind: KIND_TRAVERSAL, sig: "ok" });

// ── pure framing helpers ───────────────────────────────────────────────────

test('buildPublish frames an event as ["EVENT", e]', () => {
  assert.deepEqual(JSON.parse(buildPublish(eventJson)), ["EVENT", JSON.parse(eventJson)]);
});

test("buildSubscribe requests our two reputation-bearing kinds", () => {
  const [verb, subId, filter] = JSON.parse(buildSubscribe());
  assert.equal(verb, "REQ");
  assert.equal(typeof subId, "string");
  assert.deepEqual(filter.kinds, [KIND_TRAVERSAL, KIND_VOUCH]);
});

test("parseRelayMessage extracts the event from an EVENT frame, ignores the rest", () => {
  const e = { id: "x" };
  assert.equal(parseRelayMessage(JSON.stringify(["EVENT", "sub", e])), JSON.stringify(e));
  assert.equal(parseRelayMessage(JSON.stringify(["EOSE", "sub"])), null);
  assert.equal(parseRelayMessage(JSON.stringify(["NOTICE", "hi"])), null);
  assert.equal(parseRelayMessage("not json"), null);
  assert.equal(parseRelayMessage(JSON.stringify({ not: "an array" })), null);
});

// ── transport wiring (injected fake socket) ─────────────────────────────────

class FakeWS {
  constructor(url) {
    this.url = url;
    this.sent = [];
    FakeWS.last = this;
  }
  send(m) {
    this.sent.push(m);
  }
  close() {
    if (this.onclose) this.onclose();
  }
  // test helpers
  fireOpen() {
    if (this.onopen) this.onopen();
  }
  fireMessage(data) {
    if (this.onmessage) this.onmessage({ data });
  }
  fireError() {
    if (this.onerror) this.onerror();
  }
}

test("on open it subscribes, and reports online (AC7)", () => {
  const states = [];
  const relay = createRelay({
    url: "wss://relay.test",
    onStatus: (s) => states.push(s),
    WebSocketCtor: FakeWS,
  });
  FakeWS.last.fireOpen();
  assert.deepEqual(JSON.parse(FakeWS.last.sent[0]), [
    "REQ",
    "mp-events",
    { kinds: [KIND_TRAVERSAL, KIND_VOUCH] },
  ]);
  assert.ok(states.includes("online"));
  relay.close();
});

test("a publish before open is queued, then flushed on open (AC7)", () => {
  const relay = createRelay({ url: "wss://relay.test", WebSocketCtor: FakeWS });
  relay.publish(eventJson); // socket not open yet → queued
  assert.equal(FakeWS.last.sent.length, 0);
  FakeWS.last.fireOpen(); // subscribe + flush
  assert.equal(FakeWS.last.sent.length, 2);
  assert.deepEqual(JSON.parse(FakeWS.last.sent[1]), ["EVENT", JSON.parse(eventJson)]);
});

test("inbound EVENT frames are routed to onEvent (AC7)", () => {
  const received = [];
  createRelay({
    url: "wss://relay.test",
    onEvent: (j) => received.push(j),
    WebSocketCtor: FakeWS,
  });
  const e = { id: "z" };
  FakeWS.last.fireMessage(JSON.stringify(["EVENT", "mp-events", e]));
  FakeWS.last.fireMessage(JSON.stringify(["EOSE", "mp-events"])); // ignored
  assert.deepEqual(received, [JSON.stringify(e)]);
});

test("a socket error sets the offline flag; the world keeps working (AC7)", () => {
  const states = [];
  createRelay({ url: "wss://relay.test", onStatus: (s) => states.push(s), WebSocketCtor: FakeWS });
  FakeWS.last.fireError();
  assert.equal(states.at(-1), "offline");
});

test("no URL ⇒ offline and inert no-op transport (offline-safe)", () => {
  const states = [];
  const relay = createRelay({ url: "", onStatus: (s) => states.push(s), WebSocketCtor: FakeWS });
  assert.deepEqual(states, ["offline"]);
  // publish/close must not throw with no socket.
  assert.doesNotThrow(() => {
    relay.publish(eventJson);
    relay.close();
  });
});
