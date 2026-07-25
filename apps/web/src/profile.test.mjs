import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_KEYS, NEVER_SYNC, PROFILE_FILE, PROFILE_V,
  collectProfile, deepMergeUnion, mergeProfile, applyProfile,
  profileFingerprint, parseProfile,
} from "./profile.js";

// a minimal localStorage-like store
function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _dump: () => Object.fromEntries(m),
  };
}

// ── THE non-negotiable: no secret ever enters the synced profile ─────────────
test("a secret in localStorage is NEVER collected into the profile", () => {
  const s = store({
    "mp.wizardSecret": "deadbeef-secret-hex",
    "mp.notesSync": JSON.stringify({ token: "ghp_supersecret", owner: "me" }),
    "mp.modelConfig": JSON.stringify({ apiKey: "sk-secret" }),
    "mp.peers": JSON.stringify([{ owner: "x", token: "ghp_peer" }]),
    "mp.relayUrl": "wss://relay",
    "mp.confusions": JSON.stringify({ t1: ["huh"] }),
    "mp.eventLog": JSON.stringify([{ id: "e1", kind: 30 }]),
  });
  const prof = collectProfile(s);
  const serialized = JSON.stringify(prof);
  for (const bad of ["deadbeef-secret-hex", "ghp_supersecret", "sk-secret", "ghp_peer", "wss://relay"])
    assert.equal(serialized.includes(bad), false, `SECRET LEAKED: ${bad}`);
  // the personal keys DID get collected
  assert.ok("mp.confusions" in prof.keys);
  assert.ok("mp.eventLog" in prof.keys);
  // and the allow/deny lists are disjoint
  for (const k of NEVER_SYNC) assert.equal(PROFILE_KEYS.includes(k), false, `${k} is in both lists`);
});

test("PROFILE_KEYS covers the personal state; the constants are sane", () => {
  assert.equal(PROFILE_FILE, "profile/state.json");
  assert.equal(PROFILE_V, 1);
  for (const k of ["mp.eventLog", "mp.lessonProgress", "mp.reviewQueue", "mp.confusions",
                   "mp.prereqs", "mp.domains", "mp.proofs", "mp.privateShelf"])
    assert.ok(PROFILE_KEYS.includes(k), `${k} should sync`);
  // notes sync on their own R-0075 channel — not doubled here
  assert.equal(PROFILE_KEYS.includes("mp.privateNotes"), false);
});

test("collectProfile parses values and skips absent/corrupt ones", () => {
  const s = store({ "mp.confusions": JSON.stringify({ a: 1 }), "mp.fade": "{not json" });
  const prof = collectProfile(s);
  assert.deepEqual(prof.keys["mp.confusions"], { a: 1 });
  assert.equal("mp.fade" in prof.keys, false, "corrupt value skipped");
  assert.equal("mp.eventLog" in prof.keys, false, "absent key skipped");
});

// ── merge is additive and never loses local work ────────────────────────────
test("deepMergeUnion: arrays union by id, objects union keys, local wins scalars", () => {
  // signed-event log: union by id
  assert.deepEqual(
    deepMergeUnion([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]),
    [{ id: "a" }, { id: "b" }, { id: "c" }],
  );
  // maps: remote fills gaps, shared keys merge, local wins a scalar collision
  assert.deepEqual(
    deepMergeUnion({ t1: { step: 3 }, shared: 1 }, { t2: { step: 5 }, shared: 2 }),
    { t1: { step: 3 }, shared: 1, t2: { step: 5 } },
  );
  assert.equal(deepMergeUnion(3, 5), 3, "scalar: local wins");
  assert.equal(deepMergeUnion(undefined, 5), 5, "undefined local yields remote");
  // plain arrays without ids dedupe by JSON
  assert.deepEqual(deepMergeUnion(["x", "y"], ["y", "z"]), ["x", "y", "z"]);
});

