// events.test.mjs — node --test, no wasm. Proves the verified event log: the
// verify gate, dedupe, the localStorage mirror, and that reputation comes ONLY
// from recompute over the log with no seed (SPEC-0010 §2.3, R-0010 AC2/AC3). The
// crypto/GA is faked — BIP340 + the GA recompute are host-tested in mp-identity;
// what is under test is the JS plumbing. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { makeLog, LOG_KEY } from "./events.js";

// Fake wasm: an event is "valid" unless its sig is the sentinel "BAD"; recompute
// echoes the verified-event count into a grade-1 slot so we can assert plumbing.
const wasm = {
  verify_event: (json) => {
    try {
      return JSON.parse(json).sig !== "BAD";
    } catch {
      return false;
    }
  },
  recompute_reputation: (logJson, pubkey) => {
    const evs = JSON.parse(logJson);
    return JSON.stringify({
      domain_reps: { [pubkey]: [0, evs.length, 0, 0, 0, 0, 0, 0] },
      synthesis: [0, 0, 0, 0, 0, 0, 0, 0],
    });
  },
};

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _map: m,
  };
}

const ev = (id, sig = "ok") =>
  JSON.stringify({ id, pubkey: "me", created_at: 1, kind: 30078, tags: [], content: "{}", sig });

test("an empty log reaches nothing — empty reputation, no seed (AC3)", () => {
  const log = makeLog(wasm, "me", fakeStorage());
  assert.deepEqual(log.all(), []);
  assert.deepEqual(log.reputation(), { domain_reps: {} });
});

test("a valid event is verified, added, and mirrored to localStorage (AC2/AC3)", () => {
  const storage = fakeStorage();
  const log = makeLog(wasm, "me", storage);
  assert.equal(log.add(ev("a")), true);
  assert.equal(log.all().length, 1);
  // Reputation now reflects the one verified event via the injected recompute.
  assert.deepEqual(log.reputation().domain_reps.me, [0, 1, 0, 0, 0, 0, 0, 0]);
  // Persisted to the local mirror under exactly the event-log key.
  assert.deepEqual(JSON.parse(storage.getItem(LOG_KEY)).length, 1);
});

test("an event failing verification is dropped and contributes nothing (AC2)", () => {
  const log = makeLog(wasm, "me", fakeStorage());
  assert.equal(log.add(ev("bad", "BAD")), false);
  assert.equal(log.add("not json"), false);
  assert.deepEqual(log.all(), []);
  assert.deepEqual(log.reputation(), { domain_reps: {} });
});

test("duplicate event ids are ignored (idempotent ingest, AC4 convergence)", () => {
  const log = makeLog(wasm, "me", fakeStorage());
  assert.equal(log.add(ev("a")), true);
  assert.equal(log.add(ev("a")), false); // same id — dropped
  assert.equal(log.all().length, 1);
  assert.equal(log.has("a"), true);
});

test("a hand-edited localStorage mirror is re-verified on load (AC2 hygiene)", () => {
  // One good, one tampered (sig BAD) event sitting in the mirror.
  const seeded = JSON.stringify([
    { id: "good", pubkey: "me", created_at: 1, kind: 30078, tags: [], content: "{}", sig: "ok" },
    { id: "forged", pubkey: "me", created_at: 2, kind: 30078, tags: [], content: "{}", sig: "BAD" },
  ]);
  const log = makeLog(wasm, "me", fakeStorage({ [LOG_KEY]: seeded }));
  assert.deepEqual(
    log.all().map((e) => e.id),
    ["good"],
  );
});

test("clear() empties the log back to reaching nothing", () => {
  const storage = fakeStorage();
  const log = makeLog(wasm, "me", storage);
  log.add(ev("a"));
  log.clear();
  assert.deepEqual(log.all(), []);
  assert.deepEqual(log.reputation(), { domain_reps: {} });
  assert.deepEqual(JSON.parse(storage.getItem(LOG_KEY)), []);
});
