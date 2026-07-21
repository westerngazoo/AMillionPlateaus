// physics-lens-curriculum.js — the physics-degree core, and TWO alternate lenses
// that re-face it (R-0057). Built from the owner's Licenciatura en Física plan.
//
// Same contract as curriculum.js / cs-curriculum.js: pure data, fixed ids in
// reserved namespaces (physics plateaus 8…, GA 9…, SIA a…, bridges b…, resources
// c…, path d…), idempotently upserted by main.js via seed_plateau/seed_bridge/
// seed_resource, so reload/sync converge and re-seeding never duplicates.
//
// The idea this file carries: a physics topic is ONE thing seen three ways. The
// PHYSICS core is the standard sequence (mechanics → EM → relativity → quanta).
// The GEOMETRIC-ALGEBRA lens rewrites it in the algebra of space the whole app
// runs on — rotations as rotors, Maxwell as ∇F = J, spin as an even-grade object.
// The SYNTHETIC lens (SIA) rewrites its CALCULUS with nilsquare infinitesimals,
// ε² = 0, derivatives as algebra instead of limits. Cross-lens bridges tie each
// physics plateau to its GA and SIA reframing; four "(meet)" bridges cross into
// the existing quantum-computing math island (Clifford Cl(V,Q), τ and Rotors,
// SIA Infinitesimals, Qubit = Spinor) so the two worlds share ground, not copies.

import { PHYSICS_DOMAIN, GA_DOMAIN, SIA_DOMAIN } from "./persona.js";

// Meet targets already seeded by curriculum.js (the QC math island). Bridged INTO,
// never redefined — the shared plateaus are the meet (RFC-0002 in spirit).
const CLIFFORD = "10000000-0000-0000-0000-000000000013"; // Clifford Algebra Cl(V,Q)
const TAU_ROTORS = "10000000-0000-0000-0000-000000000014"; // τ and Rotors
const SIA_KOCK = "10000000-0000-0000-0000-000000000009"; // SIA Infinitesimals (Kock–Lawvere)
const QUBIT_SPINOR = "10000000-0000-0000-0000-000000000019"; // Qubit = Spinor
const MOTION = "00000000-0000-0000-0000-0000000000d1"; // the seed Physics trailhead

