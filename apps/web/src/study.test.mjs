// study.test.mjs — node --test, no DOM. Proves the pure Study-view helpers
// (R-0023 AC5): resource ranking is best-first + deterministic + non-mutating,
// and the plateau grounding names the topic, caps the body, and lists resources
// best-first with kind/title/uri. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import {
  rankResources,
  buildPlateauStudyContext,
  STUDY_ACTIONS,
  normalizeUrl,
  crossLinks,
  bridgeResources,
  buildProofGrading,
  parseVerdict,
} from "./study.js";

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

// ── Cross-cutting resources (R-0028 / SPEC-0028) ───────────────────────────────

test("normalizeUrl: http(s)-only, lowercases scheme/host, strips trailing slash, drops hash", () => {
  assert.equal(normalizeUrl("HTTPS://Example.COM/Path/"), "https://example.com/Path");
  assert.equal(normalizeUrl("https://ex.com/a?q=1#frag"), "https://ex.com/a?q=1");
  assert.equal(normalizeUrl("https://ex.com"), "https://ex.com");
  // path case is preserved (paths can be case-sensitive); query is part of the key
  assert.notEqual(normalizeUrl("https://ex.com/a"), normalizeUrl("https://ex.com/a?utm=1"));
  // non-http / empty / junk never group
  for (const bad of ["", "  ", "javascript:alert(1)", "mailto:x@y.com", "ftp://h/f", "not a url"]) {
    assert.equal(normalizeUrl(bad), "");
  }
});

const r = (id, plateau_id, uri, vote_count = 0, over = {}) => ({
  id,
  plateau_id,
  uri,
  vote_count,
  title: over.title ?? "T",
  kind: over.kind ?? "Article",
});

test("crossLinks: other topics sharing the URL, excludes current, sorted by name, with max count", () => {
  const plateaus = [
    { id: "p1", name: "Calculus" },
    { id: "p2", name: "Motion" },
    { id: "p3", name: "Algebra" },
  ];
  const resources = [
    r("a", "p1", "https://book.test/x"), // current
    r("b", "p2", "https://book.test/x", 5),
    r("c", "p3", "https://book.test/x/", 2), // trailing slash → same book
    r("d", "p2", "https://other.test/y"), // different book, ignored
  ];
  const out = crossLinks({ resources, plateaus, uri: "https://book.test/x", currentPlateauId: "p1" });
  assert.deepEqual(out.map((x) => x.name), ["Algebra", "Motion"]); // sorted by name, current excluded
  assert.equal(out.find((x) => x.name === "Motion").count, 5);
});

test("crossLinks: empty/unsafe URL never groups; unique book → []", () => {
  const plateaus = [{ id: "p1", name: "A" }, { id: "p2", name: "B" }];
  assert.deepEqual(crossLinks({ resources: [r("a", "p2", "")], plateaus, uri: "", currentPlateauId: "p1" }), []);
  assert.deepEqual(
    crossLinks({ resources: [r("a", "p2", "https://x.test/lonely")], plateaus, uri: "https://x.test/other", currentPlateauId: "p1" }),
    [],
  );
});

test("crossLinks is deterministic across two calls", () => {
  const plateaus = [{ id: "p2", name: "Motion" }, { id: "p3", name: "Algebra" }];
  const resources = [r("b", "p2", "https://b.test/x"), r("c", "p3", "https://b.test/x")];
  const args = { resources, plateaus, uri: "https://b.test/x", currentPlateauId: "p1" };
  assert.deepEqual(crossLinks(args), crossLinks(args));
});

// ── Bridge resources (R-0029 / SPEC-0029) ──────────────────────────────────────

