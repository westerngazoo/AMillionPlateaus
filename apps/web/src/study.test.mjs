// study.test.mjs — node --test, no DOM. Proves the pure Study-view helpers
// (R-0023 AC5): resource ranking is best-first + deterministic + non-mutating,
// and the plateau grounding names the topic, caps the body, and lists resources
// best-first with kind/title/uri. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { rankResources, buildPlateauStudyContext, STUDY_ACTIONS } from "./study.js";

const res = (id, vote_count, over = {}) => ({
  id,
  plateau_id: "p",
  title: `R${id}`,
  kind: "Article",
  uri: `https://ex.com/${id}`,
  state: "Floating",
  vote_count,
  ...over,
});

test("rankResources orders by weighted votes desc, id tiebreak, without mutating", () => {
  const input = [res("b", 5), res("a", 5), res("c", 50), res("d", 0)];
  const ranked = rankResources(input);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["c", "a", "b", "d"], // 50 first; the 5-tie breaks a<b by id; 0 last
  );
  assert.deepEqual(
    input.map((r) => r.id),
    ["b", "a", "c", "d"],
    "input array is not mutated",
  );
});

test("rankResources handles empty / missing", () => {
  assert.deepEqual(rankResources(), []);
  assert.deepEqual(rankResources([]), []);
});

test("buildPlateauStudyContext names the plateau and lists resources best-first", () => {
  const ctx = buildPlateauStudyContext({
    plateau: { name: "Calculo", description: "The derivative and the integral." },
    resources: [res("a", 1), res("c", 99, { kind: "Video", title: "Khan", uri: "https://yt/x" })],
  });
  assert.match(ctx, /studying the plateau "Calculo"/);
  assert.match(ctx, /The derivative and the integral\./);
  // Best-first: the 99-vote Khan video before the 1-vote article.
  assert.ok(ctx.indexOf("Video: Khan (https://yt/x)") < ctx.indexOf("Article: Ra"));
  assert.match(ctx, /Help them learn THIS topic/);
});

test("buildPlateauStudyContext caps the body at 2000 chars (token safety)", () => {
  const huge = "x".repeat(5000);
  const ctx = buildPlateauStudyContext({ plateau: { name: "Big", description: huge } });
  const bodyLine = ctx.split("\n\n").find((s) => s.startsWith("Its notes:"));
  // "Its notes:\n" + at most 2000 body chars.
  assert.ok(bodyLine.length <= "Its notes:\n".length + 2000);
});

test("buildPlateauStudyContext marks crystallized resources as vouched", () => {
  const ctx = buildPlateauStudyContext({
    plateau: { name: "T", description: "" },
    resources: [res("a", 60, { state: "Crystallized" })],
  });
  assert.match(ctx, /\[vouched\]/);
});

test("buildPlateauStudyContext handles an empty plateau (no body, no resources)", () => {
  const ctx = buildPlateauStudyContext({ plateau: { name: "Empty", description: "" }, resources: [] });
  assert.match(ctx, /It has no notes yet\./);
  assert.match(ctx, /No resources pinned yet\./);
});

test("buildPlateauStudyContext is deterministic", () => {
  const args = { plateau: { name: "T", description: "body" }, resources: [res("a", 1), res("b", 2)] };
  assert.equal(buildPlateauStudyContext(args), buildPlateauStudyContext(args));
});

test("STUDY_ACTIONS are well-formed (label + non-empty prompt)", () => {
  assert.ok(STUDY_ACTIONS.length >= 3);
  for (const a of STUDY_ACTIONS) {
    assert.equal(typeof a.key, "string");
    assert.ok(a.label.length > 0);
    assert.ok(a.prompt.length > 0);
  }
});
