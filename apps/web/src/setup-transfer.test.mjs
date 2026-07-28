import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SETUP_KEYS,
  SETUP_PREFIX,
  buildSetup,
  encodeSetup,
  decodeSetup,
  applySetup,
  setupSecret,
  describeSetup,
} from "./setup-transfer.js";

// A tiny localStorage stand-in.
function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _map: m,
  };
}

const FULL = {
  "mp.wizardSecret": "a".repeat(64),
  "mp.notesSync": JSON.stringify({ repo: "me/plateaus", token: "github_pat_SECRET", server: "" }),
  "mp.modelConfig": JSON.stringify({ provider: "gemini", apiKey: "AIzaSECRET" }),
  "mp.modelSlots": JSON.stringify([{ name: "local", apiKey: "x" }]),
  "mp.relayUrl": "https://relay.example/w",
  "mp.pairRelayUrl": "https://relay.example/p",
  "mp.peers": JSON.stringify([{ repo: "friend/world" }]),
  // NOT a setup key — must be ignored:
  "mp.eventLog": JSON.stringify([{ id: "evt1" }]),
  "mp.tutorialSeen": "1",
};

test("buildSetup carries exactly the SETUP_KEYS present, nothing else", () => {
  const s = buildSetup(store(FULL));
  assert.deepEqual(Object.keys(s.keys).sort(), [...SETUP_KEYS].sort());
  assert.ok(!("mp.eventLog" in s.keys), "profile data must not ride in the setup blob");
  assert.ok(!("mp.tutorialSeen" in s.keys), "trivial UI state is excluded");
});

test("round-trip: encode → decode → apply restores byte-identical values", () => {
  const src = store(FULL);
  const blob = encodeSetup(buildSetup(src));
  assert.ok(blob.startsWith(SETUP_PREFIX));
  assert.ok(!/\s/.test(blob), "blob must be a single whitespace-free line for safe paste");

  const dst = store();
  const changed = applySetup(decodeSetup(blob), dst);
  assert.deepEqual(changed.sort(), [...SETUP_KEYS].sort());
  for (const k of SETUP_KEYS) assert.equal(dst.getItem(k), FULL[k]);
});

test("apply is idempotent — a second apply changes nothing", () => {
  const blob = encodeSetup(buildSetup(store(FULL)));
  const dst = store();
  applySetup(decodeSetup(blob), dst);
  const again = applySetup(decodeSetup(blob), dst);
  assert.deepEqual(again, [], "re-applying the same setup should report no changes");
});

test("the secret key IS in the blob (this is the whole point) and is extractable", () => {
  // Opposite of the profile invariant: the setup blob's JOB is to move the secret.
  const s = buildSetup(store(FULL));
  const blob = encodeSetup(s);
  const raw = Buffer.from(blob.slice(SETUP_PREFIX.length), "base64").toString("utf8");
  assert.match(raw, /a{64}/, "wizard secret must be present in the blob body");
  assert.equal(setupSecret(decodeSetup(blob)), "a".repeat(64));
});

test("decodeSetup rejects non-blobs, junk, and newer schema versions", () => {
  assert.equal(decodeSetup("hello world"), null);
  assert.equal(decodeSetup(""), null);
  assert.equal(decodeSetup(null), null);
  assert.equal(decodeSetup(SETUP_PREFIX + "!!!not-base64!!!"), null);
  const newer = SETUP_PREFIX + Buffer.from(JSON.stringify({ v: 999, keys: {} })).toString("base64");
  assert.equal(decodeSetup(newer), null, "a blob from a newer app must be refused, not half-applied");
});

test("decodeSetup tolerates whitespace from a sloppy paste", () => {
  const blob = encodeSetup(buildSetup(store(FULL)));
  const s = decodeSetup("  \n" + blob + "\n  ");
  assert.equal(s.keys["mp.wizardSecret"], FULL["mp.wizardSecret"]);
});

test("a hand-edited blob cannot smuggle in a non-setup key", () => {
  const evil = SETUP_PREFIX + Buffer.from(
    JSON.stringify({ v: 1, keys: { "mp.wizardSecret": "b".repeat(64), "mp.somethingElse": "x" } })
  ).toString("base64");
  const dst = store();
  applySetup(decodeSetup(evil), dst);
  assert.equal(dst.getItem("mp.wizardSecret"), "b".repeat(64));
  assert.equal(dst.getItem("mp.somethingElse"), null, "only recognised SETUP_KEYS are written");
});

test("partial setup: only the keys present are carried and applied", () => {
  const src = store({ "mp.wizardSecret": "c".repeat(64), "mp.relayUrl": "https://r/x" });
  const blob = encodeSetup(buildSetup(src));
  const s = decodeSetup(blob);
  assert.deepEqual(Object.keys(s.keys).sort(), ["mp.relayUrl", "mp.wizardSecret"]);
  const dst = store();
  assert.deepEqual(applySetup(s, dst).sort(), ["mp.relayUrl", "mp.wizardSecret"]);
});

test("describeSetup names what will cross over, in plain words", () => {
  assert.equal(describeSetup(buildSetup(store(FULL))), "your identity, sync repo + token, model setup, relays, followed wizards");
  assert.equal(describeSetup({ keys: {} }), "nothing");
});
