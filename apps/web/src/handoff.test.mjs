// handoff.test.mjs — node --test, pure (R-0056).
import test from "node:test";
import assert from "node:assert/strict";
import { HANDOFF_TARGETS, handoffPrompt, NOTEBOOKLM_PACK, notebookLmPack } from "./handoff.js";

test("targets include NotebookLM and Gemini, each an https URL", () => {
  const ids = HANDOFF_TARGETS.map((t) => t.id);
  assert.ok(ids.includes("notebooklm"));
  assert.ok(ids.includes("gemini"));
  for (const t of HANDOFF_TARGETS) {
    assert.match(t.url, /^https:\/\//, `${t.id} is https`);
    assert.ok(t.label && t.note, `${t.id} has a label + note`);
  }
});

test("handoffPrompt grounds in the topic name and domain", () => {
  const p = handoffPrompt({ name: "Momentum", domainLabel: "Physics" });
  assert.match(p, /"Momentum"/);
  assert.match(p, /in Physics/);
  assert.match(p, /test myself/i);
});

test("handoffPrompt folds in notes and bridged neighbors", () => {
  const p = handoffPrompt({
    name: "Force",
    notes: "F = ma. Newton's second law.",
    neighbors: [{ name: "Momentum", concept: "impulse" }, { name: "Energy" }],
  });
  assert.match(p, /F = ma/);
  assert.match(p, /Momentum — connected by "impulse"/);
  assert.match(p, /- Energy$/m); // neighbor with no concept still listed
});

test("handoffPrompt caps long notes so the prompt stays pasteable", () => {
  const p = handoffPrompt({ name: "X", notes: "z".repeat(5000) });
  const run = p.match(/z+/)[0];
  assert.ok(run.length <= 1200, `notes capped (got ${run.length})`);
});

test("handoffPrompt is pure/deterministic and safe with no args", () => {
  assert.equal(handoffPrompt({ name: "A" }), handoffPrompt({ name: "A" }));
  assert.doesNotThrow(() => handoffPrompt());
  assert.match(handoffPrompt(), /this topic/);
});

// ── The owner's NotebookLM pack (R-0056) ────────────────────────────────────

test("the pack is the owner's full 9-step strategy + 2 extras", () => {
  assert.equal(NOTEBOOKLM_PACK.length, 11);
  const keys = NOTEBOOKLM_PACK.map((s) => s.key);
  for (const k of ["modelos", "desacuerdos", "comprension", "evaluacion", "conexiones", "vacios", "informe", "slides", "podcast", "aplicacion", "feynman"])
    assert.ok(keys.includes(k), `pack has ${k}`);
  for (const s of NOTEBOOKLM_PACK) assert.equal(typeof s.prompt(", "), "string");
});

test("pack steps substitute the topic + domain (generalized off finance/Spain)", () => {
  const doc = notebookLmPack("Group Theory", "Mathematics");
  assert.match(doc, /Group Theory/);
  assert.match(doc, /Mathematics/);
  // the original finance/Spain specifics must NOT leak into a generic topic
  assert.doesNotMatch(doc, /finanzas|España|CNMV|Morgan/i);
});

test("notebookLmPack is one pasteable doc, ordered, with a how-to header", () => {
  const doc = notebookLmPack("Momentum", "Physics");
  assert.match(doc, /^# Pack de estudio NotebookLM — Momentum · Physics/);
  assert.match(doc, /añade tus fuentes/i); // the how-to
  // steps appear in order
  assert.ok(doc.indexOf("Modelos mentales") < doc.indexOf("Desacuerdos"));
  assert.ok(doc.indexOf("Informe ejecutivo") < doc.indexOf("Feynman"));
  assert.equal(notebookLmPack("X"), notebookLmPack("X")); // deterministic
});

test("notebookLmPack is safe with no domain and no args", () => {
  assert.doesNotThrow(() => notebookLmPack());
  assert.match(notebookLmPack("Solo"), /Solo/);
  assert.doesNotMatch(notebookLmPack("Solo"), /· \n/); // no dangling domain separator
});
