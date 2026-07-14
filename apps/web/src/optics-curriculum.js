// optics-curriculum.js — the Optics course: light, grown from the very basics
// (rays you can draw with a ruler) up to photons, as seeded plateaus + bridges
// + a followable path.
//
// Same contract as curriculum.js / cs-curriculum.js: pure data, fixed ids in
// reserved namespaces (plateaus 8…, bridges 9…, resources a…, path 4…-0003),
// idempotently upserted by main.js via seed_plateau/seed_bridge/seed_resource,
// so reload/sync converge and re-seeding never duplicates (R-0004/R-0027).
//
// The design decision this file carries: optics IS physics — the plateaus live
// in PHYSICS_DOMAIN and grow the e2 island beyond its lone Motion trailhead
// (R-0022), rather than minting a new lens. And light is not an island either:
// six bridges marked "(meet)" tie the course to the rest of the rhizome FROM
// THE VERY BASICS — Geometry (rays are lines), Algebra (the thin-lens
// equation), Motion (oscillation), Calculus (the wave equation), the maths
// curriculum's Maxwell plateau (light as an EM wave), and its Qubit plateau
// (photonic qubits). The seeded path walks Geometry → Motion first, then the
// whole course, and summits where the other two journeys already meet: on the
// quantum plateaus.

import { PHYSICS_DOMAIN } from "./persona.js";
import { P } from "./seeds.js";
import { Q } from "./curriculum.js";

const PH = PHYSICS_DOMAIN;

