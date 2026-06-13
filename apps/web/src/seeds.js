// seeds.js — pure data. The deterministic seed world (extracted from main.js,
// SPEC-0022): fixed-id plateaus and bridges that every tab upserts on load so
// independently-started replicas converge to ONE shared map (R-0004; see
// WasmCrdtDoc::seed_plateau). No logic lives here — main.js seeds these rows.
//
// Fixed-id namespaces, one prefix per cluster (keep them unique — seeds.test.mjs
// asserts it mechanically):
//   …a1–a4  Mathematics plateaus   …c1–c4  Music plateaus   …d1  Physics plateau
//   …b1–b9, …ba  bridges
//
// Domain regions (R-0006 AC3 + R-0022): Mathematics on the e1 axis, Music on e3,
// Physics on e2. Each trailhead row is on-axis (coord 1.0) so the canonical
// seed-mapping margin documented in persona.js (SEED=0.16 vs threshold 0.15)
// holds for its lens.

import { MATH_DOMAIN, MUSIC_DOMAIN, PHYSICS_DOMAIN } from "./persona.js";

export const SEED_PLATEAUS = [
  // Mathematics (e1 axis)
  { id: "00000000-0000-0000-0000-0000000000a1", name: "Arithmetic", domain: MATH_DOMAIN, e1: 1.0, e2: 0.05, e3: 0.05 },
  { id: "00000000-0000-0000-0000-0000000000a2", name: "Algebra", domain: MATH_DOMAIN, e1: 0.8, e2: 0.2, e3: 0.1 },
  { id: "00000000-0000-0000-0000-0000000000a3", name: "Geometry", domain: MATH_DOMAIN, e1: 0.7, e2: 0.1, e3: 0.35 },
  { id: "00000000-0000-0000-0000-0000000000a4", name: "Calculus", domain: MATH_DOMAIN, e1: 0.6, e2: 0.3, e3: 0.3 },
  // Music (e3 axis)
  { id: "00000000-0000-0000-0000-0000000000c1", name: "Rhythm", domain: MUSIC_DOMAIN, e1: 0.05, e2: 0.05, e3: 1.0 },
  { id: "00000000-0000-0000-0000-0000000000c2", name: "Melody", domain: MUSIC_DOMAIN, e1: 0.1, e2: 0.2, e3: 0.8 },
  { id: "00000000-0000-0000-0000-0000000000c3", name: "Harmony", domain: MUSIC_DOMAIN, e1: 0.35, e2: 0.1, e3: 0.7 },
  { id: "00000000-0000-0000-0000-0000000000c4", name: "Counterpoint", domain: MUSIC_DOMAIN, e1: 0.3, e2: 0.3, e3: 0.6 },
  // Physics (e2 axis, R-0022) — the Physicist's trailhead. Named "Motion" so it
  // never collides with imported vault note names ("Mecánica…") in Travel.
  { id: "00000000-0000-0000-0000-0000000000d1", name: "Motion", domain: PHYSICS_DOMAIN, e1: 0.05, e2: 1.0, e3: 0.05 },
];

// Bridges are decorative — reachability is positional, not adjacency-based, so a
// bridge only draws a labelled line. Cross-domain bridges hint the domains
// connect.
export const P = Object.fromEntries(SEED_PLATEAUS.map((p) => [p.name, p.id]));
export const SEED_BRIDGES = [
  { id: "00000000-0000-0000-0000-0000000000b1", from: P.Arithmetic, to: P.Algebra, concept: "variables" },
  { id: "00000000-0000-0000-0000-0000000000b2", from: P.Algebra, to: P.Geometry, concept: "coordinates" },
  { id: "00000000-0000-0000-0000-0000000000b3", from: P.Algebra, to: P.Calculus, concept: "rates of change" },
  { id: "00000000-0000-0000-0000-0000000000b4", from: P.Geometry, to: P.Calculus, concept: "limits" },
  { id: "00000000-0000-0000-0000-0000000000b5", from: P.Rhythm, to: P.Melody, concept: "pitch" },
  { id: "00000000-0000-0000-0000-0000000000b6", from: P.Melody, to: P.Harmony, concept: "chords" },
  { id: "00000000-0000-0000-0000-0000000000b7", from: P.Harmony, to: P.Counterpoint, concept: "voice-leading" },
  { id: "00000000-0000-0000-0000-0000000000b8", from: P.Rhythm, to: P.Counterpoint, concept: "meter" },
  // cross-domain — purely visual
  { id: "00000000-0000-0000-0000-0000000000b9", from: P.Geometry, to: P.Harmony, concept: "ratio" },
  // Physics joins the world through its transversal hub (R-0022). NB: b1–b9 are
  // taken — next free id is …ba (the architect caught a …b4 collision here).
  { id: "00000000-0000-0000-0000-0000000000ba", from: P.Calculus, to: P.Motion, concept: "equations of motion" },
];
