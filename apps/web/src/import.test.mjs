import test from "node:test";
import assert from "node:assert/strict";
import {
  graphIds,
  diffCount,
  importSummary,
  isEmptyImport,
  formatImportSummary,
} from "./import.js";

test("graphIds flattens DTO arrays to id lists, skipping id-less entries", () => {
  const ids = graphIds({
    plateaus: [{ id: "p1" }, { id: "p2" }, { name: "no id" }],
    bridges: [{ id: "b1" }],
    resources: [],
  });
  assert.deepEqual(ids, { plateaus: ["p1", "p2"], bridges: ["b1"], resources: [] });
});

test("graphIds tolerates a missing snapshot", () => {
  assert.deepEqual(graphIds(), { plateaus: [], bridges: [], resources: [] });
});

test("diffCount separates added from overlap and dedupes", () => {
  assert.deepEqual(diffCount(["a", "b"], ["b", "c", "d"]), { added: 2, overlap: 1, total: 3 });
  assert.deepEqual(diffCount([], ["x", "x", "y"]), { added: 2, overlap: 0, total: 2 }); // dedup
  assert.deepEqual(diffCount(["a"], ["a"]), { added: 0, overlap: 1, total: 1 });
});

test("importSummary counts per kind from before/after id snapshots", () => {
  const before = graphIds({ plateaus: [{ id: "p1" }], bridges: [], resources: [] });
  const after = graphIds({
    plateaus: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    bridges: [{ id: "b1" }],
    resources: [{ id: "r1" }, { id: "r2" }],
  });
  const s = importSummary(before, after);
  assert.deepEqual(s.plateaus, { added: 2, overlap: 1, total: 3 });
  assert.deepEqual(s.bridges, { added: 1, overlap: 0, total: 1 });
  assert.deepEqual(s.resources, { added: 2, overlap: 0, total: 2 });
});

test("isEmptyImport is true only when nothing new was added", () => {
  const same = importSummary(
    graphIds({ plateaus: [{ id: "p1" }] }),
    graphIds({ plateaus: [{ id: "p1" }] }),
  );
  assert.equal(isEmptyImport(same), true);
  const grew = importSummary(graphIds({}), graphIds({ bridges: [{ id: "b1" }] }));
  assert.equal(isEmptyImport(grew), false);
});

test("formatImportSummary reports additions and overlap", () => {
  const s = {
    plateaus: { added: 2, overlap: 1, total: 3 },
    bridges: { added: 1, overlap: 0, total: 1 },
    resources: { added: 0, overlap: 0, total: 0 },
  };
  const msg = formatImportSummary(s, "vault.bin");
  assert.match(msg, /vault\.bin/);
  assert.match(msg, /\+2 plateaus, \+1 bridges, \+0 resources/);
  assert.match(msg, /1 plateaus already present/);
});

test("formatImportSummary says nothing-new on an empty import", () => {
  const s = importSummary(graphIds({ plateaus: [{ id: "p1" }] }), graphIds({ plateaus: [{ id: "p1" }] }));
  assert.match(formatImportSummary(s, "dup.bin"), /nothing new/);
});
