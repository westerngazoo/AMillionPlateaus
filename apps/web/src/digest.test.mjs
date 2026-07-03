import test from "node:test";
import assert from "node:assert/strict";
import { subgraphDigest, digestFilename } from "./digest.js";

const plateau = {
  id: "p1",
  name: "Vectors",
  description: "A vector has magnitude and direction. It adds tip-to-tail.",
};
const neighbors = [
  { id: "p2", name: "Matrices", description: "A matrix is a grid of numbers. It transforms vectors." },
  { id: "p3", name: "Dot product", description: "" },
];
const bridges = [
  { from: "p1", to: "p2", concept: "linear maps" },
  { from: "p3", to: "p1", concept: "" },
];
const resources = [
  { id: "r1", kind: "Book", title: "Linear Algebra", uri: "https://ex.com/la", vote_count: 3, state: "Floating" },
  { id: "r2", kind: "Video", title: "Essence of LA", uri: "", vote_count: 9, state: "Crystallized" },
];

test("subgraphDigest renders title, body, and all sections", () => {
  const md = subgraphDigest({ plateau, neighbors, bridges, resources });
  assert.match(md, /^# Vectors/);
  assert.match(md, /magnitude and direction/);
  assert.match(md, /## Connections/);
  assert.match(md, /\*\*linear maps\*\* → Matrices/);
  assert.match(md, /## Resources/);
  assert.match(md, /## Neighboring topics/);
  assert.match(md, /\*\*Matrices\*\* — A matrix is a grid of numbers\./);
});

test("subgraphDigest ranks resources best-first with stone state", () => {
  const md = subgraphDigest({ plateau, resources });
  const first = md.indexOf("Essence of LA"); // vote 9 / crystallized
  const second = md.indexOf("Linear Algebra"); // vote 3
  assert.ok(first !== -1 && second !== -1 && first < second);
  assert.match(md, /◆ vouched/);
  assert.match(md, /● 3/);
});

test("subgraphDigest handles an empty subgraph gracefully", () => {
  const md = subgraphDigest({ plateau: { id: "x", name: "Lonely", description: "" } });
  assert.match(md, /^# Lonely/);
  assert.match(md, /_No notes yet\._/);
  assert.doesNotMatch(md, /## Connections/);
  assert.doesNotMatch(md, /## Resources/);
  assert.match(md, /1 topics, 0 connections, 0 resources/);
});

test("subgraphDigest is deterministic (sorted neighbors/connections)", () => {
  const a = subgraphDigest({ plateau, neighbors, bridges, resources });
  const b = subgraphDigest({ plateau, neighbors: [...neighbors].reverse(), bridges: [...bridges].reverse(), resources });
  assert.equal(a, b);
});

test("digestFilename slugs a topic name to a .md file", () => {
  assert.equal(digestFilename("Dot Product!"), "dot-product.md");
  assert.equal(digestFilename("  "), "topic.md");
});
