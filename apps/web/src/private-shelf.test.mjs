// private-shelf.test.mjs — node --test, pure (R-0052). The private shelf's
// storage-shape guarantees: corrupt-safe load, immutable add/remove, and the
// always-an-array read that the render/grounding glue leans on.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SHELF_KEY,
  loadShelf,
  saveShelf,
  shelfFor,
  addToShelf,
  removeFromShelf,
} from "./private-shelf.js";

const fakeStorage = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    dump: () => Object.fromEntries(m),
  };
};

test("loadShelf: missing, corrupt JSON, and non-object payloads all → empty shelf", () => {
  assert.deepEqual(loadShelf(fakeStorage()), {});
  assert.deepEqual(loadShelf(fakeStorage({ [SHELF_KEY]: "{not json" })), {});
  assert.deepEqual(loadShelf(fakeStorage({ [SHELF_KEY]: '"a string"' })), {});
  assert.deepEqual(loadShelf(fakeStorage({ [SHELF_KEY]: "[1,2]" })), {});
});

test("save → load round-trips the map", () => {
  const s = fakeStorage();
  const shelf = { p1: [{ id: "r1", title: "My Boox margins", kind: "Note", uri: "" }] };
  saveShelf(s, shelf);
  assert.deepEqual(loadShelf(s), shelf);
});

test("addToShelf: appends immutably; missing plateau/row-id change nothing", () => {
  const shelf = { p1: [{ id: "r1", title: "a", kind: "Note", uri: "" }] };
  const next = addToShelf(shelf, "p1", { id: "r2", title: "b", kind: "Paper", uri: "resource://local/x" });
  assert.equal(next.p1.length, 2);
  assert.equal(shelf.p1.length, 1, "input untouched");
  assert.equal(addToShelf(shelf, null, { id: "r9" }), shelf);
  assert.equal(addToShelf(shelf, "p1", { title: "no id" }), shelf);
  // a new plateau gets its own list
  assert.equal(addToShelf(shelf, "p2", { id: "r3", title: "c", kind: "Note", uri: "" }).p2.length, 1);
});

test("removeFromShelf: drops the row; an emptied plateau vanishes from the map", () => {
  const shelf = {
    p1: [{ id: "r1" }, { id: "r2" }],
    p2: [{ id: "r3" }],
  };
  const next = removeFromShelf(shelf, "p1", "r1");
  assert.deepEqual(next.p1.map((r) => r.id), ["r2"]);
  const gone = removeFromShelf(next, "p2", "r3");
  assert.equal("p2" in gone, false, "empty shelves leave no key behind");
  assert.equal(shelf.p1.length, 2, "input untouched");
});

test("shelfFor: always an array — unknown plateau, corrupt entry, null shelf", () => {
  assert.deepEqual(shelfFor({}, "p1"), []);
  assert.deepEqual(shelfFor({ p1: "corrupt" }, "p1"), []);
  assert.deepEqual(shelfFor(null, "p1"), []);
  assert.deepEqual(shelfFor({ p1: [{ id: "r1" }] }, "p1"), [{ id: "r1" }]);
});
