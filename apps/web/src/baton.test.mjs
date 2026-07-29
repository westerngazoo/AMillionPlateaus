// baton.test.mjs — hand the topic you're studying to your other device (R-0105).
import test from "node:test";
import assert from "node:assert/strict";

import {
  BATON_KEY,
  BATON_TTL_MS,
  deviceLabel,
  makeBaton,
  parseBatons,
  pushBaton,
  latestFrom,
  describeBaton,
  clearBatonFrom,
} from "./baton.js";
import { PROFILE_KEYS, NEVER_SYNC, deepMergeUnion } from "./profile.js";

const T = 1_800_000_000_000; // a fixed "now" — the module never reads the clock

test("the baton rides the synced profile, and is not a secret", () => {
  assert.ok(PROFILE_KEYS.includes(BATON_KEY), "must sync or the hand-off never arrives");
  assert.ok(!NEVER_SYNC.includes(BATON_KEY));
});

test("deviceLabel: a Boox is recognised, else a coarse form factor", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 11; ONYX BOOX Note Air)"), "Boox");
  assert.equal(deviceLabel("... (Linux; Android 10; onyx boox)"), "Boox");
  assert.equal(deviceLabel("Mozilla/5.0 (iPad; CPU OS 17_0)"), "Tablet");
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile"), "Phone");
  assert.equal(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "Laptop");
  assert.equal(deviceLabel(""), "Laptop");
});

test("makeBaton: carries the pointer, needs a topic", () => {
  const b = makeBaton({ device: "Laptop", topicId: "t1", name: "Reflections", at: T });
  assert.equal(b.device, "Laptop");
  assert.equal(b.topicId, "t1");
  assert.equal(b.name, "Reflections");
  assert.equal(b.id, "Laptop@" + T, "id makes the array union dedupe exact repeats");
  assert.equal(makeBaton({ device: "Laptop", at: T }), null, "no topic → nothing to hand over");
  assert.equal(makeBaton({}), null);
});

test("pushBaton: one live pointer per device, capped, never mutates", () => {
  const first = makeBaton({ device: "Laptop", topicId: "t1", name: "A", at: T });
  const second = makeBaton({ device: "Laptop", topicId: "t2", name: "B", at: T + 1000 });
  const boox = makeBaton({ device: "Boox", topicId: "t3", name: "C", at: T + 500 });
  const list = pushBaton(pushBaton(pushBaton([], first), boox), second);
  assert.deepEqual(
    list.map((b) => `${b.device}:${b.topicId}`),
    ["Boox:t3", "Laptop:t2"],
    "the laptop's older pointer is replaced, the Boox's is untouched",
  );
  const src = [first];
  pushBaton(src, second);
  assert.deepEqual(src, [first], "input array is not mutated");
  // cap
  let big = [];
  for (let i = 0; i < 12; i++) {
    big = pushBaton(big, makeBaton({ device: "D" + i, topicId: "t", at: T + i }), { max: 8 });
  }
  assert.equal(big.length, 8);
});

test("latestFrom: the freshest pointer from ANOTHER device, within the TTL", () => {
  const list = [
    makeBaton({ device: "Laptop", topicId: "t1", name: "Old", at: T - 1000 }),
    makeBaton({ device: "Laptop", topicId: "t2", name: "New", at: T - 10 }),
    makeBaton({ device: "Boox", topicId: "t9", name: "Mine", at: T }),
  ];
  const got = latestFrom(list, "Boox", T);
  assert.equal(got.topicId, "t2", "freshest foreign pointer wins");
  assert.equal(latestFrom(list, "Laptop", T).topicId, "t9", "seen from the laptop, the Boox's wins");
  // its own pointer is never handed back to itself
  assert.equal(latestFrom([makeBaton({ device: "Boox", topicId: "t9", at: T })], "Boox", T), null);
  // stale is ignored — you moved on hours ago
  const stale = [makeBaton({ device: "Laptop", topicId: "t1", at: T - BATON_TTL_MS - 1 })];
  assert.equal(latestFrom(stale, "Boox", T), null);
  // a clock-skewed FUTURE baton is ignored rather than pinned forever
  assert.equal(latestFrom([makeBaton({ device: "Laptop", topicId: "t1", at: T + 5000 })], "Boox", T), null);
  assert.equal(latestFrom(null, "Boox", T), null);
});

test("parseBatons drops junk without throwing", () => {
  assert.deepEqual(parseBatons(null), []);
  assert.deepEqual(parseBatons("nope"), []);
  assert.deepEqual(parseBatons([null, {}, { topicId: "t" }, { device: "D", at: 1 }]), []);
  assert.equal(parseBatons([makeBaton({ device: "D", topicId: "t", at: 1 })]).length, 1);
});

test("describeBaton reads as a sentence; clearBatonFrom removes one device", () => {
  const b = makeBaton({ device: "Laptop", topicId: "t1", name: "Reflections", at: T });
  assert.equal(describeBaton(b), "Laptop is on “Reflections”");
  assert.match(describeBaton(makeBaton({ device: "Boox", topicId: "t", at: T })), /a topic/);
  assert.equal(describeBaton(null), "");
  const list = [b, makeBaton({ device: "Boox", topicId: "t2", at: T })];
  assert.deepEqual(clearBatonFrom(list, "Laptop").map((x) => x.device), ["Boox"]);
});

// The reason the baton is an ARRAY: profile.js merges scalars local-wins, so an
// object pointer would be swallowed by the receiver's own stale value.
test("REGRESSION: the array survives the profile merge; an object would not", () => {
  const laptop = [makeBaton({ device: "Laptop", topicId: "t-new", name: "Reflections", at: T })];
  const boox = [makeBaton({ device: "Boox", topicId: "t-old", name: "Whatever", at: T - 9999 })];
  // Boox pulls: local=boox, remote=laptop
  const merged = deepMergeUnion(boox, laptop);
  assert.equal(merged.length, 2, "both devices' pointers survive the union");
  assert.equal(latestFrom(merged, "Boox", T).topicId, "t-new", "the laptop's hand-off arrives");

  // Contrast: as a plain object the receiver's stale value wins and it never arrives.
  const asObject = deepMergeUnion({ topicId: "t-old" }, { topicId: "t-new" });
  assert.equal(asObject.topicId, "t-old", "scalars are local-wins — why we use an array");
});
