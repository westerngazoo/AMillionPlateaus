// capture.test.mjs — ⚡ Capture a topic: dedup, neighbour suggestion, placement,
// lens inference, resource kind, body, unwired inbox (R-0079).
import test from "node:test";
import assert from "node:assert/strict";

import {
  exactMatch,
  suggestNeighbors,
  rankLenses,
  fitVerdict,
  lensFitPrompt,
  lensShort,
  twinName,
  twinBody,
  twinPlan,
  placeNear,
  dominantDomain,
  resourceKindFor,
  captureBody,
  unwiredIds,
  titleFromNote,
} from "./capture.js";

test("titleFromNote (R-0092): first meaningful line, marks stripped, capped; blank → ''", () => {
  assert.equal(titleFromNote("Law of cosines\n\nc² = a²+b²-2ab·cosθ"), "Law of cosines");
  assert.equal(titleFromNote("\n\n  # **Rotors** are rotations  \nmore"), "Rotors are rotations");
  assert.equal(titleFromNote("- a bullet thought"), "a bullet thought");
  assert.equal(titleFromNote("![boox](data:image/png;base64,AAAA)\nActual title"), "Actual title");
  assert.equal(titleFromNote(""), "");
  assert.equal(titleFromNote("   \n\t\n"), "");
  const long = "x".repeat(80);
  assert.ok(titleFromNote(long).length <= 61 && titleFromNote(long).endsWith("…"));
});

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

// ── R-0103: which lens does this fit? ────────────────────────────────────────
// A capture-time set of scored neighbours spanning three geometry lenses, as
// suggestNeighbors would emit them.
const GA = "d-ga", EUC = "d-euclid", VEC = "d-vector";
const reflectionNeighbors = [
  { id: "1", name: "Reflections as versors", lens: "Geometric Algebra", domain: GA, score: 6 },
  { id: "2", name: "Rotors", lens: "Geometric Algebra", domain: GA, score: 3 },
  { id: "3", name: "Isometries", lens: "Euclidean Geometry", domain: EUC, score: 5 },
  { id: "4", name: "Vector projection", lens: "Vector Geometry", domain: VEC, score: 3 },
];

test("rankLenses aggregates score per lens and keeps the evidence", () => {
  const r = rankLenses(reflectionNeighbors);
  assert.equal(r[0].lens, "Geometric Algebra");
  assert.equal(r[0].score, 9); // 6 + 3
  assert.deepEqual(r[0].matches, ["Reflections as versors", "Rotors"]);
  assert.equal(r[1].lens, "Euclidean Geometry");
  assert.equal(r[1].score, 5);
  assert.equal(r.length, 3, "three distinct lenses");
});

test("fitVerdict → primary names the other lenses even when one leads", () => {
  // GA(9) leads; Euclidean(5) & Vector(2) are below spanRatio·9 but above the
  // touchRatio, so they're still surfaced — you learn it touches all three.
  const v = fitVerdict(rankLenses(reflectionNeighbors));
  assert.equal(v.kind, "primary");
  assert.match(v.text, /Mostly Geometric Algebra/);
  assert.match(v.text, /Euclidean Geometry/);
  assert.match(v.text, /Vector Geometry/);
});

test("fitVerdict → span when lenses are genuinely comparable", () => {
  const near = [
    { lens: "Geometric Algebra", domain: GA, score: 6, matches: ["Reflections as versors"] },
    { lens: "Euclidean Geometry", domain: EUC, score: 5, matches: ["Isometries"] },
    { lens: "Vector Geometry", domain: VEC, score: 4, matches: ["Projection"] },
  ];
  const v = fitVerdict(near);
  assert.equal(v.kind, "span");
  assert.deepEqual(v.lenses, ["Geometric Algebra", "Euclidean Geometry", "Vector Geometry"]);
  assert.match(v.text, /cross-lens/);
});

test("fitVerdict → single when one lens dominates", () => {
  const v = fitVerdict([
    { lens: "Geometric Algebra", domain: GA, score: 9, matches: ["Rotors"] },
    { lens: "Music", domain: "d-music", score: 1, matches: ["Timbre"] },
  ]);
  assert.equal(v.kind, "single");
  assert.deepEqual(v.lenses, ["Geometric Algebra"]);
});

test("fitVerdict → none points you at the model when the graph is silent", () => {
  const v = fitVerdict([]);
  assert.equal(v.kind, "none");
  assert.match(v.text, /ask your model/i);
});

