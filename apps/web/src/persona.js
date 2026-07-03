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

// The Quantum-Computing curriculum's two-logic fork (curriculum.js). The doc's
// central decision is CLASSICAL (LEM · ZFC · hyperreal) vs INTUITIONISTIC
// (topos · SIA) foundations — two backends targeting "infinitesimal calculus"
// as one spec. Modeled here as two grade-1 lenses that MEET on the pure Formal
// axis (the shared math both target): Classical leans Formal→Empirical (the
// backend that reconnects to measured physics), Intuitionistic leans
// Formal→Creative (constructive proof, build-the-witness). Their near-e1
// directions are close enough to share the meet, far enough that each lens
// clears the SEED=0.16 fog margin on its OWN trailhead but not the other's.
export const CLASSICAL_DOMAIN = "44444444-4444-4444-4444-444444444444";
export const INTUITIONISTIC_DOMAIN = "55555555-5555-5555-5555-555555555555";

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
    blurb: "Wakes facing Mathematics — begins at Arithmetic.",
    orient: [{ domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } }],
  },
  {
    id: "composer",
    name: "The Composer",
    domainLabel: "Music",
    blurb: "Wakes facing Music — begins at Rhythm.",
    orient: [{ domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } }],
  },
  {
    id: "polymath",
    name: "The Polymath",
    domainLabel: "Mathematics × Music",
    blurb: "A foothold in each domain — begins at Arithmetic and Rhythm.",
    orient: [
      { domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } },
      { domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } },
    ],
  },
  {
    id: "physicist",
    name: "The Physicist",
    domainLabel: "Physics",
    blurb: "Wakes facing Physics — begins at Motion.",
    orient: [{ domain: PHYSICS_DOMAIN, dir: { e1: 0, e2: 1, e3: 0 } }],
  },
  // The Quantum-Computing curriculum's two entry lenses (curriculum.js). Both
  // face the Formal axis; the Logician tilts Empirical (classical → physics),
  // the Constructivist tilts Creative (intuitionistic → build-the-witness).
  {
    id: "logician",
    name: "The Logician",
    domainLabel: "Classical Foundations",
    blurb: "Wakes facing the classical branch — begins at Classical Predicate Logic.",
    orient: [{ domain: CLASSICAL_DOMAIN, dir: { e1: 0.95, e2: 0.3, e3: 0 } }],
  },
  {
    id: "constructivist",
    name: "The Constructivist",
    domainLabel: "Intuitionistic Foundations",
    blurb: "Wakes facing the intuitionistic branch — begins at Intuitionistic Logic.",
    orient: [{ domain: INTUITIONISTIC_DOMAIN, dir: { e1: 0.95, e2: 0, e3: 0.3 } }],
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
  // The QC-curriculum fork (curriculum.js): two near-Formal lenses that meet on
  // the e1 axis — the shared infinitesimal-calculus/algebra spine both target.
  { id: CLASSICAL_DOMAIN, label: "Classical Foundations", canonical: { e1: 0.95, e2: 0.3, e3: 0 } },
  {
    id: INTUITIONISTIC_DOMAIN,
    label: "Intuitionistic Foundations",
    canonical: { e1: 0.95, e2: 0, e3: 0.3 },
  },
];

// The three GA axes under HUMAN labels — the UI renders these, never "e1/e2/e3"
// (R-0009 AC1: no raw blade indices leak to the visitor). The semantics are from
// ga.rs / GARUST_INTEGRATION.md: e1 = Formal, e2 = Empirical, e3 = Creative.
export const AXES = [
  { key: "e1", label: "Formal" },
  { key: "e2", label: "Empirical" },
  { key: "e3", label: "Creative" },
];

// `resolve` is an OPTIONAL label resolver (SPEC-0038): with it, custom/authored domains
// (whose ids are not in the static DOMAINS) resolve to their label instead of "Uncharted".
// Omitted → byte-identical to the pre-0038 behaviour (static DOMAINS only).
function labelForDomain(domain, resolve) {
  return (resolve && resolve(domain)) || DOMAINS.find((d) => d.id === domain)?.label || "Uncharted";
}

// A one-line human blurb describing which way the lens faces. Pure, no GA.
function describeOrientation(faced, resolve) {
  if (faced.length === 0)
    return "Faces nothing yet — orient toward a domain to set where you begin.";
  const labels = faced.map(({ domain }) => labelForDomain(domain, resolve));
  return `Wakes facing ${labels.join(" and ")} — your starting orientation.`;
}