test("mergeProfile merges shared keys, carries over one-sided keys, ignores stranger keys", () => {
  const local = { v: 1, keys: { "mp.eventLog": [{ id: "e1" }], "mp.confusions": { t1: ["a"] } } };
  const remote = {
    v: 1,
    keys: {
      "mp.eventLog": [{ id: "e2" }], // union → e1 + e2
      "mp.prereqs": { t9: ["g"] }, // only remote has it → carried over
      "mp.wizardSecret": "LEAK", // a stranger key must be ignored
    },
  };
  const merged = mergeProfile(local, remote);
  assert.deepEqual(merged.keys["mp.eventLog"].map((e) => e.id), ["e1", "e2"]);
  assert.deepEqual(merged.keys["mp.confusions"], { t1: ["a"] });
  assert.deepEqual(merged.keys["mp.prereqs"], { t9: ["g"] });
  assert.equal("mp.wizardSecret" in merged.keys, false, "a non-profile key can't sneak in via merge");
});

test("applyProfile writes only PROFILE_KEYS and reports what changed", () => {
  const s = store({ "mp.confusions": JSON.stringify({ t1: ["old"] }) });
  const changed = applyProfile(
    { v: 1, keys: { "mp.confusions": { t1: ["old"], t2: ["new"] }, "mp.wizardSecret": "LEAK" } },
    s,
  );
  assert.deepEqual(changed, ["mp.confusions"]);
  assert.equal(s.getItem("mp.wizardSecret"), null, "a stranger key is never written");
  assert.deepEqual(JSON.parse(s.getItem("mp.confusions")), { t1: ["old"], t2: ["new"] });
  // idempotent: applying the same profile again changes nothing
  assert.deepEqual(applyProfile({ v: 1, keys: { "mp.confusions": { t1: ["old"], t2: ["new"] } } }, s), []);
});

// The round-trip that IS the feature: device A's progress restored on device B.
test("end to end: another device's progress merges in and nothing local is lost", () => {
  const deviceB = store({
    "mp.eventLog": JSON.stringify([{ id: "b-mastery", kind: 30 }]), // B mastered something
    "mp.confusions": JSON.stringify({ topicX: ["B's confusion"] }),
  });
  // A's profile pulled from the repo
  const fromRepo = parseProfile(JSON.stringify({
    v: 1,
    keys: {
      "mp.eventLog": [{ id: "a-mastery", kind: 30 }], // A mastered something else
      "mp.prereqs": { optica: ["geometria"] }, // A added a prereq
    },
  }));
  const merged = mergeProfile(collectProfile(deviceB), fromRepo);
  applyProfile(merged, deviceB);
  const events = JSON.parse(deviceB.getItem("mp.eventLog")).map((e) => e.id);
  assert.deepEqual(events.sort(), ["a-mastery", "b-mastery"], "both devices' mastery now present");
  assert.deepEqual(JSON.parse(deviceB.getItem("mp.confusions")), { topicX: ["B's confusion"] }, "B kept its own");
  assert.deepEqual(JSON.parse(deviceB.getItem("mp.prereqs")), { optica: ["geometria"] }, "A's prereq arrived");
});

test("profileFingerprint is stable regardless of key insertion order", () => {
  const a = collectProfile(store({ "mp.confusions": JSON.stringify({ x: 1 }), "mp.fade": JSON.stringify({ y: 2 }) }));
  const b = collectProfile(store({ "mp.fade": JSON.stringify({ y: 2 }), "mp.confusions": JSON.stringify({ x: 1 }) }));
  assert.equal(profileFingerprint(a), profileFingerprint(b));
});

test("parseProfile rejects junk and a newer schema version", () => {
  assert.equal(parseProfile("not json"), null);
  assert.equal(parseProfile(JSON.stringify({ v: 1 })), null); // no keys{}
  assert.equal(parseProfile(JSON.stringify({ v: PROFILE_V + 1, keys: {} })), null); // too new
  assert.deepEqual(parseProfile(JSON.stringify({ keys: { "mp.confusions": {} } })).keys, { "mp.confusions": {} });
});
