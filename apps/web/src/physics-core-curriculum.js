// physics-core-curriculum.js — the DETAILED physics-degree core (R-0066).
//
// R-0057 seeded 9 upper-division physics plateaus (Lagrangian mechanics, EM,
// relativity, QM, spin) and R-0065 surfaced them as "The Physics Core" path. But
// the owner (licenciatura en física) wanted it DEEPER, not general — the granular
// intro→mid sequence a real degree / Khan Physics walks BEFORE the upper division.
// This adds those foundational topics and rebuilds PHYS_CORE_PATH as the full
// intro→advanced numbered sequence.
//
// Same contract as the other curricula: pure data, fixed ids in a reserved
// physics namespace (new plateaus 80…0010+, bridges b…0033+, resources c…0005+),
// idempotently upserted by main.js. Each body ends in a concrete Deliverable and a
// "Study (official)" pointer (Khan Academy / OpenStax University Physics) so the
// teaching is source-grounded, not generic. The 9 R-0057 upper-division ids are
// only REFERENCED here (as strings) — never redefined — so their GA/SIA cross-lens
// bridges stay intact.

import { PHYSICS_DOMAIN } from "./persona.js";

// Reserved references to the seed + R-0057 plateaus this path threads through.
const MOTION = "00000000-0000-0000-0000-0000000000d1"; // 1D kinematics (seed trailhead)
const MATH_METHODS = "80000000-0000-0000-0000-000000000001";
const CLASSICAL_MECH = "80000000-0000-0000-0000-000000000002";
const ROTATIONAL = "80000000-0000-0000-0000-000000000003";
const EM_MAXWELL = "80000000-0000-0000-0000-000000000004";
const SPECIAL_REL = "80000000-0000-0000-0000-000000000005";
const WAVES_OPTICS = "80000000-0000-0000-0000-000000000006";
const THERMO = "80000000-0000-0000-0000-000000000007";
const QUANTUM = "80000000-0000-0000-0000-000000000008";
const SPIN = "80000000-0000-0000-0000-000000000009";