// Pure: { name, orient, tone } → an archetype-shaped persona. Drops any domain whose
// direction is all-zero (so it neither lights nor mislabels), derives a domainLabel
// from the faced domains, and composes an optional companion voice from the tone.
// Deterministic (R-0009 AC6). Exposes ONLY direction — there is no magnitude/score/
// rank input anywhere in the shape (CLAUDE.md §4, R-0009 AC1/AC5).
//
// `resolveLabel` (SPEC-0038, optional): a `(domainId) => label | undefined` hook so a
// persona facing an AUTHORED domain shows its name (not "Uncharted") on the card, the
// companion intro, and the grounding context (all read `domainLabel`/`blurb`). Omitting
// it preserves the exact prior output.
export function authorPersona({ name, orient, tone } = {}, resolveLabel) {
  const faced = (orient ?? []).filter(
    ({ dir }) => Math.hypot(dir?.e1 ?? 0, dir?.e2 ?? 0, dir?.e3 ?? 0) > 0,
  );
  const labels = faced.map(({ domain }) => labelForDomain(domain, resolveLabel));
  return {
    id: "authored", // not a key in VOICES → voice falls back gracefully (AC3)
    name: (name ?? "").trim() || "Your persona",
    domainLabel: labels.join(" × ") || "Uncharted",
    blurb: describeOrientation(faced, resolveLabel),
    orient: faced,
    voice: tone?.trim() ? `Speak as ${tone.trim()}.` : undefined,
  };
}

// ── Author-your-own domains (SPEC-0038 / R-0038) ───────────────────────────
//
// A domain is just a named grade-1 DIRECTION `{ id, label, canonical }`, and the engine
// projects reputation/fog onto ANY canonical (not only a basis axis) — so "more lenses"
// is pure authoring, no garust/core change. main.js merges authored domains into the
// live DOMAINS set; these are the only additions the pure layer needs.

// Deterministic uuid-format id from a domain name. Pure (no crypto/random): the same name
// → the same domain across sessions AND users (dedup + future cross-user alignment), and
// Rust's `Uuid::parse_str` accepts the 8-4-4-4-12 lowercase hex it emits — which is what
// lets a signed traversal in an authored domain validate. Four INDEPENDENT 32-bit lanes
// (distinct golden-ratio seeds + an avalanche finalizer) give ~128-bit spread, so short or
// near-identical names don't collide on the high bits.
export function domainIdFor(name) {
  const s = String(name ?? "")
    .trim()
    .toLowerCase();
  const lane = (salt) => {
    let h = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const x = lane(0) + lane(1) + lane(2) + lane(3);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

const clamp01 = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
};

// Pure: a named lens + a Formal/Empirical/Creative direction → a domain `{ id, label,
// canonical }`. Direction only, NEVER a magnitude (CLAUDE.md §4): the raw 0..1 canonical
// is safe because the live fog reads recomputed log-reputation (normalized), not this
// vector, and the only live canonical consumer (`canonicalAxis → vouchFor`) builds a
// unit-normalized rotor where the scale divides out. Blank name → null (rejected).
export function authorDomain({ name, e1, e2, e3 } = {}) {
  const label = String(name ?? "").trim();
  if (!label) return null;
  return {
    id: domainIdFor(label),
    label,
    canonical: { e1: clamp01(e1), e2: clamp01(e2), e3: clamp01(e3) },
  };
}

// Suggested lenses for the add-lens datalist — grounded BLENDS of the three axes (not new
// axes). Choosing one pre-fills the sliders; it is then authored via `authorDomain`, so its
// id is name-derived like any other (these are hints, not a separate registry).
export const SUGGESTED_DOMAINS = [
  { name: "Computation", canonical: { e1: 0.85, e2: 0.45, e3: 0.0 } },
  { name: "Engineering", canonical: { e1: 0.45, e2: 0.85, e3: 0.1 } },
  { name: "AI", canonical: { e1: 0.7, e2: 0.6, e3: 0.1 } },
  { name: "Electromagnetism", canonical: { e1: 0.55, e2: 0.8, e3: 0.0 } },
  { name: "FPGA / Hardware", canonical: { e1: 0.5, e2: 0.8, e3: 0.0 } },
];

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