test("lensFitPrompt lists your lenses, the nearby topics, and asks the real question", () => {
  const p = lensFitPrompt(
    { name: "Reflections", note: "how a mirror flips a vector" },
    ["Geometric Algebra", "Euclidean Geometry", "Vector Geometry"],
    [{ lens: "Geometric Algebra", topics: ["Rotors", "Versors"] }],
  );
  assert.match(p, /"Reflections"/);
  assert.match(p, /how a mirror flips a vector/);
  assert.match(p, /- Geometric Algebra/);
  assert.match(p, /Rotors, Versors/);
  assert.match(p, /prerequisite of|consequence|sibling/);
});

test("lensFitPrompt is robust to empty inputs", () => {
  const p = lensFitPrompt({}, [], []);
  assert.match(p, /this topic/);
  assert.ok(p.length > 20);
});

// ── R-0104: a cross-lens topic becomes linked twins ──────────────────────────
test("lensShort keeps the seeded acronyms, else the first word", () => {
  assert.equal(lensShort("Geometric Algebra"), "GA");
  assert.equal(lensShort("Synthetic Infinitesimal Analysis"), "SIA");
  assert.equal(lensShort("Euclidean Geometry"), "Euclidean");
  assert.equal(lensShort("Vector Geometry"), "Vector");
  assert.equal(lensShort(""), "Other");
});

test("twinName follows the seeded 'GA view: …' convention", () => {
  assert.equal(twinName("Reflections", "Geometric Algebra"), "GA view: Reflections");
  assert.equal(twinName("Reflections", "Euclidean Geometry"), "Euclidean view: Reflections");
});

test("twinBody names the sibling, the lens, and obeys the markdown subset", () => {
  const b = twinBody("Reflections", "Euclidean Geometry", "Geometric Algebra");
  const lines = b.split("\n");
  assert.match(lines[0], /^# Euclidean view: Reflections$/);
  assert.equal(lines[1], "", "heading must be its own block");
  assert.match(b, /same idea as \*\*Reflections\*\*/);
  assert.match(b, /Geometric Algebra/, "says what the primary lens was");
  assert.ok(!/^>/m.test(b), "no blockquote — markdown.js renders it literally");
});

test("twinPlan: one twin per other lens, primary and dupes skipped", () => {
  const plan = twinPlan(
    { name: "Reflections", primaryDomain: "ga", primaryLens: "Geometric Algebra" },
    [
      { lens: "Geometric Algebra", domain: "ga" }, // the primary — skipped
      { lens: "Euclidean Geometry", domain: "euc" },
      { lens: "Vector Geometry", domain: "vec" },
      { lens: "Euclidean Geometry", domain: "euc" }, // dupe — skipped
      { lens: "Nameless", domain: null }, // no domain — skipped
    ],
  );
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map((t) => t.name), [
    "Euclidean view: Reflections",
    "Vector view: Reflections",
  ]);
  assert.deepEqual(plan.map((t) => t.domain), ["euc", "vec"]);
  assert.match(plan[0].body, /^# Euclidean view: Reflections/);
});

test("twinPlan: no name or no other lenses → nothing to mint", () => {
  assert.deepEqual(twinPlan({ name: "", primaryDomain: "ga" }, [{ lens: "X", domain: "x" }]), []);
  assert.deepEqual(twinPlan({ name: "Reflections", primaryDomain: "ga" }, []), []);
  assert.deepEqual(twinPlan({}, null), []);
});

test("twinPlan never mints a twin in the primary's OWN domain (regression)", () => {
  // The bug this guards: the fit verdict led with Physics, so twins were planned
  // for Mathematics + SIA — but the plateau actually landed in Mathematics (the
  // persona fallback). Re-planning against the RESOLVED home must drop the
  // Mathematics twin instead of minting "Mathematics view: X" inside Mathematics.
  const plan = twinPlan(
    { name: "Integration", primaryDomain: "math", primaryLens: "Mathematics" },
    [
      { lens: "Synthetic Infinitesimal Analysis", domain: "sia" },
      { lens: "Mathematics", domain: "math" }, // === the resolved home → dropped
    ],
  );
  assert.deepEqual(plan.map((t) => t.name), ["SIA view: Integration"]);
  assert.ok(!plan.some((t) => t.domain === "math"), "no twin may share the primary's domain");
});
