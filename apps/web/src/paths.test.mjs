import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPath,
  pathDomains,
  pathRows,
  nextPathStep,
  pathProgress,
  publishedPaths,
  PATH_KIND,
} from "./paths.js";

test("buildPath validates title and dedupes steps", () => {
  assert.throws(() => buildPath({ title: "  ", steps: [] }));
  const p = buildPath({ title: "My path", goal: "Learn", steps: ["a", "b", "a"] });
  assert.equal(p.title, "My path");
  assert.deepEqual(p.steps, ["a", "b"]);
});

test("pathDomains collects unique domains in step order", () => {
  const plateaus = [
    { id: "p1", domain_id: "d1" },
    { id: "p2", domain_id: "d2" },
    { id: "p3", domain_id: "d1" },
  ];
  assert.deepEqual(pathDomains(plateaus, ["p1", "p2", "p3"]), ["d1", "d2"]);
});

test("nextPathStep returns first unmastered step", () => {
  const mastered = new Set(["a"]);
  assert.equal(nextPathStep(["a", "b", "c"], mastered), "b");
  assert.equal(nextPathStep(["a", "b"], new Set(["a", "b"])), null);
});

test("pathProgress counts mastered steps", () => {
  assert.deepEqual(pathProgress(["a", "b", "c"], new Set(["a", "c"])), { done: 2, total: 3 });
});

test("publishedPaths keeps latest per signer and sorts", () => {
  const events = [
    {
      kind: PATH_KIND,
      pubkey: "bb".repeat(32),
      created_at: 1,
      content: JSON.stringify({ id: "x", title: "Old", goal: "", steps: ["a"], domains: [] }),
    },
    {
      kind: PATH_KIND,
      pubkey: "bb".repeat(32),
      created_at: 2,
      content: JSON.stringify({ id: "x", title: "New", goal: "g", steps: ["a", "b"], domains: ["d"] }),
    },
    {
      kind: PATH_KIND,
      pubkey: "aa".repeat(32),
      created_at: 1,
      content: JSON.stringify({ id: "y", title: "A", goal: "", steps: ["c"], domains: [] }),
    },
    { kind: 999, pubkey: "cc".repeat(32), created_at: 1, content: "{}" },
    { kind: PATH_KIND, pubkey: "dd".repeat(32), created_at: 1, content: "not json" },
  ];
  const out = publishedPaths(events);
  assert.equal(out.length, 2);
  assert.equal(out[0].pubkey, "aa".repeat(32));
  assert.equal(out[1].title, "New");
  assert.deepEqual(out[1].steps, ["a", "b"]);
});

test("pathRows numbers steps 1-based and marks done from the set (R-0065)", () => {
  const rows = pathRows(["a", "b", "c"], new Set(["a", "c"]));
  assert.deepEqual(rows, [
    { id: "a", n: 1, done: true },
    { id: "b", n: 2, done: false },
    { id: "c", n: 3, done: true },
  ]);
  // empty / junk → []
  assert.deepEqual(pathRows([], new Set()), []);
  assert.deepEqual(pathRows(null), []);
  // default doneSet → nothing done
  assert.deepEqual(pathRows(["x"]).map((r) => r.done), [false]);
});

// ── R-0099: grouping a long path into cuatrimestre sections ──────────────────
import { pathGroupLabel, groupPathRows, worthGrouping, sectionProgress } from "./paths.js";

test("pathGroupLabel reads the cuatrimestre marker, null for anything else", () => {
  assert.equal(pathGroupLabel("# Cálculo I\n*FIS-1906 · Cuatrimestre 2 · 9 créditos*"), "Cuatrimestre 2");
  assert.equal(pathGroupLabel("Cuatrimestre 10 later"), "Cuatrimestre 10");
  assert.equal(pathGroupLabel("no marker here"), null);
  assert.equal(pathGroupLabel(""), null);
  assert.equal(pathGroupLabel(null), null);
});

test("groupPathRows folds CONSECUTIVE rows sharing a label, preserving numbering", () => {
  const rows = pathRows(["a", "b", "c", "d", "e"]); // n = 1..5
  const label = (id) => ({ a: "Q1", b: "Q1", c: "Q2", d: "Q2", e: "Q2" }[id] ?? null);
  const secs = groupPathRows(rows, label);
  assert.deepEqual(secs.map((s) => [s.label, s.rows.map((r) => r.n)]), [
    ["Q1", [1, 2]],
    ["Q2", [3, 4, 5]],
  ]);
  // global step numbers stay continuous across the group boundary
  assert.equal(secs[1].rows[0].n, 3);
});

test("groupPathRows keeps unlabelled steps in their own null section, never reorders", () => {
  const rows = pathRows(["a", "x", "b"]);
  const label = (id) => ({ a: "Q1", b: "Q1" }[id] ?? null);
  const secs = groupPathRows(rows, label);
  // 'x' has no label and sits BETWEEN two Q1 steps — it must NOT be merged into Q1,
  // because merging would reorder the path. Three sections, order preserved.
  assert.deepEqual(secs.map((s) => s.label), ["Q1", null, "Q1"]);
});

test("worthGrouping needs 2+ distinct labels, else the path stays flat", () => {
  assert.equal(worthGrouping(groupPathRows(pathRows(["a", "b"]), () => "Q1")), false); // one label
  assert.equal(worthGrouping(groupPathRows(pathRows(["a", "b"]), () => null)), false); // no labels
  assert.equal(
    worthGrouping(groupPathRows(pathRows(["a", "b"]), (id) => (id === "a" ? "Q1" : "Q2"))),
    true,
  );
  assert.equal(worthGrouping(null), false);
});

test("sectionProgress counts done within a section", () => {
  const rows = pathRows(["a", "b", "c"], new Set(["a", "c"]));
  assert.deepEqual(sectionProgress({ rows }), { done: 2, total: 3 });
  assert.deepEqual(sectionProgress({}), { done: 0, total: 0 });
});

test("the real degree path folds into 10 cuatrimestre sections", async () => {
  const { UNIVERSITAM_PATH, UNIVERSITAM_PLATEAUS } = await import("./universitam-curriculum.js");
  const desc = new Map(UNIVERSITAM_PLATEAUS.map((p) => [p.id, p.description]));
  const rows = pathRows(UNIVERSITAM_PATH.steps);
  const secs = groupPathRows(rows, (id) => pathGroupLabel(desc.get(id)));
  assert.equal(worthGrouping(secs), true);
  assert.equal(secs.length, 10, "one section per cuatrimestre");
  assert.deepEqual(secs.map((s) => s.label), Array.from({ length: 10 }, (_, i) => `Cuatrimestre ${i + 1}`));
  assert.equal(secs.reduce((n, s) => n + s.rows.length, 0), 49, "every asignatura kept exactly once");
});