// Positions live on the Empirical(e2) axis — optics is the most experimental
// of subjects; every claim below is a tabletop experiment — drifting toward
// Formal(e1) as the mathematics deepens (waves, Maxwell, photons) and toward
// Creative(e3) where seeing is the point (color, instruments). The trailhead
// sits near the Physicist lens' canonical e2 direction: 0.16·0.98 = 0.1568 >
// mp-graph's 0.15 fog threshold, so the course is walkable on step one.
export const OPTICS_PLATEAUS = [
  // ── Phase I · Ray optics (draw it with a ruler) ───────────────────────────
  {
    id: "80000000-0000-0000-0000-000000000001",
    name: "Light & Shadow",
    domain: PH, e1: 0.05, e2: 0.98, e3: 0.1,
    description:
`# Light & Shadow
The zeroth fact of optics: in a uniform medium, **light travels in straight lines**. Everything in Phase I follows from drawing those lines. Shadows are the geometry of blocked rays; a pinhole camera is the geometry of unblocked ones — an inverted image, no lens required, from straight lines and similar triangles alone.

$$\\frac{h_{image}}{h_{object}} = \\frac{d_{pinhole \\to screen}}{d_{object \\to pinhole}}$$

*Embedded analogy:* a ray tracer's primary rays — straight lines from source to surface, before any bounce is computed.

**Deliverable:** build (or diagram) a pinhole camera and predict the image height of a 2 m door 10 m away, screen 0.1 m behind the pinhole — then check with similar triangles.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000002",
    name: "Reflection & Mirrors",
    domain: PH, e1: 0.2, e2: 0.88, e3: 0.2,
    description:
`# Reflection & Mirrors
One law: **angle of incidence = angle of reflection**, both measured from the normal. From it: a plane mirror makes a virtual image as far *behind* the glass as you stand in front; a curved mirror focuses parallel rays to a point at $f = R/2$. Hero of Alexandria noticed the deeper version: of all paths from A to mirror to B, light takes the **shortest** — the law of reflection is a minimum principle in disguise.

*Embedded analogy:* a bank shot in billiards — same angle in, angle out, and aiming at the cushion's "mirror image" of the pocket.

**Deliverable:** prove with a ray diagram that a full-length view of yourself needs a mirror only *half* your height — and that your distance from it doesn't matter.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000003",
    name: "Refraction & Snell's Law",
    domain: PH, e1: 0.3, e2: 0.85, e3: 0.15,
    description:
`# Refraction & Snell's Law
Light bends where media meet, because it *slows down*: $n = c/v$ and
$$n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2.$$
Fermat's principle upgrades Hero: light takes the path of **least time** — the bend at the surface is exactly a lifeguard cutting the beach/water tradeoff optimally. Going from dense to thin, past the critical angle $\\sin\\theta_c = n_2/n_1$ there is no transmitted ray at all: **total internal reflection**, a mirror with no silver.

**Deliverable:** compute the critical angle for glass ($n = 1.5$) to air, and explain why a diamond ($n = 2.4$) sparkles more than the same cut in glass.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000004",
    name: "Color & Dispersion",
    domain: PH, e1: 0.15, e2: 0.78, e3: 0.45,
    description:
`# Color & Dispersion
The index of refraction is not one number — it depends on wavelength, $n = n(\\lambda)$, blue bending more than red. A prism doesn't *add* color to white light; it **sorts** what was already there (Newton's crucial experiment: a second prism recombines the spectrum to white). Rainbows are dispersion plus total-internal-reflection inside every raindrop; each observer owns a private one.

*Embedded analogy:* a prism is a Fourier analyzer in glass — one physical device, splitting a signal into its frequency components.

**Deliverable:** trace one ray through a raindrop (refract, reflect, refract) and derive why the rainbow sits near 42° from the antisolar point.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000005",
    name: "Lenses & Images",
    domain: PH, e1: 0.35, e2: 0.82, e3: 0.18,
    description:
`# Lenses & Images
A lens is Snell's law applied twice, curved. All of it compresses into the **thin-lens equation**
$$\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}, \\qquad m = -\\frac{d_i}{d_o},$$
plus three principal rays you can draw: parallel→focus, center→straight, focus→parallel. Real images (projectable, inverted) vs virtual images (upright, un-projectable) fall out of the *signs* — the algebra is doing the geometry's bookkeeping.

**Deliverable:** an object 30 cm from a $f = 10$ cm converging lens — locate the image by equation AND by ray diagram, and confirm the two agree on size and orientation.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000006",
    name: "Optical Instruments",
    domain: PH, e1: 0.22, e2: 0.8, e3: 0.4,
    description:
`# Optical Instruments
Compose the primitives and you get every instrument: the **eye** (adaptive lens, retina screen — myopia and hyperopia are thin-lens sign errors, glasses are the patch), the **camera** (lens + aperture + sensor; f-number = focal length / aperture), the **microscope** (objective makes a real image, eyepiece magnifies it), the **telescope** (same trick, objective as large as you can afford — light-gathering goes as diameter²; Newton swapped the big lens for a mirror).

*Embedded analogy:* instruments are function composition — each stage's image is the next stage's object.

**Deliverable:** compute the angular magnification of a telescope with $f_{objective} = 1200$ mm and $f_{eyepiece} = 25$ mm, and say what the aperture buys that magnification cannot.`,
  },

  // ── Phase II · Wave optics (light interferes) ─────────────────────────────
  {
    id: "80000000-0000-0000-0000-000000000007",
    name: "Waves & Oscillations",
    domain: PH, e1: 0.42, e2: 0.85, e3: 0.1,
    description:
`# Waves & Oscillations
The prerequisite Phase II needs: a mass on a spring obeys $F = -kx$, giving $x(t) = A\\cos(\\omega t + \\phi)$ — **simple harmonic motion**. Chain oscillators together and a disturbance *travels*: a wave, $y(x,t) = A\\sin(kx - \\omega t)$, with
$$v = f\\lambda.$$
The one law ray optics cannot see: **superposition** — two waves in the same place *add*, crest-on-crest reinforcing, crest-on-trough cancelling. Everything in wave optics is superposition plus geometry.

**Deliverable:** two speakers, one tone, walk the room — predict where the sound nulls are, then map the same reasoning onto light.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000008",
    name: "Huygens & Interference",
    domain: PH, e1: 0.38, e2: 0.82, e3: 0.22,
    description:
`# Huygens & Interference
Huygens' principle: every point on a wavefront is a source of wavelets; the next wavefront is their envelope. Young's **double slit** (1801) made it decisive: two slits, one light source, and the screen shows *fringes* —
$$d \\sin\\theta = m\\lambda \\quad (\\text{bright}), \\qquad d \\sin\\theta = (m + \\tfrac{1}{2})\\lambda \\quad (\\text{dark}).$$
Path difference in whole wavelengths → reinforce; in halves → cancel. Particles cannot cancel. This experiment ended Newton's corpuscles — hold that thought for Phase IV, where it gets stranger.

**Deliverable:** given fringes 3.4 mm apart on a screen 2 m from slits 0.4 mm apart, recover the wavelength — you have just *measured* something a million times smaller than the apparatus.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000009",
    name: "Diffraction & Resolution",
    domain: PH, e1: 0.4, e2: 0.8, e3: 0.2,
    description:
`# Diffraction & Resolution
Waves bend around edges — a single slit interferes *with itself* (minima at $a\\sin\\theta = m\\lambda$), and $N$ slits sharpen the fringes into a **grating**, the workhorse of spectroscopy. The price every instrument pays: a circular aperture smears a point source into the Airy pattern, so two points closer than
$$\\theta_{min} \\approx 1.22\\,\\frac{\\lambda}{D}$$
are one blob — the **Rayleigh criterion**. Resolution is bought with aperture or with shorter wavelength; there is no third currency.

*Embedded analogy:* the diffraction limit is the Nyquist limit of imaging — a hard floor set by the wave, not by engineering.

**Deliverable:** compute whether the eye (D ≈ 5 mm pupil) can resolve a car's two headlights at 10 km, and what diameter telescope could.`,
  },
  // ── Phase III · Electromagnetism (what is waving) ─────────────────────────
  {
    id: "80000000-0000-0000-0000-00000000000a",
    name: "Light is an EM Wave",
    domain: PH, e1: 0.48, e2: 0.82, e3: 0.08,
    description:
`# Light is an EM Wave
Maxwell's equations, in empty space, rearrange into a wave equation whose speed is
$$c = \\frac{1}{\\sqrt{\\mu_0 \\varepsilon_0}} \\approx 3\\times10^8\\ \\text{m/s}$$
— a number computed from *tabletop electricity and magnetism experiments* that turned out to be the measured speed of light. Light **is** an electromagnetic wave: oscillating $E$ and $B$ fields, perpendicular to each other and to the direction of travel. Visible light is one octave of a spectrum running from radio to gamma; the "optics" of this course is wavelength-agnostic.

**Deliverable:** state which way $E$, $B$, and propagation point relative to each other, and locate green light (λ ≈ 530 nm) on the frequency axis.`,
  },
  {
    id: "80000000-0000-0000-0000-00000000000b",
    name: "Polarization",
    domain: PH, e1: 0.35, e2: 0.8, e3: 0.25,
    description:
`# Polarization
Because the EM wave is **transverse**, its $E$ field has a *direction* in the plane perpendicular to travel — a degree of freedom sound doesn't have. A polarizer passes the component along its axis: **Malus's law** $I = I_0\\cos^2\\theta$. Reflection at Brewster's angle ($\\tan\\theta_B = n_2/n_1$) polarizes completely — why sunglasses kill glare. Two crossed polarizers pass nothing; slip a third *between* them at 45° and light returns. Sit with that: it is your first genuinely quantum-flavored measurement fact, met classically.

**Deliverable:** compute the fraction of unpolarized light surviving three polarizers at 0°, 45°, 90°, and explain why removing the middle one gives *less*.`,
  },

  // ── Phase IV · Photons (light quantized) ──────────────────────────────────
  {
    id: "80000000-0000-0000-0000-00000000000c",
    name: "Photons & the Quantum of Light",
    domain: PH, e1: 0.52, e2: 0.78, e3: 0.12,
    description:
`# Photons & the Quantum of Light
The wave picture, having beaten Newton's particles, cracks in turn. The **photoelectric effect**: light ejects electrons by *frequency*, not intensity — dim blue works, bright red never does. Einstein (1905): light arrives in quanta,
$$E = hf,$$
each photon paying the work function or nothing. Then the deepest experiment in physics: run Young's double slit **one photon at a time** — each arrives as a dot, and the dots *build up the interference fringes*. Single particles, interfering with themselves. Neither "wave" nor "particle" survives intact; what survives is the mathematics.

**Deliverable:** from a stopping potential of 1.2 V for λ = 400 nm light, extract the metal's work function in eV.`,
  },
  {
    id: "80000000-0000-0000-0000-00000000000d",
    name: "Lasers & Fiber Optics",
    domain: PH, e1: 0.3, e2: 0.82, e3: 0.3,
    description:
`# Lasers & Fiber Optics
Engineering the photon. Einstein's **stimulated emission**: a passing photon can trigger an excited atom to emit a *clone* — same frequency, phase, direction. Pump a population inversion, add mirrors, and the clones cascade: a **laser**, light coherent enough to show interference fringes meters long. Pair it with Phase I's total internal reflection and you get **optical fiber** — light guided down a glass thread with losses so low that this sentence likely crossed an ocean as laser pulses in one.

*Embedded analogy:* stimulated emission is an amplifier with unity-gain phase lock — coherence in, more of the same coherence out.

**Deliverable:** explain why a two-level atom cannot sustain a population inversion, and why three levels can — the design constraint every real laser satisfies.`,
  },
];

