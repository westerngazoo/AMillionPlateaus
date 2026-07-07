// rhizome.js — pure helpers for RHIZOME DRILL-DOWN (R-0044).
//
// The rhizome move: while reading a plateau, select a term you don't know and
// "grow" it into a NEW plateau — a durable, bridged, further-drillable node, not
// a throwaway dictionary popup. Deleuze & Guattari's rhizome made literal: any
// point connects to any other (the bridge), and you can deepen anywhere, without
// end (each child is itself a plateau you can select-and-grow from).
//
// This module is PURE — no DOM, no GA math, no network. It decides WHERE a child
// sits relative to its parent (a small deterministic offset so siblings fan out
// instead of stacking), the starter body when no model is connected, and the
// prompts the companion answers. The impure edges (add_plateau / add_bridge /
// sendTurn / selection UI) live in main.js.

// A term is worth growing if it's a short phrase, not a sentence or a stray char.
// Bounds keep a fat paragraph-selection or an empty click from spawning junk.
export function isGrowable(term) {
  const t = String(term ?? "").trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/[.!?]\s/.test(t)) return false; // spans a sentence break — not a term
  return /\w/.test(t);
}

// A stable 32-bit hash of the term (FNV-1a). Deterministic so the SAME term grown
// from the SAME parent lands in the SAME spot — idempotent placement, no RNG (the
// codebase forbids Math.random in pure code paths for the same reason tests need).
export function hashTerm(term) {
  let h = 0x811c9dc5;
  const s = String(term ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Where a grown child sits: the parent's position nudged by a small offset on a
// term-derived angle, on the same two axes that carry the parent's largest
// components (so the child stays in the parent's island / domain plane, near it,
// but not on top of it). Returns a Grade-1 {e1,e2,e3} — the Rust constructor still
// asserts grade-1, this just keeps it sensible. RADIUS is small: a child is an
// elaboration of its parent, not a journey away.
const CHILD_RADIUS = 0.09;
export function childPosition(parent = {}, term = "") {
  const e1 = Number(parent.e1 ?? 0);
  const e2 = Number(parent.e2 ?? 0);
  const e3 = Number(parent.e3 ?? 0);
  const angle = (hashTerm(term) % 360) * (Math.PI / 180);
  // Nudge in the e1–e2 plane primarily (the two most common carriers), with a
  // tiny e3 wobble derived from a second hash bit so pure-plane parents still fan
  // their children in 3D rather than a flat ring.
  const wob = ((hashTerm(term) >> 9) % 100) / 100 - 0.5; // -0.5..0.5
  return {
    e1: e1 + Math.cos(angle) * CHILD_RADIUS,
    e2: e2 + Math.sin(angle) * CHILD_RADIUS,
    e3: e3 + wob * CHILD_RADIUS * 0.5,
  };
}

// The offline starter body: an honest stub, NOT a fake definition. It names the
// lineage (grown from the parent) and invites the learner to fill it — the same
// plateau body a model would flesh out, minus the model. Markdown (R-0020).
export function starterBody(term, parentName = "") {
  const from = parentName ? ` while reading **${parentName}**` : "";
  return (
    `# ${term}\n\n` +
    `A concept you grew${from} — a new plateau to explore as deep as you like.\n\n` +
    `_No definition yet. Connect a model (Model setup) to have your companion draft one, ` +
    `or write your own notes, pin resources, and grow further terms from here._`
  );
}

// The prompt the companion answers to DRAFT a child plateau's body: a short,
// self-contained Markdown mini-article grounded in how the term is used in the
// parent. Kept tight so it reads as a plateau, not an essay.
export function draftPlateauPrompt(term, parentName = "") {
  const ctx = parentName ? ` as it is used in "${parentName}"` : "";
  return (
    `Write a short Markdown explainer for the concept "${term}"${ctx}. ` +
    `Include: a one-line definition, the core idea in 2–4 sentences, one concrete ` +
    `example, and why it matters here. Use $…$ for any math. Do NOT include a title ` +
    `heading — start with the definition. Keep it under ~150 words.`
  );
}

// The prompt for an INLINE answer (define / example) that does NOT create a
// plateau — the quick lookup, shown in the companion, when the learner just wants
// a gloss. `mode` is "define" or "example".
export function inlinePrompt(term, parentName = "", mode = "define") {
  const ctx = parentName ? ` in the context of "${parentName}"` : "";
  return mode === "example"
    ? `Give one concrete, concrete-as-possible example of "${term}"${ctx}. Two or three sentences.`
    : `Briefly define "${term}"${ctx} in 2–3 sentences. Plain language; use $…$ for any math.`;
}

// Slice 4: Add resource / dedup
export function existingChild(parent, term, plateaus = [], bridges = []) {
  const has = new Set(plateaus.map((p) => p.id));
  for (const b of bridges) {
    if (b.from === parent.id && b.concept === term && has.has(b.to)) return b.to;
  }
  return null;
}

