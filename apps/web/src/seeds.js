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
  {
    id: "00000000-0000-0000-0000-0000000000d1",
    name: "Motion",
    domain: PHYSICS_DOMAIN,
    e1: 0.05,
    e2: 1.0,
    e3: 0.05,
    // R-0074: the Physicist's trailhead was a bare label — now it TEACHES.
    description: `# Motion — Kinematics in One Dimension
Where all of physics starts: describing HOW things move before asking why. Position $x(t)$, displacement $\\Delta x$, average velocity $v = \\Delta x/\\Delta t$, instantaneous velocity $v = dx/dt$, acceleration $a = dv/dt$. For CONSTANT acceleration — free fall, a braking car — three equations answer every question, and none of them is a fact to memorize: each is two lines of algebra away from the definitions (open the worked derivation below).

**Deliverable:** a ball is dropped from rest. Using the derivation — not memory — find how far it falls in $t$ seconds, and how fast it moves after falling a height $h$.

**Study (official):** Khan Academy — *One-dimensional motion*; OpenStax *University Physics I*, Ch. 3.

### Worked derivation — the three constant-acceleration equations
**1. $v = v_0 + at$ — straight from the definition.** Constant acceleration means $a = (v - v_0)/t$: the change in velocity, spread evenly over the time it took. Multiply both sides by $t$, add $v_0$: $v = v_0 + at$.

**2. $x = x_0 + v_0 t + \\tfrac12 a t^2$ — average velocity does the work.** When $v$ grows at a steady rate, the average over the trip is the midpoint: $\\bar v = \\tfrac12(v_0 + v)$. Displacement is average velocity times time: $x - x_0 = \\tfrac12(v_0 + v)\\,t$. Substitute equation 1 for $v$: $x - x_0 = \\tfrac12(v_0 + v_0 + at)\\,t = v_0 t + \\tfrac12 a t^2$.

**3. $v^2 = v_0^2 + 2a(x - x_0)$ — eliminate time.** From equation 1, $t = (v - v_0)/a$. Put that into $x - x_0 = \\tfrac12(v_0 + v)\\,t$: $x - x_0 = \\tfrac12(v_0 + v)(v - v_0)/a = (v^2 - v_0^2)/2a$, because $(v + v_0)(v - v_0) = v^2 - v_0^2$. Rearranged: $v^2 = v_0^2 + 2a(x - x_0)$.

**Sanity check — the dropped ball.** $v_0 = 0$, $a = g$: equation 2 gives $x = \\tfrac12 g t^2$; equation 3 gives $v = \\sqrt{2gh}$ after falling $h$. The deliverable falls out — nothing memorized.`,
  },
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

// Example resources so the Study view / "what to read first" aren't empty on a
// fresh world (R-0027). Fixed ids in the …f namespace (a/b/c/d are taken; e is
// skipped to avoid eyeballing it as the GA e-axes) → seeded as an idempotent,
// convergent upsert via WasmCrdtDoc::seed_resource. Seeded un-stoned; votes are
// earned. Curated public links only; nothing is fetched (R-0023 boundary).
export const SEED_RESOURCES = [
  // Calculus
  {
    id: "00000000-0000-0000-0000-0000000000f1",
    plateau: P.Calculus,
    kind: "Video",
    title: "3Blue1Brown — Essence of Calculus",
    uri: "https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f2",
    plateau: P.Calculus,
    kind: "Article",
    title: "Khan Academy — Calculus 1",
    uri: "https://www.khanacademy.org/math/calculus-1",
  },
  // Algebra
  {
    id: "00000000-0000-0000-0000-0000000000f3",
    plateau: P.Algebra,
    kind: "Article",
    title: "Khan Academy — Algebra basics",
    uri: "https://www.khanacademy.org/math/algebra-basics",
  },
  // Harmony
  {
    id: "00000000-0000-0000-0000-0000000000f4",
    plateau: P.Harmony,
    kind: "Interactive",
    title: "musictheory.net — Lessons",
    uri: "https://www.musictheory.net/lessons",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f5",
    plateau: P.Harmony,
    kind: "Article",
    title: "Open Music Theory",
    uri: "https://viva.pressbooks.pub/openmusictheory/",
  },
  // A cross-cutting book (R-0028): the same URL on Calculus AND Motion, so it
  // threads ("Also covers") and is the book the "equations of motion" connection
  // (R-0029) surfaces. Same uri, distinct ids — not a collision.
  {
    id: "00000000-0000-0000-0000-0000000000f6",
    plateau: P.Calculus,
    kind: "Article",
    title: "The Feynman Lectures on Physics, Vol. I",
    uri: "https://www.feynmanlectures.caltech.edu/I_toc.html",
  },
  {
    id: "00000000-0000-0000-0000-0000000000f7",
    plateau: P.Motion,
    kind: "Article",
    title: "The Feynman Lectures on Physics, Vol. I",
    uri: "https://www.feynmanlectures.caltech.edu/I_toc.html",
  },
  // Motion is the Physicist lens's classical-mechanics trailhead — Sussman &
  // Wisdom's SICM is the definitive classical-mechanics text (Lagrangian /
  // Hamiltonian mechanics made computational). "Article" mirrors how the Feynman
  // book above is classified (RESOURCE_KINDS has no "Book").
  {
    id: "00000000-0000-0000-0000-0000000000f8",
    plateau: P.Motion,
    kind: "Article",
    title: "Sussman & Wisdom — Structure and Interpretation of Classical Mechanics",
    uri: "https://tgvaughan.github.io/sicm/toc.html",
  },
];