export const O = Object.fromEntries(OPTICS_PLATEAUS.map((p) => [p.name, p.id]));

// The dependency graph. Bridges marked "(meet)" are cross-domain — Physics ↔
// the seed basics and the maths curriculum — and are the "link all needed
// topics from the very basics" ask made literal: rays need Geometry, the
// thin-lens equation needs Algebra, waves need Motion and Calculus, the EM
// identification needs Maxwell, and the photon walks into the qubit.
export const OPTICS_BRIDGES = [
  // Phase I spine — ray optics
  { id: "90000000-0000-0000-0000-000000000001", from: O["Light & Shadow"], to: O["Reflection & Mirrors"], concept: "angle in = angle out" },
  { id: "90000000-0000-0000-0000-000000000002", from: O["Light & Shadow"], to: O["Refraction & Snell's Law"], concept: "rays bend at boundaries" },
  { id: "90000000-0000-0000-0000-000000000003", from: O["Refraction & Snell's Law"], to: O["Color & Dispersion"], concept: "n depends on λ" },
  { id: "90000000-0000-0000-0000-000000000004", from: O["Refraction & Snell's Law"], to: O["Lenses & Images"], concept: "two refractions = a lens" },
  { id: "90000000-0000-0000-0000-000000000005", from: O["Reflection & Mirrors"], to: O["Optical Instruments"], concept: "mirror telescopes" },
  { id: "90000000-0000-0000-0000-000000000006", from: O["Lenses & Images"], to: O["Optical Instruments"], concept: "images composed" },
  // Phase II — wave optics
  { id: "90000000-0000-0000-0000-000000000007", from: O["Waves & Oscillations"], to: O["Huygens & Interference"], concept: "superposition" },
  { id: "90000000-0000-0000-0000-000000000008", from: O["Huygens & Interference"], to: O["Diffraction & Resolution"], concept: "a slit interferes with itself" },
  { id: "90000000-0000-0000-0000-000000000009", from: O["Diffraction & Resolution"], to: O["Optical Instruments"], concept: "the resolution limit" },
  // Phase III — electromagnetism
  { id: "90000000-0000-0000-0000-00000000000a", from: O["Waves & Oscillations"], to: O["Light is an EM Wave"], concept: "v = fλ, at c" },
  { id: "90000000-0000-0000-0000-00000000000b", from: O["Light is an EM Wave"], to: O["Polarization"], concept: "transverse fields" },
  // Phase IV — photons
  { id: "90000000-0000-0000-0000-00000000000c", from: O["Light is an EM Wave"], to: O["Photons & the Quantum of Light"], concept: "the wave picture cracks" },
  { id: "90000000-0000-0000-0000-00000000000d", from: O["Huygens & Interference"], to: O["Photons & the Quantum of Light"], concept: "one photon at a time" },
  { id: "90000000-0000-0000-0000-00000000000e", from: O["Photons & the Quantum of Light"], to: O["Lasers & Fiber Optics"], concept: "stimulated emission" },
  { id: "90000000-0000-0000-0000-00000000000f", from: O["Refraction & Snell's Law"], to: O["Lasers & Fiber Optics"], concept: "total internal reflection guides light" },
  // The meets — the course's roots in the very basics, and its quantum summit
  { id: "90000000-0000-0000-0000-000000000010", from: P.Geometry, to: O["Light & Shadow"], concept: "rays are lines (meet)" },
  { id: "90000000-0000-0000-0000-000000000011", from: P.Algebra, to: O["Lenses & Images"], concept: "1/f = 1/dₒ + 1/dᵢ (meet)" },
  { id: "90000000-0000-0000-0000-000000000012", from: P.Motion, to: O["Waves & Oscillations"], concept: "F = −kx, released (meet)" },
  { id: "90000000-0000-0000-0000-000000000013", from: P.Calculus, to: O["Waves & Oscillations"], concept: "the wave equation (meet)" },
  { id: "90000000-0000-0000-0000-000000000014", from: Q["Maxwell: ∇F = J/ε₀c"], to: O["Light is an EM Wave"], concept: "∇F = 0 waves at c (meet)" },
  { id: "90000000-0000-0000-0000-000000000015", from: O["Photons & the Quantum of Light"], to: Q["Qubit = Spinor"], concept: "photonic qubits (meet)" },
];