// ── The granular intro→mid physics core (PHYSICS_DOMAIN, e2-dominant) ─────────
export const PHYS_CORE_PLATEAUS = [
  {
    id: "80000000-0000-0000-0000-000000000010",
    name: "Kinematics in 2D & Projectiles",
    domain: PHYSICS_DOMAIN, e1: 0.35, e2: 0.95, e3: 0.12,
    description:
`# Kinematics in 2D & Projectiles
Motion in 1D generalizes to vectors: position, velocity, and acceleration each split into independent $x$ and $y$ components. A projectile is the clean case — constant $g$ downward, nothing horizontal — so the horizontal motion is uniform and the vertical is free-fall, solved separately and recombined. Range, max height, and time-of-flight all fall out of $\\vec r(t) = \\vec r_0 + \\vec v_0 t + \\tfrac12 \\vec a t^2$ read component-wise.

**Deliverable:** for a projectile launched at speed $v_0$, angle $\\theta$, derive the range $R = v_0^2\\sin 2\\theta / g$ and the angle that maximizes it.

**Study (official):** Khan Academy — *Two-dimensional motion*; OpenStax *University Physics I*, Ch. 4 (Motion in Two and Three Dimensions).

### Worked derivation — the range $R = v_0^2\\sin 2\\theta/g$
**Step 1 — split the launch velocity.** $v_{0x} = v_0\\cos\\theta$ (never changes — nothing pushes horizontally) and $v_{0y} = v_0\\sin\\theta$ (fights gravity).

**Step 2 — time of flight, from the vertical problem alone.** Height: $y(t) = v_0\\sin\\theta\\,t - \\tfrac12 g t^2 = t\\,(v_0\\sin\\theta - \\tfrac12 g t)$. It's back on the ground when the bracket vanishes: $T = 2v_0\\sin\\theta/g$.

**Step 3 — range, from the horizontal problem alone.** Uniform motion for time $T$: $R = v_{0x}\\,T = v_0\\cos\\theta\\cdot\\dfrac{2v_0\\sin\\theta}{g} = \\dfrac{v_0^2\\,(2\\sin\\theta\\cos\\theta)}{g}$.

**Step 4 — the double angle.** $2\\sin\\theta\\cos\\theta = \\sin 2\\theta$, so $R = v_0^2\\sin 2\\theta/g$ — maximized where $\\sin 2\\theta = 1$, i.e. $\\theta = 45°$. Sanity: $\\theta = 0$ or $90°$ gives $R = 0$ ✓. The whole result is the two 1D problems glued by a shared clock.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000011",
    name: "Newton's Laws & Forces",
    domain: PHYSICS_DOMAIN, e1: 0.4, e2: 0.93, e3: 0.1,
    description:
`# Newton's Laws & Forces
The three laws (inertia; $\\vec F = m\\vec a$; action–reaction) plus the standard forces: gravity/weight, the normal force, tension, friction ($f \\le \\mu N$), and springs ($F = -kx$). The whole method is one habit — draw a **free-body diagram**, resolve into axes, apply $\\sum \\vec F = m\\vec a$ per axis. Inclines, connected masses, and circular motion (where $a = v^2/r$ points inward) are all this method.

**Deliverable:** a block on a frictionless incline of angle $\\theta$ — draw the free-body diagram and show $a = g\\sin\\theta$.

**Study (official):** Khan Academy — *Forces and Newton's laws of motion*; OpenStax *University Physics I*, Ch. 5–6.

### Worked derivation — $a = g\\sin\\theta$ on a frictionless incline
**Step 1 — free-body diagram.** Exactly two forces on the block: weight $mg$ straight down, and the normal force $N$ perpendicular to the surface. (No friction, by assumption.)

**Step 2 — tilt the axes to match the motion.** Take $x$ along the incline (downhill positive) and $y$ perpendicular to it. $N$ is purely $+y$. The weight splits: the angle between the weight vector and the $-y$ axis equals the incline angle $\\theta$ (both are measured from the vertical), so $W_x = mg\\sin\\theta$ downhill and $W_y = -mg\\cos\\theta$.

**Step 3 — Newton's second law, one axis at a time.** $y$: the block never leaves the surface, so $N - mg\\cos\\theta = 0$, giving $N = mg\\cos\\theta$. $x$: the only force is $mg\\sin\\theta$, so $m a = mg\\sin\\theta$.

**Step 4 — the mass cancels.** $a = g\\sin\\theta$ — independent of $m$, which is Galileo's ramp result. Sanity: $\\theta = 0$ gives $a = 0$ (flat ground); $\\theta = 90°$ gives $a = g$ (free fall). The sine interpolates between them, exactly as the geometry demands.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000012",
    name: "Work, Energy & Power",
    domain: PHYSICS_DOMAIN, e1: 0.42, e2: 0.9, e3: 0.12,
    description:
`# Work, Energy & Power
Work $W = \\int \\vec F \\cdot d\\vec r$ changes kinetic energy (the **work–energy theorem** $W_{net} = \\Delta K$). For conservative forces work is path-independent and stored as potential energy $U$ (gravity $mgh$, spring $\\tfrac12 kx^2$), giving **conservation of mechanical energy** $K + U = \\text{const}$ when only they act. Power $P = dW/dt = \\vec F\\cdot\\vec v$ is the rate.

**Deliverable:** use energy conservation (no kinematics) to find the speed of a mass sliding from rest down a frictionless track of height $h$.

**Study (official):** Khan Academy — *Work and energy*; OpenStax *University Physics I*, Ch. 7–8.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000013",
    name: "Momentum & Impulse",
    domain: PHYSICS_DOMAIN, e1: 0.38, e2: 0.92, e3: 0.1,
    description:
`# Momentum & Impulse
Momentum $\\vec p = m\\vec v$; impulse $\\vec J = \\int \\vec F\\,dt = \\Delta \\vec p$. With no external force, **total momentum is conserved** — the master tool for collisions and explosions. Elastic collisions also conserve kinetic energy; inelastic ones don't (perfectly inelastic = they stick). The center of mass moves as if all mass and external force acted there.

**Deliverable:** two carts, one moving, one at rest, collide and stick — find the final speed from momentum conservation, and how much kinetic energy is lost.

**Study (official):** Khan Academy — *Impacts and linear momentum*; OpenStax *University Physics I*, Ch. 9.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000014",
    name: "Gravitation & Orbits",
    domain: PHYSICS_DOMAIN, e1: 0.45, e2: 0.88, e3: 0.15,
    description:
`# Gravitation & Orbits
Newton's universal law $F = G m_1 m_2 / r^2$ and the gravitational potential energy $U = -GMm/r$. Circular orbits balance gravity against $mv^2/r$, giving orbital speed and period; energy accounting distinguishes bound (ellipse) from escape ($v_{esc} = \\sqrt{2GM/R}$). **Kepler's three laws** (ellipses, equal areas, $T^2 \\propto a^3$) are consequences, not extra postulates.

**Deliverable:** derive Kepler's third law $T^2 = \\tfrac{4\\pi^2}{GM} a^3$ for a circular orbit.

**Study (official):** Khan Academy — *Gravitation*; OpenStax *University Physics I*, Ch. 13.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000015",
    name: "Oscillations & Simple Harmonic Motion",
    domain: PHYSICS_DOMAIN, e1: 0.4, e2: 0.88, e3: 0.18,
    description:
`# Oscillations & Simple Harmonic Motion
Any restoring force linear in displacement ($F = -kx$) gives **SHM**: $\\ddot x = -\\omega^2 x$, solved by sinusoids with $\\omega = \\sqrt{k/m}$, independent of amplitude. Energy sloshes between kinetic and potential. The mass–spring and the small-angle pendulum ($\\omega = \\sqrt{g/L}$) are the same equation; damping and resonance (driven oscillators) are the next layer — and the bridge to waves.

**Deliverable:** show a mass on a spring obeys $\\ddot x = -(k/m)x$ and write $x(t)$ with its period $T = 2\\pi\\sqrt{m/k}$.

**Study (official):** Khan Academy — *Simple harmonic motion*; OpenStax *University Physics I*, Ch. 15.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000016",
    name: "Electrostatics — Charge & Field",
    domain: PHYSICS_DOMAIN, e1: 0.42, e2: 0.9, e3: 0.12,
    description:
`# Electrostatics — Charge & Field
Coulomb's law $F = kq_1q_2/r^2$, the electric field $\\vec E = \\vec F/q$, and the potential $V$ with $\\vec E = -\\nabla V$. **Gauss's law** $\\oint \\vec E\\cdot d\\vec A = Q_{enc}/\\varepsilon_0$ turns symmetry into fields for free (point, line, plane, sphere). Conductors, capacitors ($Q = CV$), and the energy stored in a field round out the statics before charges start moving.

**Deliverable:** use Gauss's law to get the field of an infinite line charge, $E = \\lambda/(2\\pi\\varepsilon_0 r)$.

**Study (official):** Khan Academy — *Electric charge, field, and potential*; OpenStax *University Physics II*, Ch. 5–7.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000017",
    name: "DC Circuits",
    domain: PHYSICS_DOMAIN, e1: 0.35, e2: 0.93, e3: 0.1,
    description:
`# DC Circuits
Current $I = dQ/dt$, Ohm's law $V = IR$, and power $P = IV$. Resistors combine in series (add $R$) and parallel (add $1/R$); **Kirchhoff's laws** (charge conservation at nodes, energy conservation around loops) solve any network. Capacitors in circuits give exponential $RC$ charging/discharging with time constant $\\tau = RC$ — the first differential equation a circuit hands you.

**Deliverable:** solve a two-loop circuit with Kirchhoff's laws, and give the $RC$ discharge curve $V(t) = V_0 e^{-t/RC}$.

**Study (official):** Khan Academy — *Circuits*; OpenStax *University Physics II*, Ch. 9–10.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000018",
    name: "Magnetism & Magnetic Force",
    domain: PHYSICS_DOMAIN, e1: 0.4, e2: 0.9, e3: 0.14,
    description:
`# Magnetism & Magnetic Force
The magnetic force $\\vec F = q\\vec v\\times\\vec B$ (and $I\\vec L\\times\\vec B$ on a wire) — always perpendicular to velocity, so it curves paths without doing work (cyclotron motion). Currents MAKE fields: the Biot–Savart law and **Ampère's law** $\\oint \\vec B\\cdot d\\vec\\ell = \\mu_0 I_{enc}$ give the field of a wire, loop, and solenoid. The cross product here is the first hint that $\\vec B$ is really an oriented plane (the GA lens).

**Deliverable:** find the radius of a charge's circular path in a uniform $\\vec B$, $r = mv/(qB)$.

**Study (official):** Khan Academy — *Magnetic forces, fields, and Faraday's law*; OpenStax *University Physics II*, Ch. 11–12.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000019",
    name: "Electromagnetic Induction",
    domain: PHYSICS_DOMAIN, e1: 0.42, e2: 0.88, e3: 0.15,
    description:
`# Electromagnetic Induction
A changing magnetic flux drives an EMF: **Faraday's law** $\\mathcal{E} = -d\\Phi_B/dt$, with **Lenz's law** (the minus sign) fixing the direction so the induced current opposes the change. This is the generator, the transformer, and inductance ($L$, with energy $\\tfrac12 LI^2$). It is also the last piece of the puzzle: a changing $B$ makes $E$, a changing $E$ makes $B$ — the loop that closes into Maxwell's equations and light.

**Deliverable:** compute the EMF around a loop of area $A$ as $B$ ramps linearly, and use Lenz's law to give the current's direction.

**Study (official):** Khan Academy — *Faraday's law and Lenz's law*; OpenStax *University Physics II*, Ch. 13–14.`,
  },
];

// ── Prerequisite spine: intro chain, and where each feeds the R-0057 upper core.
export const PHYS_CORE_BRIDGES = [
  { id: "b0000000-0000-0000-0000-000000000033", from: "80000000-0000-0000-0000-000000000010", to: MOTION, concept: "2D motion is 1D kinematics, per component" },
  { id: "b0000000-0000-0000-0000-000000000034", from: "80000000-0000-0000-0000-000000000011", to: "80000000-0000-0000-0000-000000000010", concept: "forces cause the accelerations kinematics describes" },
  { id: "b0000000-0000-0000-0000-000000000035", from: "80000000-0000-0000-0000-000000000012", to: "80000000-0000-0000-0000-000000000011", concept: "work is force through a distance" },
  { id: "b0000000-0000-0000-0000-000000000036", from: "80000000-0000-0000-0000-000000000013", to: "80000000-0000-0000-0000-000000000011", concept: "impulse is force over time — the other integral of F" },
  { id: "b0000000-0000-0000-0000-000000000037", from: "80000000-0000-0000-0000-000000000014", to: "80000000-0000-0000-0000-000000000012", concept: "orbits are energy accounting under an inverse-square force" },
  { id: "b0000000-0000-0000-0000-000000000038", from: "80000000-0000-0000-0000-000000000015", to: "80000000-0000-0000-0000-000000000011", concept: "a linear restoring force gives simple harmonic motion" },
  { id: "b0000000-0000-0000-0000-000000000039", from: WAVES_OPTICS, to: "80000000-0000-0000-0000-000000000015", concept: "a wave is coupled oscillators — SHM in space and time" },
  { id: "b0000000-0000-0000-0000-000000000040", from: ROTATIONAL, to: "80000000-0000-0000-0000-000000000011", concept: "torque is the rotational analogue of force" },
  { id: "b0000000-0000-0000-0000-000000000041", from: "80000000-0000-0000-0000-000000000017", to: "80000000-0000-0000-0000-000000000016", concept: "moving charge is current — statics sets the stage" },
  { id: "b0000000-0000-0000-0000-000000000042", from: "80000000-0000-0000-0000-000000000018", to: "80000000-0000-0000-0000-000000000016", concept: "magnetism is what electric charge does when it moves" },
  { id: "b0000000-0000-0000-0000-000000000043", from: "80000000-0000-0000-0000-000000000019", to: "80000000-0000-0000-0000-000000000018", concept: "a changing magnetic flux induces an EMF" },
  { id: "b0000000-0000-0000-0000-000000000044", from: EM_MAXWELL, to: "80000000-0000-0000-0000-000000000019", concept: "induction + Ampère close the loop into Maxwell's equations" },
  { id: "b0000000-0000-0000-0000-000000000045", from: MATH_METHODS, to: "80000000-0000-0000-0000-000000000012", concept: "vector calculus is the language the upper division needs" },
];

// A couple of canonical, free official references (R-0027 shape).
export const PHYS_CORE_RESOURCES = [
  { id: "c0000000-0000-0000-0000-000000000005", plateau: "80000000-0000-0000-0000-000000000011", title: "Khan Academy — Physics library", kind: "Course", uri: "https://www.khanacademy.org/science/physics" },
  { id: "c0000000-0000-0000-0000-000000000006", plateau: "80000000-0000-0000-0000-000000000016", title: "OpenStax — University Physics (Vols. 1–3, free)", kind: "Book", uri: "https://openstax.org/details/books/university-physics-volume-1" },
];

// The FULL physics-degree core as a numbered path (R-0066 replaces the R-0065
// 10-step version): intro mechanics → E&M → the R-0057 upper division.
export const PHYS_CORE_PATH = {
  id: "d0000000-0000-0000-0000-000000000002",
  title: "The Physics Core",
  goal: "The full physics-degree sequence — from kinematics to quanta, intro to upper division.",
  steps: [
    MOTION, // 1  Motion (1D kinematics)
    "80000000-0000-0000-0000-000000000010", // 2  Kinematics in 2D & Projectiles
    "80000000-0000-0000-0000-000000000011", // 3  Newton's Laws & Forces
    "80000000-0000-0000-0000-000000000012", // 4  Work, Energy & Power
    "80000000-0000-0000-0000-000000000013", // 5  Momentum & Impulse
    ROTATIONAL, // 6  Rotational Mechanics & Rigid Bodies
    "80000000-0000-0000-0000-000000000014", // 7  Gravitation & Orbits
    "80000000-0000-0000-0000-000000000015", // 8  Oscillations & SHM
    WAVES_OPTICS, // 9  Waves & Optics
    "80000000-0000-0000-0000-000000000016", // 10 Electrostatics
    "80000000-0000-0000-0000-000000000017", // 11 DC Circuits
    "80000000-0000-0000-0000-000000000018", // 12 Magnetism & Magnetic Force
    "80000000-0000-0000-0000-000000000019", // 13 Electromagnetic Induction
    THERMO, // 14 Thermodynamics & Statistical Mechanics
    MATH_METHODS, // 15 Mathematical Methods (gateway to upper division)
    CLASSICAL_MECH, // 16 Classical Mechanics — Lagrangian & Hamiltonian
    EM_MAXWELL, // 17 Electromagnetism & Maxwell
    SPECIAL_REL, // 18 Special Relativity
    QUANTUM, // 19 Quantum Mechanics
    SPIN, // 20 Spin & Angular Momentum
  ],
  domains: [PHYSICS_DOMAIN],
};
