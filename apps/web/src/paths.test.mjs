import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPath,
  pathDomains,
  nextPathStep,
  pathProgress,
  publishedPaths,
  rankPublishedPaths,
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

test("rankPublishedPaths orders by author reach, best-first", () => {
  const paths = [
    { pubkey: "aa", title: "Low", steps: ["x"], domains: ["d1"] },
    { pubkey: "bb", title: "High", steps: ["x", "y"], domains: ["d1"] },
    { pubkey: "cc", title: "Mid", steps: ["x"], domains: ["d2"] },
  ];
  const reach = { aa: 0.2, bb: 9, cc: 3 };
  const ranked = rankPublishedPaths(paths, (p) => reach[p.pubkey]);
  assert.deepEqual(ranked.map((p) => p.title), ["High", "Mid", "Low"]);
});

test("rankPublishedPaths defaults to a stable pubkey order (reach 0)", () => {
  const paths = [
    { pubkey: "cc", title: "C", steps: [] },
    { pubkey: "aa", title: "A", steps: [] },
    { pubkey: "bb", title: "B", steps: [] },
  ];
  assert.deepEqual(rankPublishedPaths(paths).map((p) => p.pubkey), ["aa", "bb", "cc"]);
});

test("rankPublishedPaths breaks reach ties by step-count then pubkey, and is non-mutating", () => {
  const paths = [
    { pubkey: "bb", title: "Short", steps: ["a"], domains: [] },
    { pubkey: "aa", title: "Long", steps: ["a", "b", "c"], domains: [] },
    { pubkey: "cc", title: "Also short", steps: ["a"], domains: [] },
  ];
  const before = [...paths];
  const ranked = rankPublishedPaths(paths, () => 5); // all equal reach
  assert.deepEqual(ranked.map((p) => p.title), ["Long", "Short", "Also short"]);
  assert.deepEqual(paths, before); // input untouched
});
