// traverse.js — pure. Accumulates the tab-LOCAL demo reputation on a click.
//
// This reputation is an explicit Phase-8 stand-in: it is NEVER synced (R-0005
// AC5/AC7). Clicking a lit plateau nudges the local reputation multivector's
// grade-1 components toward that plateau, so neighbours that newly align clear
// the fog on the next render.
//
// The reputation object is the same `{ domain_reps: { <uuid>: [8 floats] } }`
// shape mp-wasm decodes (blade order [1,e1,e2,e12,e3,e13,e23,e123] — grade-1
// lives at indices 1, 2 and 4).

const E1 = 1;
const E2 = 2;
const E3 = 4;

/// Return a NEW reputation with `k * normalize(position)` added into `domain`'s
/// grade-1 components. Input is not mutated (pure).
export function accumulate(rep, domain, { e1, e2, e3 }, k = 0.5) {
  const mag = Math.hypot(e1, e2, e3) || 1;
  const prev = rep.domain_reps[domain] ?? [0, 0, 0, 0, 0, 0, 0, 0];
  const next = prev.slice();
  next[E1] += (k * e1) / mag;
  next[E2] += (k * e2) / mag;
  next[E3] += (k * e3) / mag;
  return {
    ...rep,
    domain_reps: { ...rep.domain_reps, [domain]: next },
  };
}
