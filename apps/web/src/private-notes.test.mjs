// private-notes.test.mjs — node --test, pure (R-0056).
import test from "node:test";
import assert from "node:assert/strict";
import { NOTES_KEY, loadNotes, saveNotes, noteFor, setNote } from "./private-notes.js";

// A minimal localStorage-like double.
function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _dump: () => m,
  };
}

test("loadNotes: empty/corrupt/array store → {}", () => {
  assert.deepEqual(loadNotes(fakeStorage()), {});
  assert.deepEqual(loadNotes(fakeStorage({ [NOTES_KEY]: "not json" })), {});
  assert.deepEqual(loadNotes(fakeStorage({ [NOTES_KEY]: "[1,2]" })), {});
});

test("save → load round-trips the map", () => {
  const s = fakeStorage();
  saveNotes(s, { p1: "# hi", p2: "notes" });
  assert.deepEqual(loadNotes(s), { p1: "# hi", p2: "notes" });
});

test("noteFor returns the topic's markdown, else empty string", () => {
  const notes = { p1: "body" };
  assert.equal(noteFor(notes, "p1"), "body");
  assert.equal(noteFor(notes, "missing"), "");
  assert.equal(noteFor(null, "p1"), "");
});

test("setNote is immutable and sets/updates a note", () => {
  const a = {};
  const b = setNote(a, "p1", "first");
  assert.deepEqual(a, {}, "input untouched");
  assert.equal(b.p1, "first");
  const c = setNote(b, "p1", "edited");
  assert.equal(c.p1, "edited");
});

test("setNote deletes on empty/whitespace so no blank keys accumulate", () => {
  const start = { p1: "keep", p2: "gone-soon" };
  assert.equal("p2" in setNote(start, "p2", ""), false);
  assert.equal("p2" in setNote(start, "p2", "   \n "), false);
  assert.deepEqual(setNote(start, "p2", "").p1, "keep");
  // a brand-new empty note never creates a key
  assert.deepEqual(setNote({}, "p9", ""), {});
});

test("never synced surface: the module only touches its own key", () => {
  const s = fakeStorage({ "mp.modelConfig": "SECRET" });
  saveNotes(s, { p1: "x" });
  assert.equal(s.getItem("mp.modelConfig"), "SECRET", "leaves other keys alone");
  assert.equal(s._dump().size, 2);
});