// ── The physics-degree core (PHYSICS_DOMAIN, e2-dominant) ────────────────────
export const PHYS_PLATEAUS = [
  {
    id: "80000000-0000-0000-0000-000000000001",
    name: "Mathematical Methods",
    domain: PHYSICS_DOMAIN, e1: 0.55, e2: 0.7, e3: 0.1,
    description:
`# Mathematical Methods
The working toolkit the rest of physics leans on: **vector calculus** (grad, div, curl, and the integral theorems of Gauss and Stokes), **linear algebra** (eigenvalues, inner-product spaces, operators), and **differential equations** (ODEs for one degree of freedom, PDEs for fields).

The through-line to watch: gradient, divergence, and curl look like three unrelated operators in the standard notation — the GA and SIA lenses each collapse them into ONE object (the vector derivative ∇; the infinitesimal displacement), which is the first sign the standard packaging is hiding structure.

**Deliverable:** state Stokes' theorem and Gauss' theorem, and say in one line what both are special cases of.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000002",
    name: "Classical Mechanics",
    domain: PHYSICS_DOMAIN, e1: 0.4, e2: 0.85, e3: 0.15,
    description:
`# Classical Mechanics — Lagrangian & Hamiltonian
Newton's $F = \\dot p$ is the start, not the story. **Lagrangian** mechanics recasts motion as a variational principle — the path taken *extremizes the action* $S = \\int L\\,dt$, $L = T - V$ — and the Euler–Lagrange equations fall out for ANY coordinates. **Hamiltonian** mechanics then trades $(q,\\dot q)$ for $(q,p)$ and phase-space flow, the doorway to statistical and quantum mechanics.

Symmetry ⇒ conservation is the crown jewel (Noether): time-invariance ⇒ energy, translation ⇒ momentum, rotation ⇒ angular momentum.

**Deliverable:** derive the Euler–Lagrange equation from $\\delta S = 0$ for one degree of freedom.

### Worked derivation — Euler–Lagrange from $\\delta S = 0$
**Step 1 — the setup.** The action is $S[q] = \\int_{t_1}^{t_2} L(q, \\dot q)\\,dt$. Nudge the path: $q(t) \\to q(t) + \\epsilon\\,\\eta(t)$, with $\\eta(t_1) = \\eta(t_2) = 0$ — the endpoints are pinned, only the route between them varies.

**Step 2 — expand to first order.** By the chain rule, keeping only terms linear in $\\epsilon$: $\\delta S = \\epsilon\\int \\big(\\tfrac{\\partial L}{\\partial q}\\,\\eta + \\tfrac{\\partial L}{\\partial \\dot q}\\,\\dot\\eta\\big)\\,dt$.

**Step 3 — integrate the $\\dot\\eta$ term by parts.** $\\int \\tfrac{\\partial L}{\\partial \\dot q}\\,\\dot\\eta\\,dt = \\big[\\tfrac{\\partial L}{\\partial \\dot q}\\,\\eta\\big]_{t_1}^{t_2} - \\int \\tfrac{d}{dt}\\big(\\tfrac{\\partial L}{\\partial \\dot q}\\big)\\,\\eta\\,dt$. The boundary term dies because $\\eta$ vanishes at the endpoints — this is exactly WHY the endpoints were pinned in step 1.

**Step 4 — the nudge is arbitrary.** $\\delta S = \\epsilon\\int \\big(\\tfrac{\\partial L}{\\partial q} - \\tfrac{d}{dt}\\tfrac{\\partial L}{\\partial \\dot q}\\big)\\,\\eta\\,dt$ must vanish for EVERY $\\eta$. If the bracket were nonzero anywhere, choose $\\eta$ concentrated there and $\\delta S \\ne 0$ — contradiction. So the bracket vanishes at every instant.

**Step 5 — the equation, sanity-checked.** $\\tfrac{d}{dt}\\tfrac{\\partial L}{\\partial \\dot q} = \\tfrac{\\partial L}{\\partial q}$. Feed it $L = \\tfrac12 m\\dot q^2 - V(q)$: the left side is $\\tfrac{d}{dt}(m\\dot q) = m\\ddot q$, the right side $-V'(q) = F$. Newton's $F = ma$ drops out — the variational principle contains the mechanics you already knew.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000003",
    name: "Rotational Mechanics & Rigid Bodies",
    domain: PHYSICS_DOMAIN, e1: 0.35, e2: 0.9, e3: 0.15,
    description:
`# Rotational Mechanics & Rigid Bodies
Rotation is where the standard formalism strains: angular velocity $\\vec\\omega$ and torque $\\vec\\tau$ are "axial vectors" (they flip under reflection differently from real vectors), the moment of inertia is a *tensor*, and finite rotations don't commute or add. Euler's equations, precession, and the gyroscope live here.

The tell: angular momentum $\\vec L = \\vec r \\times \\vec p$ is defined by a cross product that only exists in 3D. That "vector" is really an **oriented plane** wearing a vector costume — exactly what the GA lens makes literal.

**Deliverable:** explain why $\\vec\\omega$ is an axial (pseudo-) vector, not an ordinary one.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000004",
    name: "Electromagnetism & Maxwell",
    domain: PHYSICS_DOMAIN, e1: 0.4, e2: 0.9, e3: 0.1,
    description:
`# Electromagnetism & Maxwell
From Coulomb and Biot–Savart up to the four **Maxwell equations** — $\\nabla\\cdot E=\\rho/\\varepsilon_0$, $\\nabla\\cdot B=0$, $\\nabla\\times E=-\\partial_t B$, $\\nabla\\times B=\\mu_0 J+\\mu_0\\varepsilon_0\\partial_t E$ — and their consequence: light is a wave in the field, moving at $c=1/\\sqrt{\\mu_0\\varepsilon_0}$.

Why four equations for one field? $E$ is a (polar) vector, $B$ an axial one; they mix under boosts. That asymmetry is a notation artifact — the GA lens shows $E$ and $B$ as parts of a single **bivector field** $F$, and the four equations as one.

**Deliverable:** show $\\nabla\\cdot B = 0$ forbids magnetic monopoles and lets $B = \\nabla\\times A$.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000005",
    name: "Special Relativity",
    domain: PHYSICS_DOMAIN, e1: 0.45, e2: 0.85, e3: 0.15,
    description:
`# Special Relativity
Two postulates — physics is the same in every inertial frame, and $c$ is invariant — remake space and time into one **spacetime** with the Minkowski metric $ds^2 = c^2dt^2 - dx^2 - dy^2 - dz^2$. Lorentz transformations mix space and time; simultaneity, length, and duration become frame-dependent; $E^2 = (pc)^2 + (mc^2)^2$.

A boost is a "rotation" in a time–space plane — hyperbolic, with rapidity as the angle. Held next to ordinary rotation, boosts and rotations beg to be the same kind of object; the GA lens (spacetime algebra) makes them literally both rotors.

**Deliverable:** derive time dilation from the invariance of $ds^2$ for a moving clock.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000006",
    name: "Waves & Optics",
    domain: PHYSICS_DOMAIN, e1: 0.3, e2: 0.85, e3: 0.25,
    description:
`# Waves & Optics
The wave equation $\\partial_t^2 u = v^2\\nabla^2 u$ and its solutions: superposition, interference, diffraction, standing waves, and the Fourier decomposition that turns any signal into a sum of modes. Geometric optics (rays, Fermat's least-time principle) emerges as the short-wavelength limit of the wave picture.

Fermat's "light takes the path of least time" is the same variational shape as mechanics' least action — a hint that optics and mechanics are one principle (Hamilton saw this a century before quantum mechanics made it literal).

**Deliverable:** get the law of reflection from Fermat's principle, no calculus of derivatives — just "least time".`,
  },
  {
    id: "80000000-0000-0000-0000-000000000007",
    name: "Thermodynamics & Statistical Mechanics",
    domain: PHYSICS_DOMAIN, e1: 0.35, e2: 0.9, e3: 0.1,
    description:
`# Thermodynamics & Statistical Mechanics
Two laws you can't out-argue (energy is conserved; entropy of an isolated system doesn't decrease) and the bridge Boltzmann built between them: $S = k_B \\ln \\Omega$ — macroscopic entropy is the log of how many microstates look the same. Ensembles (microcanonical, canonical) turn "count the states" into partition functions $Z$, from which every thermodynamic quantity follows.

The move to internalize: thermodynamics is what statistics looks like when you can't see the particles. Temperature, pressure, and entropy are averages, not fundamentals.

**Deliverable:** derive the ideal-gas law from the canonical partition function of $N$ free particles.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000008",
    name: "Quantum Mechanics",
    domain: PHYSICS_DOMAIN, e1: 0.45, e2: 0.8, e3: 0.2,
    description:
`# Quantum Mechanics
State as a vector in Hilbert space, observables as Hermitian operators, evolution by Schrödinger's $i\\hbar\\,\\partial_t\\psi = H\\psi$, and measurement as projection with Born-rule probabilities $|\\langle a|\\psi\\rangle|^2$. The commutator $[x,p]=i\\hbar$ is the whole strangeness in one line: complementary observables can't be sharp together.

Where does the $i$ come from? In the GA lens the imaginary unit stops being mysterious — it's a real geometric object (a bivector that squares to $-1$), and spin falls out of the same algebra rather than being bolted on.

**Deliverable:** show $[x,p]=i\\hbar$ implies the Heisenberg uncertainty bound $\\Delta x\\,\\Delta p \\ge \\hbar/2$.`,
  },
  {
    id: "80000000-0000-0000-0000-000000000009",
    name: "Spin & Angular Momentum",
    domain: PHYSICS_DOMAIN, e1: 0.5, e2: 0.8, e3: 0.2,
    description:
`# Spin & Angular Momentum
Angular momentum in quantum mechanics is an algebra: $[J_i, J_j] = i\\hbar\\,\\epsilon_{ijk}J_k$. Its representations quantize into integer and half-integer spins; the electron's spin-½ needs the **Pauli matrices** $\\sigma_x,\\sigma_y,\\sigma_z$, and a spin-½ state returns to itself only after a $720°$ rotation — the famous double cover.

Those Pauli matrices multiply exactly like the basis vectors of 3D geometric algebra. That's not a coincidence: a "spinor" is an even-grade element of that algebra, and the weird $720°$ is what rotors do. The GA lens is where spin stops being a magic label.

**Deliverable:** verify the Pauli matrices satisfy $\\sigma_i\\sigma_j = \\delta_{ij} + i\\,\\epsilon_{ijk}\\sigma_k$ — the geometric product in disguise.`,
  },
];

// ── The Geometric-Algebra lens (GA_DOMAIN, Formal×Empirical) ─────────────────
export const GA_PLATEAUS = [
  {
    // Trailhead: ON the lens' canonical unit direction (0.71, 0.71, 0), so the
    // SEED=0.16 projection clears mp-graph's 0.15 fog on the first traverse.
    id: "90000000-0000-0000-0000-000000000001",
    name: "The Geometric Product",
    domain: GA_DOMAIN, e1: 0.71, e2: 0.71, e3: 0,
    description:
`# The Geometric Product
One product to replace the dot and the cross. For vectors $a,b$: $ab = a\\cdot b + a\\wedge b$ — a **scalar** (their alignment) plus a **bivector** (the oriented plane they span). It's associative, invertible ($a^{-1}=a/|a|^2$), and it works in every dimension, unlike the cross product.

Everything downstream is this product wearing different clothes: complex numbers are the even part in 2D, quaternions in 3D, rotations are $RxR^{-1}$, and calculus becomes one operator. Learn this and the rest of the lens is bookkeeping.

**Deliverable:** show $a\\wedge b = \\tfrac12(ab-ba)$ and $a\\cdot b = \\tfrac12(ab+ba)$, so the geometric product really does carry both.

### Worked derivation — where $\\tfrac12(ab \\pm ba)$ comes from
**Step 1 — the one axiom.** The geometric product is associative, distributes over addition, and for any vector $a a = |a|^2$ — a vector times itself is its squared length, a scalar. Everything below is bookkeeping on that single axiom.

**Step 2 — expand a squared sum.** Apply the axiom to $a + b$: $(a+b)(a+b) = |a+b|^2$, a scalar. Expand the left side with distributivity: $aa + ab + ba + bb = |a|^2 + (ab + ba) + |b|^2$. The total is a scalar and both squared terms are scalars — so the leftover $ab + ba$ must be a scalar too.

**Step 3 — split any product into two halves.** Identically, with no assumptions: $ab = \\tfrac12(ab + ba) + \\tfrac12(ab - ba)$. (Add the halves — the $ba$ terms cancel and $ab$ comes back.)

**Step 4 — identify the halves.** The symmetric half $\\tfrac12(ab+ba)$ is the scalar from step 2. Check its behavior: for perpendicular vectors $ab = -ba$ so it vanishes; for parallel ones it equals $|a||b|$ — exactly the dot product. So $a\\cdot b = \\tfrac12(ab+ba)$. The antisymmetric half flips sign when you swap $a$ and $b$ — the signature of an ORIENTED area — and vanishes when $a \\parallel b$ (no area spanned). That is the wedge: $a\\wedge b = \\tfrac12(ab-ba)$.

**Step 5 — the payoff, checked concretely.** Add them: $ab = a\\cdot b + a\\wedge b$ — the deliverable, derived. With unit axes: step 2 on $e_1 + e_2$ (where $|e_1+e_2|^2 = 2$) forces $e_1e_2 + e_2e_1 = 0$, so perpendicular vectors anticommute. Then $e_1\\cdot e_2 = 0$ ✓ and $e_1\\wedge e_2 = e_1e_2$, the unit oriented plane. One more multiply: $(e_1e_2)^2 = e_1e_2e_1e_2 = -e_1e_1e_2e_2 = -1$ — the imaginary unit was hiding in the plane all along.`,
  },
  {
    id: "90000000-0000-0000-0000-000000000002",
    name: "Bivectors: Oriented Planes",
    domain: GA_DOMAIN, e1: 0.7, e2: 0.72, e3: 0.05,
    description:
`# Bivectors: Oriented Planes
A **bivector** $a\\wedge b$ is an oriented area — a chunk of plane with a circulation, the honest object the cross product was faking. In 3D there are three basis bivectors $e_1e_2, e_2e_3, e_3e_1$; each squares to $-1$.

This is the fix for every "axial vector" in physics. Angular momentum, torque, the magnetic field, angular velocity — all are bivectors (planes), which is why they behave oddly as vectors and why they only "work" in 3D (where a plane has a unique normal). In GA they work in any dimension.

**Deliverable:** rewrite angular momentum as the bivector $L = r\\wedge p$ and say what its orientation means physically.`,
  },
  {
    id: "90000000-0000-0000-0000-000000000003",
    name: "Rotors: Rotation without Matrices",
    domain: GA_DOMAIN, e1: 0.68, e2: 0.7, e3: 0.1,
    description:
`# Rotors: Rotation without Matrices
A **rotor** is $R = e^{-B\\theta/2}$, an exponential of a bivector $B$ (the plane you turn in). It rotates ANY object by the sandwich $x \\mapsto R\\,x\\,R^{-1}$ — vectors, bivectors, whole multivectors, same formula. No matrices, no gimbal lock, and composition is just multiplication of rotors.

Rotors are the even sub-algebra: in 3D they ARE the unit quaternions; the half-angle (the $\\theta/2$) is exactly the spin-½ double cover, sitting in plain sight. This is the app's own math — garust rotors are these.

**Deliverable:** rotate a vector $90°$ in the $e_1e_2$ plane with $R = e^{-e_1e_2\\,\\pi/4}$ and confirm the sandwich gives the right answer.

### Worked derivation — why rotation is a sandwich, and why the half-angle
**Step 1 — a mirror first.** Reflecting $x$ in the plane perpendicular to a unit vector $n$ is $x \\mapsto -nxn$. Why: split $x = x_\\parallel + x_\\perp$ (along $n$, and perpendicular). From $ab + ba = 2\\,a\\cdot b$: parallel vectors commute ($n x_\\parallel = x_\\parallel n$), perpendicular ones anticommute ($n x_\\perp = -x_\\perp n$). So $-nxn = -x_\\parallel + x_\\perp$: the along-$n$ part flips, the rest survives — a mirror.

**Step 2 — two mirrors make a rotation.** Reflect in $n$, then in $m$: $x \\mapsto -m(-nxn)m = (mn)\\,x\\,(nm)$. Two reflections compose to a rotation by TWICE the angle between the mirror planes, in their common plane — try it with two hand-mirrors.

**Step 3 — name the sandwich.** Set $R = mn$ — a geometric product of two unit vectors, so a scalar plus a bivector (even-grade). Then rotation is $x \\mapsto R\\,x\\,\\tilde R$, with $\\tilde R = nm$ the reverse ($= R^{-1}$ for unit $R$). Mirrors $\\theta/2$ apart rotate by $\\theta$: the famous HALF-ANGLE enters here, geometrically — not by convention.

**Step 4 — the exponential.** Expand $R = mn = m\\cdot n + m\\wedge n = \\cos(\\theta/2) + B\\sin(\\theta/2)$, where $B$ is the unit bivector of the mirrors' plane and $B^2 = -1$. That is Euler's formula with the plane as the imaginary unit: $R = e^{B\\theta/2}$.

**Step 5 — the deliverable, worked.** $R = e^{-e_1e_2\\pi/4} = \\cos45° - e_1e_2\\sin45°$. Then $R\\,e_1\\,\\tilde R$: using $e_1e_2e_1 = -e_1e_1e_2 = -e_2$, the terms collect to $e_2$ — the $90°$ turn, on the nose.`,
  },
  {
    id: "90000000-0000-0000-0000-000000000004",
    name: "Geometric Calculus: the Vector Derivative",
    domain: GA_DOMAIN, e1: 0.72, e2: 0.66, e3: 0.1,
    description:
`# Geometric Calculus: the Vector Derivative
Grad, div, and curl are one operator: the **vector derivative** $\\nabla$. Acting with the geometric product, $\\nabla f$ splits into $\\nabla\\cdot f$ (divergence, scalar part) and $\\nabla\\wedge f$ (curl, bivector part) — the same $ab=a\\cdot b+a\\wedge b$ pattern, now for derivatives.

The payoff is a single Fundamental Theorem of Geometric Calculus that has Gauss, Stokes, Green, and Cauchy as special cases. The three operators of "Mathematical Methods" were always one.

**Deliverable:** show that $\\nabla\\wedge(\\nabla f)=0$ (curl of a gradient) is immediate from associativity, no component-chasing.`,
  },
  {
    id: "90000000-0000-0000-0000-000000000005",
    name: "Maxwell in One Equation: ∇F = J",
    domain: GA_DOMAIN, e1: 0.6, e2: 0.78, e3: 0.05,
    description:
`# Maxwell in One Equation: ∇F = J
Pack $E$ and $B$ into a single **electromagnetic bivector** $F = E + IcB$ (with $I$ the unit pseudoscalar). The four Maxwell equations become **one**: $\\nabla F = J/(\\varepsilon_0 c)$. The scalar+vector+bivector+trivector parts of that single equation ARE the four you memorized.

This isn't cosmetics: the single equation makes the Lorentz-covariance manifest (boosts just rotate $F$), makes $E$/$B$ frame-mixing obvious, and generalizes cleanly. It is the headline result of the whole GA-for-physics program.

**Deliverable:** expand $\\nabla F = J$ by grade and recover Gauss' and Ampère's laws as two of the four graded parts.

### Worked derivation — unpacking $\\nabla F = J$ into the four laws
**Step 1 — the objects.** $F = E + IcB$ (the field bivector; $I = e_1e_2e_3$ the unit pseudoscalar, $I^2 = -1$), $\\nabla$ the vector derivative, and $J$ packing the sources: a scalar part ($\\rho/\\varepsilon_0$) and a vector part (the current).

**Step 2 — one product, four grades.** The geometric product $\\nabla F$ splits by grade, exactly like $ab = a\\cdot b + a\\wedge b$ did: a scalar part $\\nabla\\cdot E$; a vector part carrying $\\partial_t E$ and $\\nabla\\times B$; a bivector part carrying $\\partial_t B$ and $\\nabla\\times E$; and a trivector part $I\\,(\\nabla\\cdot B)$.

**Step 3 — match grades on both sides.** An equation between multivectors holds grade by grade. $J$ has only scalar + vector parts, so: scalar → $\\nabla\\cdot E = \\rho/\\varepsilon_0$ (**Gauss**); vector → **Ampère–Maxwell**; bivector, source-free → **Faraday** ($\\nabla\\times E = -\\partial_t B$); trivector, source-free → $\\nabla\\cdot B = 0$ (**no monopoles**).

**Step 4 — why this is not a party trick.** The "four laws" were the four grade-components of ONE derivative all along. A Lorentz boost just rotates $F$ (mixing $E$ and $B$ — the frame-dependence you memorized), and the single equation is manifestly covariant.`,
  },
  {
    id: "90000000-0000-0000-0000-000000000006",
    name: "Spacetime Algebra (STA)",
    domain: GA_DOMAIN, e1: 0.62, e2: 0.76, e3: 0.12,
    description:
`# Spacetime Algebra (STA)
Take GA over Minkowski space: four vectors $\\gamma_0,\\dots,\\gamma_3$ with $\\gamma_0^2=+1,\\ \\gamma_i^2=-1$ — Dirac's gamma "matrices" reborn as basis vectors. A **boost** is now a rotor $e^{B\\alpha/2}$ in a time–space plane, the exact same object as a spatial rotation, just with a hyperbolic angle (rapidity).

Rotations and boosts unified as rotors is the whole point of relativity done in GA: the Lorentz group is the rotor group of spacetime, and the Dirac equation becomes a real (non-complex) equation in this algebra.

**Deliverable:** write a boost of rapidity $\\alpha$ as a rotor and show it composes with a second boost by adding rapidities.`,
  },
  {
    id: "90000000-0000-0000-0000-000000000007",
    name: "Pauli Algebra & Spinors",
    domain: GA_DOMAIN, e1: 0.66, e2: 0.74, e3: 0.14,
    description:
`# Pauli Algebra & Spinors
The Pauli matrices aren't fundamentally matrices — they're the three basis vectors of 3D geometric algebra, and $\\sigma_i\\sigma_j=\\delta_{ij}+i\\,\\epsilon_{ijk}\\sigma_k$ is just the geometric product. A **spinor** is then an even-grade multivector (a scalar + bivector), i.e. a rotor, and "spin state" means "orientation".

The mysteries dissolve: the quantum $i$ is a bivector squaring to $-1$; the $720°$ return is the rotor half-angle; a qubit is a normalized spinor. Spin was geometry all along.

**Deliverable:** identify the spin-up state with a specific rotor and show a $2\\pi$ rotation sends it to its negative (the double cover).`,
  },
];

// ── The Synthetic Infinitesimal Analysis lens (SIA_DOMAIN, Formal×Creative) ──
export const SIA_PLATEAUS = [
  {
    // Trailhead: ON the SIA canonical unit direction (0.9, 0, 0.44).
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Nilsquare Infinitesimals (ε² = 0)",
    domain: SIA_DOMAIN, e1: 0.9, e2: 0, e3: 0.44,
    description:
`# Nilsquare Infinitesimals (ε² = 0)
Synthetic Infinitesimal Analysis takes infinitesimals as *real elements of the number line* — not limits, not "arbitrarily small". The key object: a $D = \\{\\varepsilon : \\varepsilon^2 = 0\\}$ of **nilsquare** infinitesimals that are not (provably) zero yet whose square vanishes.

The price is intuitionistic logic: you must drop the law of excluded middle (you cannot assume $\\varepsilon=0$ or $\\varepsilon\\ne0$). The reward is that calculus becomes *algebra* — no epsilons, no limits, derivatives by cancellation.

**Deliverable:** explain why a NON-TRIVIAL $D$ (the nilsquares are not all zero, yet none is provably $\\ne 0$) is incompatible with the law of excluded middle.`,
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "The Derivative as Algebra (Kock–Lawvere)",
    domain: SIA_DOMAIN, e1: 0.88, e2: 0.05, e3: 0.46,
    description:
`# The Derivative as Algebra (Kock–Lawvere)
The **Kock–Lawvere axiom**: every $f$, restricted to $D$, is *exactly* linear — there is a unique number $b$ with $f(x+\\varepsilon) = f(x) + b\\,\\varepsilon$ for all nilsquare $\\varepsilon$. That $b$ IS $f'(x)$. The derivative is an algebraic identity, not a limit.

Watch it work: $f(x)=x^2$ gives $(x+\\varepsilon)^2 = x^2 + 2x\\varepsilon + \\varepsilon^2 = x^2 + 2x\\varepsilon$ (since $\\varepsilon^2=0$), so $f'(x)=2x$ — by cancellation, no limit taken. Every higher-order Taylor term dies automatically.

**Deliverable:** derive the product rule $(fg)' = f'g + fg'$ in one line using $\\varepsilon^2=0$.`,
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    name: "Microlinearity & Vector Fields",
    domain: SIA_DOMAIN, e1: 0.85, e2: 0.1, e3: 0.48,
    description:
`# Microlinearity & Vector Fields
A **tangent vector** at $p$ is literally a map $D \\to M$ sending $0 \\mapsto p$ — an infinitesimal path, a "point with a direction attached". A **vector field** assigns one to every point; its flow is generated by moving each point along its $\\varepsilon$. Spaces are *microlinear*: they look exactly linear at the infinitesimal scale, by axiom.

This makes the machinery of field theory — Lie derivatives, flows, the objects $E$ and $B$ act on — concrete: a field is an infinitesimal displacement, full stop. Differential geometry without limits.

**Deliverable:** define the tangent bundle as $M^D$ and say what a vector field is in one sentence.`,
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    name: "Least Action by Infinitesimal Variation",
    domain: SIA_DOMAIN, e1: 0.86, e2: 0.08, e3: 0.47,
    description:
`# Least Action by Infinitesimal Variation
The variational $\\delta$ of Lagrangian mechanics is exactly an SIA infinitesimal. Vary a path by $\\varepsilon\\,\\eta(t)$ with $\\varepsilon^2=0$: the action becomes $S[q] + \\varepsilon\\,\\delta S$ *identically*, because every $\\varepsilon^2$ and higher term vanishes. "$\\delta S = 0$ for all variations" is then a clean algebraic condition, and Euler–Lagrange drops out with no hand-waving about "small enough".

This is the SIA payoff for mechanics: the least-action principle, and thus all of Lagrangian/Hamiltonian physics, becomes honest algebra.

**Deliverable:** redo the Euler–Lagrange derivation with a nilsquare variation and point to exactly where $\\varepsilon^2=0$ is used.`,
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    name: "Synthetic Differential Geometry",
    domain: SIA_DOMAIN, e1: 0.84, e2: 0.14, e3: 0.46,
    description:
`# Synthetic Differential Geometry
Scale up: curvature, connections, and metrics built directly from infinitesimals. An **infinitesimal square** (two nilsquare displacements) fails to close by an amount that *is* the curvature; a connection is a rule for infinitesimal parallel transport. This is the synthetic route to the geometry general relativity needs.

It's the natural summit of this lens and the meeting point with the GA lens: both give you differential geometry without the analytic scaffolding — one through the algebra of *space* (multivectors), the other through the algebra of the *infinitesimal* (ε² = 0).

**Deliverable:** describe how the non-closure of an infinitesimal parallelogram encodes curvature.`,
  },
];

/** All plateaus this module seeds — physics core + the two lenses. */
export const PHYS_LENS_PLATEAUS = [...PHYS_PLATEAUS, ...GA_PLATEAUS, ...SIA_PLATEAUS];

// ── Bridges: prerequisite spine + cross-lens reframings + meet crossings ─────
export const PHYS_LENS_BRIDGES = [
  // physics prerequisite spine
  { id: "b0000000-0000-0000-0000-000000000001", from: "80000000-0000-0000-0000-000000000002", to: MOTION, concept: "Newton's laws — the ground under Lagrangian mechanics" },
  { id: "b0000000-0000-0000-0000-000000000002", from: "80000000-0000-0000-0000-000000000001", to: "80000000-0000-0000-0000-000000000002", concept: "vector calculus & variation are the tools of mechanics" },
  { id: "b0000000-0000-0000-0000-000000000003", from: "80000000-0000-0000-0000-000000000002", to: "80000000-0000-0000-0000-000000000003", concept: "rigid-body motion is mechanics with rotation" },
  { id: "b0000000-0000-0000-0000-000000000004", from: "80000000-0000-0000-0000-000000000001", to: "80000000-0000-0000-0000-000000000004", concept: "grad/div/curl build the Maxwell equations" },
  { id: "b0000000-0000-0000-0000-000000000005", from: "80000000-0000-0000-0000-000000000004", to: "80000000-0000-0000-0000-000000000005", concept: "the invariance of c forces special relativity" },
  { id: "b0000000-0000-0000-0000-000000000006", from: "80000000-0000-0000-0000-000000000004", to: "80000000-0000-0000-0000-000000000006", concept: "light is a wave in the electromagnetic field" },
  { id: "b0000000-0000-0000-0000-000000000007", from: "80000000-0000-0000-0000-000000000001", to: "80000000-0000-0000-0000-000000000007", concept: "phase-space counting → thermodynamics" },
  { id: "b0000000-0000-0000-0000-000000000008", from: "80000000-0000-0000-0000-000000000002", to: "80000000-0000-0000-0000-000000000008", concept: "Hamiltonian mechanics is the doorway to quantum mechanics" },
  { id: "b0000000-0000-0000-0000-000000000009", from: "80000000-0000-0000-0000-000000000008", to: "80000000-0000-0000-0000-000000000009", concept: "angular momentum quantizes into spin" },

  // GA lens internal spine
  { id: "b0000000-0000-0000-0000-000000000010", from: "90000000-0000-0000-0000-000000000001", to: "90000000-0000-0000-0000-000000000002", concept: "the wedge of the geometric product IS the bivector" },
  { id: "b0000000-0000-0000-0000-000000000011", from: "90000000-0000-0000-0000-000000000002", to: "90000000-0000-0000-0000-000000000003", concept: "exponentiate a bivector to get a rotor" },
  { id: "b0000000-0000-0000-0000-000000000012", from: "90000000-0000-0000-0000-000000000001", to: "90000000-0000-0000-0000-000000000004", concept: "the geometric product, applied to ∂, is the vector derivative" },
  { id: "b0000000-0000-0000-0000-000000000013", from: "90000000-0000-0000-0000-000000000004", to: "90000000-0000-0000-0000-000000000005", concept: "∇ acting on the field bivector F gives Maxwell" },
  { id: "b0000000-0000-0000-0000-000000000014", from: "90000000-0000-0000-0000-000000000003", to: "90000000-0000-0000-0000-000000000006", concept: "boosts are rotors too — extend to spacetime" },
  { id: "b0000000-0000-0000-0000-000000000015", from: "90000000-0000-0000-0000-000000000002", to: "90000000-0000-0000-0000-000000000007", concept: "even-grade multivectors are spinors" },

  // SIA lens internal spine
  { id: "b0000000-0000-0000-0000-000000000016", from: "a0000000-0000-0000-0000-000000000001", to: "a0000000-0000-0000-0000-000000000002", concept: "ε²=0 makes the derivative an algebraic identity" },
  { id: "b0000000-0000-0000-0000-000000000017", from: "a0000000-0000-0000-0000-000000000002", to: "a0000000-0000-0000-0000-000000000003", concept: "a tangent vector is an infinitesimal path D→M" },
  { id: "b0000000-0000-0000-0000-000000000018", from: "a0000000-0000-0000-0000-000000000002", to: "a0000000-0000-0000-0000-000000000004", concept: "the variation δ is a nilsquare infinitesimal" },
  { id: "b0000000-0000-0000-0000-000000000019", from: "a0000000-0000-0000-0000-000000000003", to: "a0000000-0000-0000-0000-000000000005", concept: "infinitesimal squares encode curvature" },

  // cross-lens: physics ⟷ its GA reframing
  { id: "b0000000-0000-0000-0000-000000000020", from: "90000000-0000-0000-0000-000000000003", to: "80000000-0000-0000-0000-000000000003", concept: "rotors are rotational mechanics without matrices or gimbal lock" },
  { id: "b0000000-0000-0000-0000-000000000021", from: "90000000-0000-0000-0000-000000000005", to: "80000000-0000-0000-0000-000000000004", concept: "∇F = J is the four Maxwell equations, once" },
  { id: "b0000000-0000-0000-0000-000000000022", from: "90000000-0000-0000-0000-000000000006", to: "80000000-0000-0000-0000-000000000005", concept: "spacetime algebra makes boosts and rotations one object" },
  { id: "b0000000-0000-0000-0000-000000000023", from: "90000000-0000-0000-0000-000000000007", to: "80000000-0000-0000-0000-000000000009", concept: "spin is an even-grade multivector, not a magic label" },
  { id: "b0000000-0000-0000-0000-000000000024", from: "90000000-0000-0000-0000-000000000002", to: "80000000-0000-0000-0000-000000000004", concept: "the magnetic field is a bivector, not an axial vector" },

  // cross-lens: physics ⟷ its SIA reframing
  { id: "b0000000-0000-0000-0000-000000000025", from: "a0000000-0000-0000-0000-000000000002", to: "80000000-0000-0000-0000-000000000001", concept: "calculus without limits — the derivative by cancellation" },
  { id: "b0000000-0000-0000-0000-000000000026", from: "a0000000-0000-0000-0000-000000000004", to: "80000000-0000-0000-0000-000000000002", concept: "least action, done honestly with ε²=0" },
  { id: "b0000000-0000-0000-0000-000000000027", from: "a0000000-0000-0000-0000-000000000003", to: "80000000-0000-0000-0000-000000000004", concept: "a field is an infinitesimal displacement at every point" },
  { id: "b0000000-0000-0000-0000-000000000028", from: "a0000000-0000-0000-0000-000000000005", to: "80000000-0000-0000-0000-000000000005", concept: "synthetic geometry is the road to curved spacetime" },

  // (meet) — cross INTO the existing quantum-computing math island
  { id: "b0000000-0000-0000-0000-000000000029", from: "90000000-0000-0000-0000-000000000001", to: CLIFFORD, concept: "(meet) the geometric product IS the Clifford product Cl(V,Q)" },
  { id: "b0000000-0000-0000-0000-000000000030", from: "90000000-0000-0000-0000-000000000003", to: TAU_ROTORS, concept: "(meet) same rotors the qubit-gate island already uses" },
  { id: "b0000000-0000-0000-0000-000000000031", from: "90000000-0000-0000-0000-000000000007", to: QUBIT_SPINOR, concept: "(meet) a spinor is a qubit is an even-grade multivector" },
  { id: "b0000000-0000-0000-0000-000000000032", from: "a0000000-0000-0000-0000-000000000001", to: SIA_KOCK, concept: "(meet) the same Kock–Lawvere infinitesimals the logic island builds" },
];

// A few canonical references — the books that teach these lenses (R-0027 shape).
export const PHYS_LENS_RESOURCES = [
  { id: "c0000000-0000-0000-0000-000000000001", plateau: "90000000-0000-0000-0000-000000000001", title: "Doran & Lasenby — Geometric Algebra for Physicists", kind: "Book", uri: "https://www.cambridge.org/9780521715959" },
  { id: "c0000000-0000-0000-0000-000000000002", plateau: "90000000-0000-0000-0000-000000000006", title: "Hestenes — Space-Time Algebra", kind: "Book", uri: "https://link.springer.com/book/10.1007/978-3-319-18413-5" },
  { id: "c0000000-0000-0000-0000-000000000003", plateau: "a0000000-0000-0000-0000-000000000001", title: "Bell — A Primer of Infinitesimal Analysis", kind: "Book", uri: "https://www.cambridge.org/9780521887182" },
  { id: "c0000000-0000-0000-0000-000000000004", plateau: "90000000-0000-0000-0000-000000000005", title: "Hestenes — Oersted Medal Lecture: Reforming the Mathematical Language of Physics", kind: "Article", uri: "https://davidhestenes.net/geocalc/pdf/OerstedMedalLecture.pdf" },
  // Rotors ← the canonical rotors-not-quaternions piece (owner-added). Namespace note:
  // c…0005/0006 are physics-core's, so this phys-lens resource takes the next free c…0007.
  { id: "c0000000-0000-0000-0000-000000000007", plateau: "90000000-0000-0000-0000-000000000003", title: "Marc ten Bosch — Let's remove Quaternions from every 3D Engine (interactive)", kind: "Interactive", uri: "https://marctenbosch.com/quaternions/" },
];

// (The physics-degree CORE numbered path moved to physics-core-curriculum.js in
// R-0066, where it's rebuilt over the granular intro→advanced sequence.)

// A followable route: enter through GA, re-derive the physics, end at the summit
// where the GA and SIA lenses meet on differential geometry (R-0039 shape).
export const PHYS_LENS_PATHS = [
  {
    id: "d0000000-0000-0000-0000-000000000001",
    title: "Physics through Geometric Algebra",
    goal: "Re-derive the physics core in the algebra of space — rotations, Maxwell, relativity, spin — then meet the synthetic view.",
    steps: [
      "90000000-0000-0000-0000-000000000001", // The Geometric Product
      "90000000-0000-0000-0000-000000000002", // Bivectors
      "90000000-0000-0000-0000-000000000003", // Rotors
      "90000000-0000-0000-0000-000000000004", // Geometric Calculus
      "90000000-0000-0000-0000-000000000005", // Maxwell ∇F=J
      "90000000-0000-0000-0000-000000000006", // Spacetime Algebra
      "90000000-0000-0000-0000-000000000007", // Spinors
      "a0000000-0000-0000-0000-000000000005", // Synthetic Differential Geometry (the meet)
    ],
    domains: [GA_DOMAIN, SIA_DOMAIN],
  },
];
