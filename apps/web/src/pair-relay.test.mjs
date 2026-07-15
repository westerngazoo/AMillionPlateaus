// pair-relay.test.mjs — node --test, pure, no network (R-0058).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPairRelay, pairRoomUrl, createPairChannel, PAIR_RELAY_KEY, DEFAULT_PAIR_RELAY } from "./pair-relay.js";

test("pairRoomUrl normalizes the scheme to ws/wss and appends the room", () => {
  assert.equal(pairRoomUrl("https://r.example/", "abc123"), "wss://r.example/room/abc123");
  assert.equal(pairRoomUrl("http://127.0.0.1:8787", "x"), "ws://127.0.0.1:8787/room/x");
  assert.equal(pairRoomUrl("wss://r.example", "x"), "wss://r.example/room/x"); // already ws
  assert.equal(pairRoomUrl("wss://r.example///", "a b"), "wss://r.example/room/a%20b"); // strip slashes + encode
});

test("pairRoomUrl is null when unconfigured", () => {
  assert.equal(pairRoomUrl("", "abc"), null);
  assert.equal(pairRoomUrl("wss://r", ""), null);
  assert.equal(pairRoomUrl(undefined, undefined), null);
});

test("loadPairRelay: localStorage override wins, else the default; corrupt storage is safe", () => {
  assert.equal(loadPairRelay({ getItem: () => "wss://mine.workers.dev" }), "wss://mine.workers.dev");
  assert.equal(loadPairRelay({ getItem: () => "   " }), DEFAULT_PAIR_RELAY); // blank → default
  assert.equal(loadPairRelay({ getItem: () => null }), DEFAULT_PAIR_RELAY);
  assert.equal(loadPairRelay({ getItem: () => { throw new Error("denied"); } }), DEFAULT_PAIR_RELAY);
  assert.equal(loadPairRelay(undefined), DEFAULT_PAIR_RELAY);
});

// A fake WebSocket driven by the test.
function FakeWS() {
  const ws = { sent: [], readyState: 0, binaryType: "" };
  ws.send = (m) => ws.sent.push(m);
  ws.close = () => { ws.readyState = 3; };
  ws.open = () => ws.onopen && ws.onopen();
  ws.recv = (data) => ws.onmessage && ws.onmessage({ data });
  const ctor = function () { return ws; };
  ctor.instance = ws;
  return ctor;
}

test("createPairChannel is inert (no throw) when no url or no WebSocket", () => {
  let s;
  const ch = createPairChannel({ url: "", onStatus: (x) => (s = x) });
  assert.equal(s, "unavailable");
  assert.doesNotThrow(() => { ch.send(new Uint8Array([1])); ch.close(); });
});

test("bytes sent before open are queued, then flushed in order on open", () => {
  const WS = FakeWS();
  let status;
  const ch = createPairChannel({ url: "wss://r/room/x", onStatus: (x) => (status = x), WebSocketCtor: WS });
  ch.send(new Uint8Array([1, 2]));
  ch.send(new Uint8Array([3]));
  assert.equal(WS.instance.sent.length, 0, "nothing sent before open");
  WS.instance.open();
  assert.equal(status, "online");
  assert.equal(WS.instance.sent.length, 2, "both flushed on open");
  ch.send(new Uint8Array([4])); // after open → straight through
  assert.equal(WS.instance.sent.length, 3);
});

test("onImage receives inbound binary as a Uint8Array (ArrayBuffer + view)", () => {
  const WS = FakeWS();
  const got = [];
  createPairChannel({ url: "wss://r/room/x", onImage: (b) => got.push(b), WebSocketCtor: WS });
  WS.instance.recv(new Uint8Array([9, 9, 9]).buffer); // ArrayBuffer
  WS.instance.recv(new Uint8Array([7])); // a view
  assert.equal(got.length, 2);
  assert.ok(got[0] instanceof Uint8Array);
  assert.deepEqual([...got[0]], [9, 9, 9]);
  assert.deepEqual([...got[1]], [7]);
});

test("a text control frame does not fire onImage", () => {
  const WS = FakeWS();
  let fired = 0;
  createPairChannel({ url: "wss://r/room/x", onImage: () => fired++, WebSocketCtor: WS });
  WS.instance.recv('{"type":"error","error":"frame too large"}');
  assert.equal(fired, 0);
});

test("PAIR_RELAY_KEY is the local-only setting name", () => {
  assert.equal(PAIR_RELAY_KEY, "mp.pairRelayUrl");
});