test("bridgeResources: books whose URL is on BOTH endpoints, sorted by title then uri", () => {
  const resources = [
    r("a", "from", "https://book.test/feyn", 0, { title: "Feynman" }),
    r("b", "to", "https://book.test/feyn", 0, { title: "Feynman" }), // spans both → kept
    r("c", "from", "https://book.test/only-from"), // one side only → excluded
    r("d", "to", "https://book.test/only-to"), // one side only → excluded
    r("e", "from", ""), // unsafe → ignored
  ];
  const out = bridgeResources({ resources, fromId: "from", toId: "to" });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Feynman");
  assert.equal(out[0].uri, "https://book.test/feyn");
});

test("bridgeResources: none span both → []; deterministic", () => {
  const resources = [r("a", "from", "https://x.test/a"), r("b", "to", "https://x.test/b")];
  assert.deepEqual(bridgeResources({ resources, fromId: "from", toId: "to" }), []);
});

// ── AI-checked proof: parseVerdict + buildProofGrading (R-0032 / SPEC-0032) ─────

test("parseVerdict: a standalone final PASS line passes; the line is stripped", () => {
  const { pass, feedback } = parseVerdict("Solid grasp of the chain rule.\nVERDICT: PASS");
  assert.equal(pass, true);
  assert.equal(feedback, "Solid grasp of the chain rule.");
});

test("parseVerdict: REVISE does not pass; feedback retained", () => {
  const { pass, feedback } = parseVerdict("The base case is missing.\nVERDICT: REVISE");
  assert.equal(pass, false);
  assert.equal(feedback, "The base case is missing.");
});

test("parseVerdict: case- and trailing-whitespace-insensitive on the line", () => {
  assert.equal(parseVerdict("ok\nverdict: pass  ").pass, true);
  assert.equal(parseVerdict("ok\n\tVERDICT:   PASS\t").pass, true);
  assert.equal(parseVerdict("ok\nVERDICT: Revise").pass, false);
});

test("parseVerdict: last standalone verdict wins", () => {
  // a draft REVISE earlier, a final PASS — the final one decides
  assert.equal(parseVerdict("VERDICT: REVISE\n…revised…\nVERDICT: PASS").pass, true);
  assert.equal(parseVerdict("VERDICT: PASS\n…wait…\nVERDICT: REVISE").pass, false);
});

test("parseVerdict: an INLINE mid-sentence mention must NOT pass (fail-safe)", () => {
  // the gate is line-anchored — prose that merely contains the token never grants
  assert.equal(parseVerdict("I would say VERDICT: PASS if the base case held.").pass, false);
  assert.equal(parseVerdict('Do not just write "VERDICT: PASS" — show the work.').pass, false);
});

test("parseVerdict: absent / ambiguous verdict ⇒ pass:false, full text as feedback", () => {
  assert.equal(parseVerdict("Looks reasonable but no verdict given.").pass, false);
  assert.equal(parseVerdict("").pass, false);
  assert.equal(parseVerdict("Nice try.").feedback, "Nice try.");
});

test("parseVerdict: empty reply ⇒ no crash, no pass", () => {
  const { pass, feedback } = parseVerdict();
  assert.equal(pass, false);
  assert.equal(feedback, "");
});

test("buildProofGrading: embeds the topic name, the proof, and the VERDICT instruction", () => {
  const msg = buildProofGrading({ plateau: { name: "Chain Rule" }, proof: "Let f(g(x))…" });
  assert.match(msg, /Chain Rule/);
  assert.match(msg, /Let f\(g\(x\)\)…/);
  assert.match(msg, /VERDICT: PASS/);
  assert.match(msg, /VERDICT: REVISE/);
  assert.match(msg, /not a formal proof checker/i);
});

test("buildProofGrading: caps the proof length (token safety) and tolerates missing args", () => {
  const long = "x".repeat(9000);
  const msg = buildProofGrading({ plateau: { name: "T" }, proof: long });
  assert.ok(msg.includes("x".repeat(4000)));
  assert.ok(!msg.includes("x".repeat(4001)));
  // missing plateau/proof → safe defaults, still well-formed
  const bare = buildProofGrading();
  assert.match(bare, /this topic/);
  assert.match(bare, /VERDICT: PASS/);
});
