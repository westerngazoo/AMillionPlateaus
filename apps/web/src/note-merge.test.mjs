// note-merge.test.mjs — auto-syncing notepads must never destroy writing (R-0106).
import test from "node:test";
import assert from "node:assert/strict";

import {
  NOTE_BASE_KEY,
  normalizeNote,
  conflictText,
  mergeNote,
  parseBaselines,
  setBaseline,
  baselineFor,
  describeMerge,
} from "./note-merge.js";
import { PROFILE_KEYS, NEVER_SYNC } from "./profile.js";

test("the baseline is per-device bookkeeping and must NOT sync", () => {
  // It records what THIS device last agreed with the repo on. Syncing it would let
  // one device's agreement overwrite another's and manufacture false fast-forwards.
  assert.ok(!PROFILE_KEYS.includes(NOTE_BASE_KEY));
  assert.ok(!NEVER_SYNC.includes(NOTE_BASE_KEY), "not a secret either — just local");
});

test("normalizeNote ignores line endings and trailing whitespace, not content", () => {
  assert.equal(normalizeNote("a\r\nb"), "a\nb");
  assert.equal(normalizeNote("a   \nb\t"), "a\nb");
  assert.equal(normalizeNote("a\n\n\n"), "a");
  assert.equal(normalizeNote(null), "");
  assert.notEqual(normalizeNote("a\nb"), normalizeNote("a\nc"));
  assert.equal(normalizeNote("  indented"), "  indented", "leading indent is content");
});

test("an editor's trailing newline is NOT an edit (no false conflict)", () => {
  const r = mergeNote({ local: "note\n", remote: "note", base: "note" });
  assert.equal(r.action, "in-sync");
});

test("only the remote moved → safe fast-forward", () => {
  const r = mergeNote({ local: "old", remote: "new from boox", base: "old" });
  assert.equal(r.action, "pull");
  assert.equal(r.text, "new from boox");
  assert.equal(r.changed, true);
});

test("only we moved → push, local text untouched", () => {
  const r = mergeNote({ local: "my new writing", remote: "old", base: "old" });
  assert.equal(r.action, "push");
  assert.equal(r.text, "my new writing");
  assert.equal(r.changed, false, "a push must never rewrite what you're typing");
});

test("BOTH moved → conflict keeps BOTH versions; nothing is chosen", () => {
  const r = mergeNote({
    local: "laptop paragraph",
    remote: "boox paragraph",
    base: "shared start",
    fromDevice: "Boox",
  });
  assert.equal(r.action, "conflict");
  assert.equal(r.changed, true);
  assert.match(r.text, /laptop paragraph/, "my writing survives");
  assert.match(r.text, /boox paragraph/, "their writing survives");
  assert.match(r.text, /Also written on Boox/);
});

test("no baseline: absence is not an edit", () => {
  // Fresh device pulling a note it has never seen — nothing local to lose.
  assert.deepEqual(mergeNote({ local: "", remote: "from repo" }), {
    action: "pull",
    text: "from repo",
    changed: true,
  });
  // Local note, nothing in the repo yet — push it.
  const push = mergeNote({ local: "mine", remote: "" });
  assert.equal(push.action, "push");
  assert.equal(push.changed, false);
  // Both have text and there is no baseline to judge by → keep both, don't guess.
  const both = mergeNote({ local: "mine", remote: "theirs" });
  assert.equal(both.action, "conflict");
  assert.match(both.text, /mine/);
  assert.match(both.text, /theirs/);
});

test("identical text is in-sync regardless of baseline", () => {
  assert.equal(mergeNote({ local: "x", remote: "x", base: "y" }).action, "in-sync");
  assert.equal(mergeNote({ local: "x", remote: "x" }).action, "in-sync");
  assert.equal(mergeNote({ local: "", remote: "" }).action, "in-sync");
});

test("conflictText obeys the markdown.js subset", () => {
  const t = conflictText("mine", "theirs", "Boox");
  const lines = t.split("\n");
  const h = lines.findIndex((l) => l.startsWith("## "));
  assert.ok(h > 0, "has a heading");
  assert.equal(lines[h - 1], "", "heading starts its own block");
  assert.equal(lines[h + 1], "", "and is followed by a blank line");
  assert.ok(!/^>/m.test(t), "no blockquote — markdown.js renders > literally");
  assert.ok(t.indexOf("mine") < t.indexOf("theirs"), "my version comes first");
});

test("baselines: parse, set, read, and reject junk", () => {
  assert.deepEqual(parseBaselines(null), {});
  assert.deepEqual(parseBaselines([1, 2]), {});
  assert.deepEqual(parseBaselines({ a: "x", b: 5, "": "y" }), { a: "x" });
  const b1 = setBaseline({}, "t1", "text\n");
  assert.equal(baselineFor(b1, "t1"), "text", "stored normalised");
  assert.equal(baselineFor(b1, "nope"), undefined, "never-synced is undefined, not ''");
  const b2 = setBaseline(b1, "t2", "other");
  assert.deepEqual(Object.keys(b2).sort(), ["t1", "t2"]);
  assert.deepEqual(Object.keys(b1), ["t1"], "setBaseline does not mutate");
  // an empty synced note is a real baseline of "", distinct from never-synced
  assert.equal(baselineFor(setBaseline({}, "t3", ""), "t3"), "");
});

test("a synced-then-emptied note is distinguishable from never-synced", () => {
  // You deliberately cleared the note here; the repo still has the old text.
  // That IS a local edit, so it must not be silently fast-forwarded back.
  const r = mergeNote({ local: "", remote: "old text", base: "old text" });
  assert.equal(r.action, "push", "clearing a note is an edit, not absence");
});

test("describeMerge speaks plainly, and says nothing when in sync", () => {
  assert.match(describeMerge("pull", "Boox"), /Synced this note from Boox/);
  assert.match(describeMerge("conflict"), /BOTH versions kept/);
  assert.match(describeMerge("push"), /Backing this note up/);
  assert.equal(describeMerge("in-sync"), "");
});
