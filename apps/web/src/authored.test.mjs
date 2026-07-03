// authored.test.mjs — node --test, no wasm. Proves the pure visitor-authored
// persona factory (SPEC-0009 §2.2, R-0009 AC1/AC2/AC5/AC6). Run:
// `node --test apps/web/src/*.test.mjs`.
//
// The decisive property: an authored persona is just an archetype-shaped object,
// so it routes through the UNCHANGED seedReputation and seeds bit-identically to
// a preset with the same orientation. Authoring sets direction only — never a
// magnitude (CLAUDE.md §4): scaling every slider leaves the seed unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import {
  authorPersona,
  seedReputation,
  DOMAINS,
  AXES,
  MATH_DOMAIN,
  MUSIC_DOMAIN,
} from "./persona.js";

const facing = (domain, dir) => [{ domain, dir }];

test("authoring vocabulary exposes human labels, never raw blade indices (AC1)", () => {
  // Two domains a visitor may orient toward this phase.
  assert.ok(DOMAINS.length >= 2);
  for (const d of DOMAINS) {
    assert.equal(typeof d.id, "string");
    assert.ok(d.label.length > 0);
    assert.equal(typeof d.canonical.e1, "number");
  }
  // Three axes under human labels (no "e1/e2/e3" leaking to the visitor).
  assert.deepEqual(
    AXES.map((a) => a.label),
    ["Formal", "Empirical", "Creative"],
  );
});

test("authored persona facing Mathematics seeds identically to the Geometer (AC2)", () => {
  const p = authorPersona({ name: "Ada", orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }) });
  const r = seedReputation(p);
  assert.deepEqual(Object.keys(r.domain_reps), [MATH_DOMAIN]);
  assert.deepEqual(r.domain_reps[MATH_DOMAIN], [0, 0.16, 0, 0, 0, 0, 0, 0]);
  assert.equal(p.name, "Ada");
});

test("two different authored orientations seed different reputations (AC2)", () => {
  const a = seedReputation(authorPersona({ orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }) }));
  const b = seedReputation(
    authorPersona({ orient: facing(MUSIC_DOMAIN, { e1: 0, e2: 0, e3: 1 }) }),
  );
  assert.notDeepEqual(a.domain_reps, b.domain_reps);
  assert.deepEqual(Object.keys(a.domain_reps), [MATH_DOMAIN]);
  assert.deepEqual(Object.keys(b.domain_reps), [MUSIC_DOMAIN]);
});

test("authoring sets direction only — scaling every axis leaves the seed unchanged (AC1/AC5, §4)", () => {
  const unit = authorPersona({ orient: facing(MATH_DOMAIN, { e1: 1, e2: 0.5, e3: 0.25 }) });
  const scaled = authorPersona({ orient: facing(MATH_DOMAIN, { e1: 4, e2: 2, e3: 1 }) });
  assert.deepEqual(seedReputation(unit).domain_reps, seedReputation(scaled).domain_reps);
});

test("an all-zero / unfaced orientation is dropped and reaches nothing (AC6 fog/Sybil)", () => {
  const p = authorPersona({ name: "Nobody", orient: facing(MATH_DOMAIN, { e1: 0, e2: 0, e3: 0 }) });
  assert.deepEqual(p.orient, []);
  assert.deepEqual(seedReputation(p).domain_reps, {});
  assert.equal(p.domainLabel, "Uncharted");
});

test("authorPersona is deterministic (AC6)", () => {
  const args = { name: "Ada", orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }), tone: "wry" };
  assert.deepEqual(authorPersona(args), authorPersona(args));
});

test("domainLabel is derived from the faced domains", () => {
  const one = authorPersona({ orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }) });
  assert.equal(one.domainLabel, "Mathematics");
  const two = authorPersona({
    orient: [
      { domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } },
      { domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } },
    ],
  });
  assert.equal(two.domainLabel, "Mathematics × Music");
});

test("a blank name falls back to a safe default; id is never a VOICES key (AC1/AC3)", () => {
  const p = authorPersona({ orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }) });
  assert.equal(p.name, "Your persona");
  assert.equal(p.id, "authored");
});

test("a visitor tone composes a companion voice; absence leaves it undefined (AC3)", () => {
  const withTone = authorPersona({
    orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }),
    tone: "  playful ",
  });
  assert.equal(withTone.voice, "Speak as playful.");
  const without = authorPersona({ orient: facing(MATH_DOMAIN, { e1: 1, e2: 0, e3: 0 }) });
  assert.equal(without.voice, undefined);
});

test("authorPersona tolerates no arguments (AC6 safe-by-default)", () => {
  const p = authorPersona();
  assert.deepEqual(p.orient, []);
  assert.deepEqual(seedReputation(p).domain_reps, {});
  assert.equal(p.domainLabel, "Uncharted");
});

test("a persisted seed rebuilt via authorPersona seeds identically — one seeding path (AC4 §2.5)", () => {
  // SPEC-0009 §2.5: only the raw inputs `{ name, orient, tone }` are persisted; on
  // reload they are rebuilt through the SAME authorPersona → seedReputation path, so
  // a restored authored persona must seed bit-identically to the freshly-authored one.
  const seed = {
    name: "Ada",
    orient: [
      { domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } },
      { domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } },
    ],
    tone: "wry",
  };
  const fresh = authorPersona(seed);
  // Simulate a localStorage round-trip (JSON.stringify → JSON.parse), then rebuild.
  const restored = authorPersona(JSON.parse(JSON.stringify(seed)));
  assert.deepEqual(seedReputation(restored).domain_reps, seedReputation(fresh).domain_reps);
  assert.deepEqual(restored.orient, fresh.orient);
  assert.equal(restored.voice, fresh.voice);
});

test("an empty-orientation authored persona exposes orient[0]?.domain as undefined, never throws (AC6 guard)", () => {
  // The main.js click / "Add a plateau" / reset handlers read
  // `activePersona.orient[0]?.domain`; the data layer must make that safe for an
  // authored persona facing nothing (empty orient ⇒ undefined, no throw).
  const p = authorPersona({ name: "Nobody", orient: [] });
  assert.deepEqual(p.orient, []);
  assert.equal(p.orient[0]?.domain, undefined);
  assert.deepEqual(seedReputation(p).domain_reps, {});
});
