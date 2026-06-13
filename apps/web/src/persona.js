// persona.js — pure. Archetype → the visitor's LOCAL reputation JSON (the lens).
//
// SPEC-0006. No GA/graph/CRDT logic lives here: it only assembles the
// `{ domain_reps: { <uuid>: [8 floats] } }` shape mp-wasm decodes. This is the
// visitor's starting orientation and is NEVER synced (R-0006 AC5).
//
// A persona is NOT a stat sheet (CLAUDE.md §4): it chooses only an *orientation*
// — a grade-1 direction per domain — never a magnitude/score. The seed magnitude
// is fixed in code (SEED) and identical for every archetype; archetypes differ
// only in which domains/directions they face. Earned reach comes from traversal
// (R-0005 AC5), never from the persona.
//
// Reputation is stored as ONE grade-1 vector PER oriented domain, because the fog
// engine MAXes the projection across domain_reps (it does not sum across them).
// That is what makes domain choice scoped: a persona with reputation only in Music
// can never light Math, and vice-versa.

export const MATH_DOMAIN = "11111111-1111-1111-1111-111111111111";
export const MUSIC_DOMAIN = "22222222-2222-2222-2222-222222222222";
// Must equal mp-host's import::PHYSICS_DOMAIN (the importer tags e2-dominant
// notes with it, R-0021); both sides pin the literal in their tests (R-0022).
export const PHYSICS_DOMAIN = "33333333-3333-3333-3333-333333333333";

// grade-1 blade indices in [1, e1, e2, e12, e3, e13, e23, e123]
const E1 = 1;
const E2 = 2;
const E3 = 4;

// Fixed orientation nudge, identical for every archetype. 0.16 is chosen against
// mp-graph's 0.15 REACHABILITY_THRESHOLD: it clears the threshold on an on-axis
// entry plateau (proj 0.160 > 0.15) but not its neighbours, leaving room to
// traverse. Lowering SEED below ~0.15, or a plateau's on-axis coord below ~0.94,
// would darken the entry plateau.
const SEED = 0.16;

// Each archetype orients toward one or more domains by a grade-1 direction
// (R-0006 AC1: name + domain label + one-line blurb). Grade-1 only — a bivector
// flavor would be inert to the grade-1 fog query, so we omit it this phase.
// Directions are single-axis here, which keeps `seedReputation` float-exact.
export const ARCHETYPES = [
  {
    id: "geometer",
    name: "The Geometer",
    domainLabel: "Mathematics",
    blurb: "Wakes facing Mathematics — arithmetic in reach, all else in fog.",
    orient: [{ domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } }],
  },
  {
    id: "composer",
    name: "The Composer",
    domainLabel: "Music",
    blurb: "Wakes facing Music — rhythm in reach, all else in fog.",
    orient: [{ domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } }],
  },
  {
    id: "polymath",
    name: "The Polymath",
    domainLabel: "Mathematics × Music",
    blurb: "A foothold in each domain — arithmetic and rhythm lit, the depths fogged.",
    orient: [
      { domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } },
      { domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } },
    ],
  },
  {
    id: "physicist",
    name: "The Physicist",
    domainLabel: "Physics",
    blurb: "Wakes facing Physics — motion in reach, all else in fog.",
    orient: [{ domain: PHYSICS_DOMAIN, dir: { e1: 0, e2: 1, e3: 0 } }],
  },
];

// ── Visitor-authored personas (SPEC-0009 / R-0009) ─────────────────────────
//
// An authored persona is just an archetype-shaped object built from a name, a
// grade-1 direction per domain, and an optional companion tone. It routes through
// the SAME `seedReputation` above, so authored and preset seeding are bit-identical
// for the same orientation, and authoring sets *direction only* — never a magnitude
// (CLAUDE.md §4). No GA math here: it only assembles the same float shape.

// The domains a visitor may orient toward this phase (the seeded clusters). Each
// carries its canonical grade-1 axis, the slider default that reproduces a preset.
export const DOMAINS = [
  { id: MATH_DOMAIN, label: "Mathematics", canonical: { e1: 1, e2: 0, e3: 0 } },
  { id: MUSIC_DOMAIN, label: "Music", canonical: { e1: 0, e2: 0, e3: 1 } },
  { id: PHYSICS_DOMAIN, label: "Physics", canonical: { e1: 0, e2: 1, e3: 0 } },
];

// The three GA axes under HUMAN labels — the UI renders these, never "e1/e2/e3"
// (R-0009 AC1: no raw blade indices leak to the visitor). The semantics are from
// ga.rs / GARUST_INTEGRATION.md: e1 = Formal, e2 = Empirical, e3 = Creative.
export const AXES = [
  { key: "e1", label: "Formal" },
  { key: "e2", label: "Empirical" },
  { key: "e3", label: "Creative" },
];

function labelForDomain(domain) {
  return DOMAINS.find((d) => d.id === domain)?.label ?? "Uncharted";
}

// A one-line human blurb describing which way the lens faces. Pure, no GA.
function describeOrientation(faced) {
  if (faced.length === 0) return "Faces nothing yet — the world stays in fog until you orient.";
  const labels = faced.map(({ domain }) => labelForDomain(domain));
  return `Wakes facing ${labels.join(" and ")} — that neighbourhood lit, all else in fog.`;
}

// Pure: { name, orient, tone } → an archetype-shaped persona. Drops any domain whose
// direction is all-zero (so it neither lights nor mislabels), derives a domainLabel
// from the faced domains, and composes an optional companion voice from the tone.
// Deterministic (R-0009 AC6). Exposes ONLY direction — there is no magnitude/score/
// rank input anywhere in the shape (CLAUDE.md §4, R-0009 AC1/AC5).
export function authorPersona({ name, orient, tone } = {}) {
  const faced = (orient ?? []).filter(
    ({ dir }) => Math.hypot(dir?.e1 ?? 0, dir?.e2 ?? 0, dir?.e3 ?? 0) > 0,
  );
  const labels = faced.map(({ domain }) => labelForDomain(domain));
  return {
    id: "authored", // not a key in VOICES → voice falls back gracefully (AC3)
    name: (name ?? "").trim() || "Your persona",
    domainLabel: labels.join(" × ") || "Uncharted",
    blurb: describeOrientation(faced),
    orient: faced,
    voice: tone?.trim() ? `Speak as ${tone.trim()}.` : undefined,
  };
}

/// Pure: archetype → reputation JSON. Each oriented domain gets `SEED · unit(dir)`
/// in its grade-1 components. Deterministic (R-0006 AC6). An empty `orient` (or an
/// all-zero direction) yields an empty / grade-1-zero reputation, which the engine
/// sends to fog — the Sybil/fog property.
///
/// SPEC-0010 (Phase 8): this seed magnitude is NO LONGER wired into the live
/// reputation — reach is recomputed from the verified signed-event log (events.js),
/// and the persona's `orient` survives only as a UI/orientation hint (trailheads).
/// The function is retained as the canonical, direction-only orientation→seed
/// mapping that R-0009's authoring guarantees are proven against (persona.test.mjs /
/// authored.test.mjs); it is not called from the live fog path.
export function seedReputation(archetype) {
  const domain_reps = {};
  for (const { domain, dir } of archetype.orient ?? []) {
    const mag = Math.hypot(dir.e1, dir.e2, dir.e3) || 1;
    const v = [0, 0, 0, 0, 0, 0, 0, 0];
    v[E1] = (SEED * dir.e1) / mag;
    v[E2] = (SEED * dir.e2) / mag;
    v[E3] = (SEED * dir.e3) / mag;
    domain_reps[domain] = v;
  }
  return { domain_reps };
}
