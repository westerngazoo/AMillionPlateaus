// live-sync.test.mjs — the auto-handshake state machine (R-0089). Pure.
import test from "node:test";
import assert from "node:assert/strict";

import { createLiveSession, newSessionId, roomIdFor } from "./live-sync.js";

test("roomIdFor: same secret → same room; different → different; relay-grammar-safe", () => {
  assert.equal(roomIdFor("me/plateaus-world"), roomIdFor("me/plateaus-world"));
  assert.notEqual(roomIdFor("me/plateaus-world"), roomIdFor("me/other-repo"));
  assert.match(roomIdFor("gitea.example.com/ada/world"), /^live-[a-z0-9]{1,60}$/);
  assert.match(roomIdFor(""), /^live-/); // safe on empty
});

// A 2-peer relay bus: whatever one session sends is delivered to the other's
// handle(). Frames queue; `flush()` drains until quiet (handlers are async).
function makeBus() {
  let A, B;
  const q = [];
  const joined = new Set(); // a peer only receives frames once it has joined the room
  // Gate at SEND time (like the real relay: a 1-peer room forwards to nobody).
  const busFor = (other) => ({ send: (t) => { if (joined.has(other)) q.push([other, t]); }, close() {} });
  const busA = busFor("B");
  const busB = busFor("A");
  async function flush() {
    let guard = 0;
    while (q.length) {
      if (guard++ > 100) throw new Error("relay did not settle (loop?)");
      const [to, text] = q.shift();
      await (to === "A" ? A : B).handle(text);
    }
  }
  // startPeer = join the room, then announce (start) — the real ordering.
  return {
    busA, busB, flush,
    bind: (a, b) => ((A = a), (B = b)),
    startA: () => (joined.add("A"), A.start()),
    startB: () => (joined.add("B"), B.start()),
  };
}

function mockPeer(log, name) {
  return {
    async createOffer() { log.push(`${name}:createOffer`); return `offer<${name}>`; },
    async acceptOffer(sdp) { log.push(`${name}:acceptOffer(${sdp})`); return `answer<${name}>`; },
    async acceptAnswer(sdp) { log.push(`${name}:acceptAnswer(${sdp})`); },
    close() { log.push(`${name}:close`); },
  };
}

function scenario(idHi, idLo) {
  const bus = makeBus();
  const log = [];
  const statesHi = [], statesLo = [];
  // "hi" always gets the lexicographically-greater id → should become offerer
  const hi = createLiveSession({ myId: idHi, relay: bus.busA, makePeer: () => mockPeer(log, "hi"), onStatus: (s) => statesHi.push(s) });
  const lo = createLiveSession({ myId: idLo, relay: bus.busB, makePeer: () => mockPeer(log, "lo"), onStatus: (s) => statesLo.push(s) });
  bus.bind(hi, lo);
  return { bus, log, hi, lo, statesHi, statesLo };
}

test("higher id becomes the offerer; full offer→answer→accept regardless of join order", async () => {
  for (const order of ["hi-first", "lo-first"]) {
    const { bus, log, statesHi, statesLo } = scenario("zzz9", "aaa1");
    if (order === "hi-first") { bus.startA(); bus.startB(); } else { bus.startB(); bus.startA(); }
    await bus.flush();
    // exactly one offerer (hi), one answerer (lo), and the accept closes the loop
    assert.deepEqual(log, [`hi:createOffer`, `lo:acceptOffer(offer<hi>)`, `hi:acceptAnswer(answer<lo>)`], `order=${order}`);
    assert.ok(statesHi.includes("connecting") && statesLo.includes("connecting"));
  }
});

test("idempotent: duplicate hellos never double-elect / double-offer", async () => {
  const { bus, log, hi, lo } = scenario("m2", "m1");
  bus.startA();
  bus.startB();
  // inject extra stray hellos both ways
  await hi.handle(JSON.stringify({ t: "hello", id: "m1" }));
  await lo.handle(JSON.stringify({ t: "hello", id: "m2" }));
  await bus.flush();
  assert.equal(log.filter((l) => l === "hi:createOffer").length, 1, "offer sent exactly once");
  assert.equal(log.filter((l) => l.startsWith("lo:acceptOffer")).length, 1, "answered exactly once");
});

test("late joiner: the first-seen peer re-announces so a device that opened later pairs", async () => {
  // hi starts and announces into an empty room (lo not present yet)
  const { bus, log } = scenario("y9", "b1");
  bus.startA();
  await bus.flush(); // hi's hello reaches nobody — lo hasn't joined the room
  assert.equal(log.length, 0);
  // lo opens the app now and joins; hi must re-hello so lo learns hi's id
  bus.startB();
  await bus.flush();
  assert.deepEqual(log, [`hi:createOffer`, `lo:acceptOffer(offer<hi>)`, `hi:acceptAnswer(answer<lo>)`]);
});

test("handle tolerates junk and non-JSON frames (scan-note binary, garbage)", async () => {
  const { bus, hi } = scenario("q2", "q1");
  await assert.doesNotReject(async () => {
    await hi.handle("not json");
    await hi.handle(JSON.stringify({ nope: 1 }));
    await hi.handle(JSON.stringify({ t: "unknown" }));
    await bus.flush();
  });
});

test("stop() closes the peer + relay and reports closed", async () => {
  const { bus, log, hi, lo } = scenario("t2", "t1");
  hi.start(); lo.start();
  await bus.flush();
  const states = [];
  const s = createLiveSession({ myId: "x", relay: { send() {}, close() { log.push("relay:close"); } }, makePeer: () => mockPeer(log, "x"), onStatus: (st) => states.push(st) });
  s.start();
  s.stop();
  assert.ok(states.includes("closed"));
  assert.ok(log.includes("relay:close"));
});

test("newSessionId is a nonempty string and varies with the RNG", () => {
  let i = 0;
  const seq = [0.1, 0.9, 0.5, 0.2];
  const rand = () => seq[i++ % seq.length];
  const a = newSessionId(rand);
  const b = newSessionId(rand);
  assert.equal(typeof a, "string");
  assert.ok(a.length > 0);
  assert.notEqual(a, b);
});
