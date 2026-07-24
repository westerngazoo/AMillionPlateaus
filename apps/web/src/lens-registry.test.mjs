import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGISTRY_FILE, REGISTRY_V, buildIndexEntry, emptyIndex, upsertIndex,
  removeFromIndex, parseIndex, registryJson, indexFromPaths, describeEntry,
} from "./lens-registry.js";
import { buildLensBundle } from "./lens-bundle.js";

const D1 = "11111111-1111-1111-1111-111111111111";
const D2 = "22222222-2222-2222-2222-222222222222";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "aaaaaaaa-0000-4000-8000-000000000002";

const mk = (id, label, title) =>
  buildLensBundle(
    { id, label, canonical: { e1: 0.5, e2: 0.5, e3: 0 } },
    [
      { id: A, name: "One", description: "", domain_id: id, position: { e1: 0.5, e2: 0.4, e3: 0 } },
      { id: B, name: "Two", description: "", domain_id: id, position: { e1: 0.6, e2: 0.4, e3: 0 } },
    ],
    [{ id: "live", from: A, to: B, concept: "leads to" }],
    [{ id: "r", plateau_id: A, title: "Ref", kind: "Link", uri: "https://x" }],
    title ? { title } : {},
  );

test("an index entry is derived from the bundle, with the path to fetch", () => {
  const e = buildIndexEntry(mk(D1, "Physics", "University Physics"));
  assert.equal(e.id, D1);
  assert.equal(e.path, `lenses/${D1}.json`);
  assert.equal(e.label, "Physics");
  assert.equal(e.title, "University Physics");
  assert.deepEqual(e.counts, { plateaus: 2, bridges: 1, external_bridges: 0, resources: 1 });
  // provenance stays optional, exactly as in the bundle
  assert.equal("title" in buildIndexEntry(mk(D1, "Physics")), false);
  assert.throws(() => buildIndexEntry({}), /no domain\.id/);
});

test("upsert is keyed by id, ordered by label, and never mutates its input", () => {
  const i0 = emptyIndex();
  const i1 = upsertIndex(i0, buildIndexEntry(mk(D2, "Zeta")));
  const i2 = upsertIndex(i1, buildIndexEntry(mk(D1, "Alpha")));
  assert.equal(i0.lenses.length, 0, "input index untouched");
  assert.deepEqual(i2.lenses.map((x) => x.label), ["Alpha", "Zeta"]);
  // re-publishing the same lens REPLACES its row rather than duplicating it
  const i3 = upsertIndex(i2, buildIndexEntry(mk(D1, "Alpha renamed")));
  assert.equal(i3.lenses.length, 2);
  assert.equal(i3.lenses.find((x) => x.id === D1).label, "Alpha renamed");
  assert.equal(REGISTRY_FILE, "lenses/index.json");
  assert.equal(i3.v, REGISTRY_V);
});

test("removeFromIndex unpublishes just that lens", () => {
  let i = upsertIndex(emptyIndex(), buildIndexEntry(mk(D1, "A")));
  i = upsertIndex(i, buildIndexEntry(mk(D2, "B")));
  const gone = removeFromIndex(i, D1);
  assert.deepEqual(gone.lenses.map((x) => x.id), [D2]);
  assert.deepEqual(removeFromIndex(i, "nope").lenses.length, 2);
});

// Rows come from a file a STRANGER wrote, and `path` is fetched with the reader's
// token attached — so a hostile path must be dropped, not repaired.
test("parseIndex drops rows whose path escapes lenses/", () => {
  const hostile = JSON.stringify({
    v: 1,
    lenses: [
      { id: "ok", path: "lenses/ok.json", label: "Fine" },
      { id: "climb", path: "lenses/../../../etc/shadow", label: "Nope" },
      { id: "outside", path: "other/x.json", label: "Nope" },
      { id: "backslash", path: "lenses\\x.json", label: "Nope" },
    ],
  });
  const parsed = parseIndex(hostile);
  assert.deepEqual(parsed.lenses.map((x) => x.id), ["ok"]);
});

test("parseIndex is defensive: junk, dupes, missing fields, future versions", () => {
  assert.equal(parseIndex("not json"), null);
  assert.equal(parseIndex("{}"), null); // no lenses[]
  assert.equal(parseIndex(JSON.stringify({ v: REGISTRY_V + 1, lenses: [] })), null, "too new is refused");
  const messy = parseIndex(JSON.stringify({
    lenses: [
      null, {}, { id: "" },
      { id: "dup", path: "lenses/dup.json" },
      { id: "dup", path: "lenses/dup.json", label: "second" },
      { id: "nopath" }, // path is derived from the id
    ],
  }));
  assert.deepEqual(messy.lenses.map((x) => x.id), ["dup", "nopath"]);
  assert.equal(messy.lenses[0].label, "dup", "label defaults to the id");
  assert.equal(messy.lenses[1].path, "lenses/nopath.json", "path derived when absent");
  // counts always present and non-negative, whatever the file claimed
  const weird = parseIndex(JSON.stringify({ lenses: [{ id: "x", counts: { plateaus: -5, bridges: "nope" } }] }));
  assert.deepEqual(weird.lenses[0].counts, { plateaus: 0, bridges: 0, external_bridges: 0, resources: 0 });
});

test("registryJson round-trips to identical bytes", () => {
  const i = upsertIndex(emptyIndex(), buildIndexEntry(mk(D1, "Physics", "University Physics")));
  assert.equal(registryJson(parseIndex(registryJson(i))), registryJson(i));
  assert.equal(registryJson(null), registryJson(emptyIndex()));
});

// A repo published by plain R-0093 has no index; it must still be browsable.
test("indexFromPaths keeps an unindexed repo usable, excluding index.json itself", () => {
  const i = indexFromPaths([
    `lenses/${D1}.json`,
    "lenses/index.json",      // never list the index as a lens
    "lenses/../escape.json",  // dropped
    `lenses/${D1}.json`,      // dupe
  ]);
  assert.deepEqual(i.lenses.map((x) => x.id), [D1]);
  assert.equal(i.lenses[0].unindexed, true);
  assert.equal(i.lenses[0].path, `lenses/${D1}.json`);
});

test("describeEntry reads well, and is honest when counts are unknown", () => {
  const e = buildIndexEntry(mk(D1, "Physics", "University Physics"));
  assert.equal(describeEntry(e), "University Physics — 2 topics, 1 bridge, 1 resource");
  assert.match(describeEntry(indexFromPaths([`lenses/${D1}.json`]).lenses[0]), /counts unknown/);
  assert.equal(describeEntry({ id: "x", counts: { plateaus: 1, bridges: 0 } }), "x — 1 topic, 0 bridges");
  assert.match(describeEntry(null), /Untitled lens/);
});