// Curated public starting resources (R-0027 pattern). The Feynman Vol. I link
// deliberately repeats the uri already seeded on Calculus and Motion — same
// uri, distinct id — so it threads as "Also covers" (R-0028), the book being
// the physical thread from mechanics into optics.
export const OPTICS_RESOURCES = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    plateau: O["Light & Shadow"], kind: "Article",
    title: "Khan Academy — Geometric optics",
    uri: "https://www.khanacademy.org/science/physics/geometric-optics",
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    plateau: O["Refraction & Snell's Law"], kind: "Interactive",
    title: "PhET — Bending Light",
    uri: "https://phet.colorado.edu/en/simulations/bending-light",
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    plateau: O["Refraction & Snell's Law"], kind: "Article",
    title: "The Feynman Lectures on Physics, Vol. I",
    uri: "https://www.feynmanlectures.caltech.edu/I_toc.html",
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    plateau: O["Huygens & Interference"], kind: "Interactive",
    title: "PhET — Wave Interference",
    uri: "https://phet.colorado.edu/en/simulations/wave-interference",
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    plateau: O["Polarization"], kind: "Video",
    title: "3Blue1Brown × minutephysics — Some light quantum mechanics",
    uri: "https://www.youtube.com/watch?v=MzRCDLre1b4",
  },
  {
    id: "a0000000-0000-0000-0000-000000000006",
    plateau: O["Photons & the Quantum of Light"], kind: "Article",
    title: "The Feynman Lectures, Vol. III §1 — Quantum Behavior",
    uri: "https://www.feynmanlectures.caltech.edu/III_01.html",
  },
];

// The third seeded PATH (R-0039): the whole optics journey in dependency order
// — whose FIRST two steps are the seed world's own basics (Geometry, Motion:
// "from the very basics", literally) and whose LAST step is the maths path's
// Qubit = Spinor plateau. All three seeded journeys now interlock: maths and
// CS share the AI summit, optics and maths share the qubit.
export const OPTICS_PATHS = [
  {
    id: "40000000-0000-0000-0000-000000000003",
    title: "See the Light — Optics from the First Ray",
    goal:
      "Light, from straight lines and shadows up through mirrors, lenses, " +
      "waves, Maxwell, and the photon — starting at the seed world's own " +
      "Geometry and Motion, ending where light becomes a qubit.",
    steps: [P.Geometry, P.Motion, ...OPTICS_PLATEAUS.map((p) => p.id), Q["Qubit = Spinor"]],
  },
];
