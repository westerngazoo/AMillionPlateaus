// plateau.js — pure. Validates and normalises plateau authoring inputs.
// Returns { name, domain, e1, e2, e3, error: null } on success, or
// { error: string } on invalid input. No GA math here; that lives in Rust.
//
// SPEC-0011 (R-0011). Mirrors the authorPersona pattern from persona.js:
// pure factory, human-labelled axes, no raw blade indices ever returned to UI.

import { DOMAINS } from "./persona.js";

export const PLATEAU_NAME_FALLBACK = "Untitled Plateau";

// buildPlateau({ name, domain, e1, e2, e3 })
//
// Returns the normalised arg shape that wasm.add_plateau() accepts, tagged
// with error: null, or an error object { error: string } if input is invalid.
//
// Invalid cases (R-0011 AC5/AC6):
//   - unknown / missing domain id
//   - any non-finite coordinate (NaN, ±Infinity)
//   - all-zero direction (degenerate grade-1 vector, permanently unreachable)
export function buildPlateau({ name, domain, e1 = 0, e2 = 0, e3 = 0 } = {}) {
  if (!DOMAINS.find((d) => d.id === domain)) {
    return { error: "Unknown domain." };
  }

  const fE1 = Number(e1);
  const fE2 = Number(e2);
  const fE3 = Number(e3);

  if (!Number.isFinite(fE1) || !Number.isFinite(fE2) || !Number.isFinite(fE3)) {
    return { error: "Position contains a non-finite value." };
  }

  if (Math.hypot(fE1, fE2, fE3) === 0) {
    return { error: "Position must be non-zero — move at least one slider." };
  }

  return {
    name: (typeof name === "string" ? name.trim() : "") || PLATEAU_NAME_FALLBACK,
    domain,
    e1: fE1,
    e2: fE2,
    e3: fE3,
    error: null,
  };
}
