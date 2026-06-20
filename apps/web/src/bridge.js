// bridge.js — pure. Validates and normalises bridge authoring inputs.
// Returns { from, to, concept, error: null } on success, or { error } on
// invalid input. No GA math here: the rotor is computed in Rust by
// Bridge::between (CLAUDE.md §1). Mirrors plateau.js (SPEC-0013 / R-0013).

export const CONCEPT_FALLBACK = "relates to";

// buildBridge({ from, to, concept })
//
// Returns the arg shape wasm.add_bridge() accepts, tagged with error: null, or
// { error: string } when invalid (R-0013 AC3/AC6):
//   - a missing endpoint (no from or no to)
//   - a self-loop (from === to)
// A blank/whitespace/non-string concept is normalised to CONCEPT_FALLBACK
// (low-friction, mirrors plateau.js's name fallback) — never an error.
export function buildBridge({ from, to, concept } = {}) {
  if (!from || !to) return { error: "Pick both plateaus to connect." };
  if (from === to) return { error: "A bridge needs two different plateaus." };
  return {
    from,
    to,
    concept: (typeof concept === "string" ? concept.trim() : "") || CONCEPT_FALLBACK,
    error: null,
  };
}
