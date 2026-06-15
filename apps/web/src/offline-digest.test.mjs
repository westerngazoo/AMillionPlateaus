import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plainText,
  sentences,
  headings,
  keyTerms,
  topSentences,
  offlineDigest,
} from "./offline-digest.js";

const HEADER_PREFIX = "Offline digest (no model connected";

test("plainText strips markdown but keeps $…$ and inline-code text verbatim", () => {
  const md = "# Title\n\n- a *bold* point with `code` and [link](http://x).\n\nEuler: $e^{i\\pi}$ holds.";
  const out = plainText(md);
  assert.ok(!out.includes("#"), "heading hashes gone");
  assert.ok(!out.includes("*"), "emphasis markers gone");
  assert.ok(out.includes("link") && !out.includes("http://x"), "link → text");
  assert.ok(out.includes("code"), "inline-code text kept");
  assert.ok(out.includes("$e^{i\\pi}$"), "inline math passes through verbatim");
});

test("sentences does not split decimals or $…$ mid-token; whole verbatim sentences", () => {
  const s = sentences("Calc is great. The slope is 1.5 at x. Consider $a.b$ here.");
  assert.equal(s.length, 3);
  assert.ok(
    s.some((x) => x.includes("1.5 at x")),
    "1.5 stayed in one sentence",
  );
  assert.ok(
    s.some((x) => x.includes("$a.b$ here")),
    "$a.b$ not split on its dot",
  );
});

test("headings returns titles in document order", () => {
  assert.deepEqual(headings("# A\n## B\nbody text\n### C\n"), ["A", "B", "C"]);
});

test("keyTerms is frequency-ranked with a deterministic first-seen tiebreak", () => {
  // alpha(2) beta(2) gamma(1); alpha seen before beta → alpha precedes beta.
  assert.deepEqual(keyTerms("alpha beta alpha beta gamma", 3), ["alpha", "beta", "gamma"]);
  // stop words and <3-char tokens excluded
  assert.ok(!keyTerms("the cat is on a mat", 6).includes("the"));
});

test("topSentences selects salient sentences and returns them in original order, capped", () => {
  const body =
    "Derivatives measure change. The weather is nice today. A derivative is the slope of a function. " +
    "Cats are fuzzy. Derivatives and slopes underpin calculus.";
  const top = topSentences(body, 3);
  assert.equal(top.length, 3);
  // every returned sentence is a verbatim sentence of the body (extractive)
  const all = sentences(plainText(body));
  for (const s of top) assert.ok(all.includes(s), "verbatim sentence");
  // original order preserved: indices ascending
  const idx = top.map((s) => all.indexOf(s));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

const RES = [
  { id: "a", title: "Intro video", kind: "Video", uri: "http://v", state: "Marker", vote_count: 1 },
  { id: "b", title: "Key paper", kind: "Paper", uri: "http://p", state: "Crystallized", vote_count: 9 },
  { id: "c", title: "A note", kind: "Note", uri: "", state: "Marker", vote_count: 4 },
];

test("offlineDigest 'first' ranks by stones, marks [vouched], prefixes the header", () => {
  const out = offlineDigest({ action: "first", plateau: { description: "x" }, resources: RES });
  assert.ok(out.startsWith(HEADER_PREFIX), "offline header");
  // best-first: Key paper (9) before A note (4) before Intro video (1)
  assert.ok(out.indexOf("Key paper") < out.indexOf("A note"));
  assert.ok(out.indexOf("A note") < out.indexOf("Intro video"));
  assert.ok(/Key paper.*\[vouched\]/.test(out), "crystallized → [vouched]");
  assert.ok(!/Intro video.*\[vouched\]/.test(out), "non-crystallized → no [vouched]");
});

test("offlineDigest 'first' suggests a kind when no resources are pinned", () => {
  const out = offlineDigest({ action: "first", plateau: { description: "x" }, resources: [] });
  assert.ok(/Article or Video/.test(out));
});

test("offlineDigest 'quiz' asks questions that only interpolate body-derived terms", () => {
  const body = "Manifolds generalize surfaces. A manifold is locally Euclidean. Charts cover a manifold.";
  const out = offlineDigest({ action: "quiz", plateau: { description: body }, resources: [] });
  assert.ok(out.startsWith(HEADER_PREFIX));
  assert.ok(out.toLowerCase().includes("manifold"), "a body-derived key term appears");
  // the only non-body text is the fixed scaffolding
  assert.ok(/Can you explain|What is the key idea behind/.test(out));
});

test("empty notes are handled honestly per action (never fabricates)", () => {
  const empty = { description: "" };
  for (const action of ["summary", "model", "quiz"]) {
    const out = offlineDigest({ action, plateau: empty, resources: [] });
    assert.ok(/notes here are thin/.test(out), `${action} → thin-notes line`);
  }
});

test("offlineDigest dispatches the four keys distinctly and is deterministic", () => {
  const plateau = { description: "# Shape\n\nA derivative is a slope. Integrals sum area. Limits anchor both." };
  const args = (action) => ({ action, plateau, resources: RES });
  const outs = ["summary", "model", "first", "quiz"].map((a) => offlineDigest(args(a)));
  assert.equal(new Set(outs).size, 4, "four distinct answers");
  for (const o of outs) assert.ok(o.startsWith(HEADER_PREFIX));
  // deterministic: same input → byte-identical
  assert.equal(offlineDigest(args("summary")), offlineDigest(args("summary")));
  // unknown action falls back to summary (defensive)
  assert.equal(offlineDigest(args("bogus")), offlineDigest(args("summary")));
});
