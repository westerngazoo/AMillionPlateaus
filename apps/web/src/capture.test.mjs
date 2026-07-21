// capture.test.mjs — ⚡ Capture a topic: dedup, neighbour suggestion, placement,
// lens inference, resource kind, body, unwired inbox (R-0079).
import test from "node:test";
import assert from "node:assert/strict";

import {
  exactMatch,
  suggestNeighbors,
  placeNear,
  dominantDomain,
  resourceKindFor,
  captureBody,
  unwiredIds,
} from "./capture.js";

const TOPICS = [
  { id: "t1", name: "Vectors", lens: "Geometric Algebra", domain: "ga", body: "A vector has magnitude and direction. The dot product measures alignment." },
  { id: "t2", name: "The Dot Product", lens: "Geometric Algebra", domain: "ga", body: "a · b = |a||b|cosθ — projection of one vector onto another." },
  { id: "t3", name: "Triangles & Trig Ratios", lens: "Mathematics", domain: "math", body: "sine, cosine and tangent relate angles to side ratios in a right triangle." },
  { id: "t4", name: "Rhythm", lens: "Music", domain: "music", body: "beats, meter and tempo — the time structure of music." },
];

test("exactMatch: normalised name equality, else null", () => {
  assert.equal(exactMatch("vectors", TOPICS)?.id, "t1");
  assert.equal(exactMatch("  The Dot Product  ", TOPICS)?.id, "t2");
  assert.equal(exactMatch("Law of Cosines", TOPICS), null);
  assert.equal(exactMatch("", TOPICS), null);
  assert.equal(exactMatch("Vectors", null), null);
});

test("suggestNeighbors is OR-semantic: a note wires a name-disjoint topic", () => {
  // "Law of Cosines" shares NO word with any topic name — with only the name,
  // nothing matches by name but "cosines" hits the trig body.
  const nameOnly = suggestNeighbors({ name: "Law of Cosines" }, TOPICS);
  assert.deepEqual(nameOnly.map((n) => n.id), ["t3"]); // cosine in the trig body

  // The note "derive from the dot product of two vectors" pulls in Vectors +
  // Dot Product, ranked above the weaker trig body hit.
  const withNote = suggestNeighbors(
    { name: "Law of Cosines", note: "derive it from the dot product of two vectors" },
    TOPICS,
  );
  const ids = withNote.map((n) => n.id);
  assert.ok(ids.includes("t1") && ids.includes("t2") && ids.includes("t3"));
  assert.ok(ids.indexOf("t2") < ids.indexOf("t3"), "name-hit topics outrank body-only");
  assert.ok(!ids.includes("t4"), "unrelated Music topic stays out");
});

test("suggestNeighbors: name hit (×3) beats body hit (×1); self + junk excluded", () => {
  const res = suggestNeighbors({ name: "vector spaces" }, TOPICS);
  assert.equal(res[0].id, "t1"); // "Vectors" name hit
  // capturing an exact existing name excludes that topic from its own neighbours
  assert.ok(!suggestNeighbors({ name: "Vectors" }, TOPICS).some((n) => n.id === "t1"));
  assert.deepEqual(suggestNeighbors({ name: "" }, TOPICS), []);
  assert.deepEqual(suggestNeighbors({ name: "trig" }, null), []);
  // carries id/name/lens/domain through for the caller
  const one = suggestNeighbors({ name: "trig" }, TOPICS)[0];
  assert.deepEqual(Object.keys(one).sort(), ["domain", "id", "lens", "name", "score"]);
});

test("placeNear: centroid of neighbours + deterministic sub-0.06 nudge", () => {
  const near = placeNear([{ e1: 0, e2: 0, e3: 0 }, { e1: 1, e2: 1, e3: 1 }], "Law of Cosines");
  // centroid is (0.5,0.5,0.5); nudge keeps each axis within 0.06 of it
  for (const k of ["e1", "e2", "e3"]) assert.ok(Math.abs(near[k] - 0.5) <= 0.06, k);
  // deterministic: same name+neighbours → identical placement (resumable)
  const again = placeNear([{ e1: 0, e2: 0, e3: 0 }, { e1: 1, e2: 1, e3: 1 }], "Law of Cosines");
  assert.deepEqual(near, again);
  // a different name nudges differently
  const other = placeNear([{ e1: 0, e2: 0, e3: 0 }, { e1: 1, e2: 1, e3: 1 }], "Heron's Formula");
  assert.notDeepEqual(near, other);
});

test("placeNear: no neighbours → the domain fallback anchor; junk positions ignored", () => {
  assert.deepEqual(placeNear([], "x", { e1: 0.8, e2: -0.2, e3: 0.1 }), { e1: 0.8, e2: -0.2, e3: 0.1 });
  assert.deepEqual(placeNear(null, "x"), { e1: 0, e2: 0, e3: 0 });
  // a NaN-laced neighbour is dropped, not propagated
  const p = placeNear([{ e1: 1, e2: 1, e3: 1 }, { e1: NaN, e2: 0, e3: 0 }], "x");
  assert.ok([p.e1, p.e2, p.e3].every(Number.isFinite));
});

test("dominantDomain: highest combined neighbour score wins; none → null", () => {
  const neighbors = [
    { domain: "ga", score: 6 },
    { domain: "ga", score: 4 },
    { domain: "math", score: 9 },
  ];
  assert.equal(dominantDomain(neighbors), "ga"); // 10 > 9
  assert.equal(dominantDomain([{ domain: "math", score: 9 }]), "math");
  assert.equal(dominantDomain([]), null);
  assert.equal(dominantDomain(null), null);
});

test("resourceKindFor: video hosts vs generic links vs non-links", () => {
  assert.equal(resourceKindFor("https://www.youtube.com/watch?v=abc"), "Video");
  assert.equal(resourceKindFor("https://youtu.be/abc"), "Video");
  assert.equal(resourceKindFor("https://en.wikipedia.org/wiki/Law_of_cosines"), "Article");
  assert.equal(resourceKindFor("not a url"), null);
  assert.equal(resourceKindFor(""), null);
});

test("captureBody: H1 + note, else honest stub", () => {
  assert.equal(
    captureBody({ name: "Law of Cosines", note: "c² = a² + b² − 2ab·cosθ" }),
    "# Law of Cosines\n\nc² = a² + b² − 2ab·cosθ",
  );
  assert.match(captureBody({ name: "Trig" }), /^# Trig\n\n_Captured to study/);
  assert.match(captureBody({}), /^# Untitled topic/);
});

test("unwiredIds: captured ids with zero bridges; auto-clears once wired", () => {
  const stored = ["a", "b", "c"];
  const bridges = [{ from_id: "x", to_id: "b" }]; // b gained a connection
  assert.deepEqual(unwiredIds(stored, bridges), ["a", "c"]);
  assert.deepEqual(unwiredIds(stored, []), ["a", "b", "c"]);
  assert.deepEqual(unwiredIds([], bridges), []);
  assert.deepEqual(unwiredIds(null, null), []);
});
