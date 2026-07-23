// universitam-curriculum.js — the owner's ACTUAL degree, as a lens (R-0096).
//
// Source: "Mapa Curricular — Licenciatura en Física", plan FÍSICA-2019,
// Universitario Tecnológico Terra at Mundi Universitam. Modalidad no
// escolarizada, ciclo cuatrimestral (14 semanas), currículo fijo: 49 asignaturas
// across 10 cuatrimestres, 1888 h con docente + 4208 independientes, 381 créditos.
// Every clave, seriación and cuatrimestre below is transcribed from that map.
//
// Why this is its own lens rather than more Physics plateaus: it is not "physics
// knowledge", it is ONE INSTITUTION'S ROUTE through it — fixed order, prerequisite
// chains, credits, an exam at the end of each. The Physics lens answers "how does
// the world work"; this lens answers "what do I have to pass, and in what order".
// Keeping them apart is what lets the same topic be studied twice (see below).
//
// ── The parallel-view design ────────────────────────────────────────────────
// The owner studies each topic TWICE, deliberately: the orthodox treatment the
// syllabus examines, and an alternative-formalism treatment of the same content —
// GA (Geometric Algebra) for the geometry/algebra/mechanics topics, SIA (Synthetic
// Infinitesimal Analysis) for the calculus sequence. So a course plateau here is
// joined by a cross-lens bridge to a TWIN plateau living in GA_DOMAIN or
// SIA_DOMAIN. The twin is a first-class plateau in its own lens (publishable and
// adoptable on its own, R-0093), and the edge between the two lenses is exactly
// the domain meet the model is built on (RFC-0002). Bridge concept is always
// "alternative formulation of" so the relationship is machine-findable.
//
// Twin depth follows where the owner actually is: cuatrimestres 1–3 get written
// twins; later cuatrimestres carry the course plateau only, and their twins get
// written as the degree advances.
//
// Same contract as the other curricula: pure data, fixed ids in a reserved
// namespace (courses a1…, GA twins a2…, SIA twins a3…, bridges a4…), idempotently
// upserted by main.js.

// The degree's own lens is declared in persona.js alongside the other domains, so
// DOMAINS stays the single list of lenses and this module has no cycle with it.
import { GA_DOMAIN, SIA_DOMAIN, UNIVERSITAM_DOMAIN } from "./persona.js";

export { UNIVERSITAM_DOMAIN };

const U = (n) => `a1000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const GA = (n) => `a2000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const SIA = (n) => `a3000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const BR = (n) => `a4000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

// Course-plateau helper: every course carries its clave, cuatrimestre, créditos
// and seriación in the body, so the map itself is the record — the PDF is not
// needed to know what a topic is or what it depends on.
function course({ n, name, clave, cuatri, creditos, seriacion, e1, e2, e3, body }) {
  const ser = seriacion ? `**Seriación:** requiere ${seriacion}` : "**Seriación:** ninguna";
  return {
    id: U(n),
    name,
    domain: UNIVERSITAM_DOMAIN,
    e1, e2, e3,
    description:
`# ${name}

*${clave} · Cuatrimestre ${cuatri} · ${creditos} créditos · Licenciatura en Física (FÍSICA-2019)*

${ser}

${body}`,
  };
}

// ── Cuatrimestre 1 ───────────────────────────────────────────────────────────
export const UNIVERSITAM_PLATEAUS = [
  course({
    n: 1, name: "Introducción al cálculo", clave: "FIS-1901", cuatri: 1, creditos: 7,
    e1: 0.85, e2: 0.35, e3: 0.05,
    body:
`The on-ramp to the whole calculus sequence: functions and their graphs, the idea of a **limit**, continuity, and the first derivatives as slopes of tangent lines. Nothing here is hard once the limit is believed — and the limit is exactly the piece the alternative (SIA) view refuses to use.

**What the exam wants:** compute limits (including $0/0$ by factoring and by L'Hôpital once available), decide continuity at a point, differentiate polynomials and the standard library by rule.

**Deliverable:** a one-page table of the derivative rules you can reproduce from memory, each with the limit definition it comes from.`,
  }),
  course({
    n: 2, name: "Introducción al álgebra", clave: "FIS-1902", cuatri: 1, creditos: 7,
    e1: 0.9, e2: 0.15, e3: 0.1,
    body:
`Algebraic manipulation as a reliable instrument: polynomials, factoring, rational expressions, exponents and radicals, linear and quadratic equations, systems in two unknowns, inequalities and absolute value.

**What the exam wants:** speed and accuracy. Most later failures in Cálculo are algebra failures wearing a calculus costume.

**Deliverable:** solve a mixed set of 20 without a calculator, and write down which *kind* of slip each error was (sign, distribution, domain).`,
  }),
  course({
    n: 3, name: "Introducción a la Física", clave: "FIS-1903", cuatri: 1, creditos: 7,
    e1: 0.4, e2: 0.9, e3: 0.15,
    body:
`What physics *is* before the machinery arrives: units and dimensional analysis, SI, significant figures, scalars vs vectors, measurement and uncertainty, and the habit of estimating an answer before computing it.

**What the exam wants:** dimensional consistency checks, unit conversion, vector addition by components, reading uncertainty.

**Deliverable:** a Fermi estimate (order of magnitude, stated assumptions) for a quantity you cannot look up — then find the real value and account for the gap.`,
  }),
  course({
    n: 4, name: "Lógica y Conjuntos", clave: "FIS-1904", cuatri: 1, creditos: 7,
    e1: 0.95, e2: 0.05, e3: 0.15,
    body:
`Propositional and predicate logic, truth tables, quantifiers, methods of proof (direct, contrapositive, contradiction, induction), sets, operations, relations, functions, cardinality.

**What the exam wants:** write a correct proof and spot an incorrect one; negate a quantified statement without fumbling the order.

**Deliverable:** prove one statement three ways (direct, contrapositive, contradiction) and say which reads best and why.`,
  }),
  course({
    n: 5, name: "Inglés III", clave: "FIS-1905", cuatri: 1, creditos: 7,
    e1: 0.2, e2: 0.3, e3: 0.6,
    body:
`Language requirement. Worth treating as a physics tool rather than a chore: the literature, the documentation and nearly every primary source you will need for the rest of this degree are in English.

**Deliverable:** read one short English physics passage (a textbook section or an abstract) and summarise it in English without translating word-by-word.`,
  }),

  // ── Cuatrimestre 2 ─────────────────────────────────────────────────────────
  course({
    n: 6, name: "Cálculo I", clave: "FIS-1906", cuatri: 2, creditos: 9,
    e1: 0.88, e2: 0.4, e3: 0.05,
    body:
`Differential calculus proper: limits made precise, continuity, the derivative and its rules (product, quotient, chain), implicit differentiation, related rates, extrema, the Mean Value Theorem, curve sketching, optimization.

**What the exam wants:** differentiate anything the standard library can express, and set up an optimization or related-rate word problem correctly — the setup is where the marks are.

**Deliverable:** an optimization problem solved end-to-end, with the domain of the variable justified (not assumed).`,
  }),
  course({
    n: 7, name: "Álgebra Superior", clave: "FIS-1907", cuatri: 2, creditos: 7,
    e1: 0.92, e2: 0.1, e3: 0.15,
    body:
`Beyond manipulation into structure: mathematical induction, the binomial theorem, **complex numbers** (polar form, De Moivre, roots of unity), polynomials over $\\mathbb{C}$, the fundamental theorem of algebra, systems and matrices.

**What the exam wants:** fluency with $\\mathbb{C}$ in both rectangular and polar form, and induction proofs that actually close.

**Deliverable:** find all $n$-th roots of a complex number and plot them; explain why they are equally spaced on a circle.`,
  }),
  course({
    n: 8, name: "Óptica", clave: "FIS-1908", cuatri: 2, creditos: 9,
    e1: 0.35, e2: 0.9, e3: 0.25,
    body:
`Geometric optics — reflection, refraction and Snell's law, mirrors and thin lenses, image formation and the lensmaker's equation — then the wave side: interference, Young's double slit, diffraction, polarization.

**What the exam wants:** ray diagrams drawn correctly and sign conventions applied consistently; the thin-lens equation used without sign errors.

**Deliverable:** trace an image through a two-lens system by diagram, then confirm it by calculation.`,
  }),
  course({
    n: 9, name: "Geometría Analítica", clave: "FIS-1909", cuatri: 2, creditos: 7,
    e1: 0.8, e2: 0.35, e3: 0.3,
    body:
`Geometry rendered in coordinates: distance and midpoint, the straight line in all its forms, circles, and the conic sections (parabola, ellipse, hyperbola) by equation, by focus-directrix, and under translation and rotation of axes.

**What the exam wants:** identify a conic from its general second-degree equation and put it in standard form — including the rotation that kills the $xy$ term.

**Deliverable:** take one general second-degree equation, classify it, rotate and translate to standard form, and sketch it with foci marked.`,
  }),
  course({
    n: 10, name: "Inglés II", clave: "FIS-1910", cuatri: 2, creditos: 7,
    e1: 0.2, e2: 0.3, e3: 0.6,
    body:
`Continued language requirement.

**Deliverable:** write a short technical description in English of an experiment you have actually done.`,
  }),

  // ── Cuatrimestre 3 ─────────────────────────────────────────────────────────
  course({
    n: 11, name: "Cálculo II", clave: "FIS-1911", cuatri: 3, creditos: 9, seriacion: "FIS-1906 (Cálculo I)",
    e1: 0.88, e2: 0.42, e3: 0.05,
    body:
`Integral calculus: the definite integral as a limit of Riemann sums, the **Fundamental Theorem** in both parts, techniques (substitution, by parts, partial fractions, trigonometric), improper integrals, then applications — area, volume, arc length, work — and infinite sequences and series with Taylor expansions.

**What the exam wants:** choose the right technique quickly, and get convergence tests right.

**Deliverable:** derive a Taylor series from scratch and state its interval of convergence with the test that establishes it.`,
  }),
  course({
    n: 12, name: "Álgebra Lineal I", clave: "FIS-1912", cuatri: 3, creditos: 7, seriacion: "FIS-1907 (Álgebra Superior)",
    e1: 0.93, e2: 0.2, e3: 0.15,
    body:
`Vector spaces and linear maps: systems and Gaussian elimination, matrix algebra, determinants, subspaces, span, linear independence, basis and dimension, rank, and the matrix of a linear transformation.

**What the exam wants:** row-reduce reliably, and read off rank, nullity and a basis from the reduced form.

**Deliverable:** take one linear map, write its matrix in two different bases, and exhibit the change-of-basis matrix relating them.`,
  }),
  course({
    n: 13, name: "Ecuaciones Diferenciales Ordinarias", clave: "FIS-1913", cuatri: 3, creditos: 9,
    e1: 0.82, e2: 0.55, e3: 0.1,
    body:
`First-order ODEs (separable, linear, exact, integrating factors), second-order linear equations with constant coefficients, undetermined coefficients and variation of parameters, and the physical archetypes: exponential growth/decay, the damped and driven harmonic oscillator, resonance.

**What the exam wants:** classify the equation first, then apply the matching method — misclassification is the usual failure.

**Deliverable:** solve the damped driven oscillator and identify, from the solution, the transient and the steady state.`,
  }),
  course({
    n: 14, name: "Programación I", clave: "FIS-1914", cuatri: 3, creditos: 7,
    e1: 0.75, e2: 0.25, e3: 0.55,
    body:
`Programming fundamentals: variables and types, control flow, functions, arrays/lists, files, and the discipline of decomposing a problem into testable pieces.

**Deliverable:** a program that numerically integrates a function and compares its answer to the analytic value, reporting the error.`,
  }),
  course({
    n: 15, name: "Física I", clave: "FIS-1915", cuatri: 3, creditos: 7, seriacion: "FIS-1903 (Introducción a la Física)",
    e1: 0.45, e2: 0.92, e3: 0.1,
    body:
`Classical mechanics with calculus behind it: kinematics in one and two dimensions, Newton's three laws, friction, circular motion, work and kinetic energy, potential energy and conservation, momentum and collisions, and rotation — torque, moment of inertia, angular momentum.

**What the exam wants:** a correct free-body diagram. Almost every mechanics error is a force that was drawn wrong or not drawn at all.

**Deliverable:** solve one problem twice — once by Newton's laws, once by energy conservation — and show the answers agree.`,
  }),
  course({
    n: 16, name: "Inglés I", clave: "FIS-1916", cuatri: 3, creditos: 7,
    e1: 0.2, e2: 0.3, e3: 0.6,
    body: `Final course of the language requirement.`,
  }),

  // ── Cuatrimestre 4 ─────────────────────────────────────────────────────────
  course({
    n: 17, name: "Cálculo III", clave: "FIS-1917", cuatri: 4, creditos: 9, seriacion: "FIS-1911 (Cálculo II)",
    e1: 0.88, e2: 0.45, e3: 0.08,
    body:
`Multivariable calculus: functions of several variables, partial derivatives, the gradient and directional derivatives, the chain rule in several variables, extrema and Lagrange multipliers, multiple integrals in Cartesian, polar, cylindrical and spherical coordinates.

**Deliverable:** a constrained optimization solved by Lagrange multipliers, with the geometric meaning of $\\nabla f = \\lambda \\nabla g$ stated in words.`,
  }),
  course({
    n: 18, name: "Álgebra Lineal II", clave: "FIS-1918", cuatri: 4, creditos: 7, seriacion: "FIS-1912 (Álgebra Lineal I)",
    e1: 0.93, e2: 0.25, e3: 0.15,
    body:
`Inner product spaces, orthogonality and Gram–Schmidt, **eigenvalues and eigenvectors**, diagonalization, symmetric and Hermitian operators, the spectral theorem, quadratic forms, and Jordan form.

**Deliverable:** diagonalize a symmetric matrix and interpret its eigenvectors as the principal axes of the quadratic form it defines.`,
  }),
  course({
    n: 19, name: "Programación II", clave: "FIS-1919", cuatri: 4, creditos: 7, seriacion: "FIS-1914 (Programación I)",
    e1: 0.75, e2: 0.3, e3: 0.55,
    body:
`Data structures and algorithms, modularity, and scientific computing practice.

**Deliverable:** implement an ODE integrator (Euler and RK4) and show the error scaling of each.`,
  }),
  course({
    n: 20, name: "Física II", clave: "FIS-1920", cuatri: 4, creditos: 7, seriacion: "FIS-1915 (Física I)",
    e1: 0.45, e2: 0.92, e3: 0.1,
    body:
`Continuation of mechanics into oscillations, waves, fluids and gravitation: simple harmonic motion, damped and driven oscillations, mechanical waves and superposition, sound, statics and dynamics of fluids, and Newtonian gravitation with Kepler's laws.

**Deliverable:** derive the period of a physical pendulum and check the small-angle limit against the simple pendulum.`,
  }),
  course({
    n: 21, name: "Electromagnetismo I", clave: "FIS-1921", cuatri: 4, creditos: 9,
    e1: 0.6, e2: 0.85, e3: 0.1,
    body:
`Electrostatics: Coulomb's law, the electric field, Gauss's law and its use on symmetric charge distributions, electric potential and energy, conductors, capacitance, dielectrics, and steady currents with DC circuits.

**Deliverable:** compute one field by Gauss's law and the same field by direct integration; the agreement is the point.`,
  }),

  // ── Cuatrimestre 5 ─────────────────────────────────────────────────────────
  course({
    n: 22, name: "Cálculo IV", clave: "FIS-1922", cuatri: 5, creditos: 9, seriacion: "FIS-1917 (Cálculo III)",
    e1: 0.88, e2: 0.5, e3: 0.08,
    body:
`Vector calculus: line and surface integrals, conservative fields and potentials, divergence and curl, and the integral theorems — **Green, Stokes and the divergence theorem** — which are the mathematical body of Maxwell's equations.

**Deliverable:** verify Stokes' theorem on one concrete surface by computing both sides independently.`,
  }),
  course({
    n: 23, name: "Estadística", clave: "FIS-1923", cuatri: 5, creditos: 7,
    e1: 0.8, e2: 0.55, e3: 0.1,
    body:
`Probability and statistics for experimental work: distributions, expectation and variance, the normal and Poisson distributions, sampling, estimation, confidence intervals, hypothesis testing, and least-squares fitting.

**Deliverable:** fit a line to real measured data and report the uncertainty on the slope, not just the slope.`,
  }),
  course({
    n: 24, name: "Ecuaciones Diferenciales (II)", clave: "FIS-1924", cuatri: 5, creditos: 7,
    e1: 0.85, e2: 0.5, e3: 0.1,
    body:
`Second differential-equations course. **Note:** the curricular map prints this as "Ecuaciones Diferenciales Ordinarias" again, the same title as FIS-1913 in cuatrimestre 3 — almost certainly a typo for *Ecuaciones Diferenciales Parciales*, which is what a physics degree needs at this point and what Electromagnetismo II and Mecánica Cuántica assume. Verify with your coordinación.

Expected content either way: series solutions and special functions, Sturm–Liouville problems, Fourier series, and the separation of variables applied to the heat, wave and Laplace equations.

**Deliverable:** solve the 1-D wave equation on a finite string by separation of variables and interpret the normal modes physically.`,
  }),
  course({
    n: 25, name: "Física III", clave: "FIS-1925", cuatri: 5, creditos: 7, seriacion: "FIS-1920 (Física II)",
    e1: 0.45, e2: 0.92, e3: 0.12,
    body:
`Thermal physics and continued waves: temperature, heat and calorimetry, kinetic theory of gases, the laws of thermodynamics in their introductory form, and electromagnetic waves.

**Deliverable:** compute the efficiency of a cycle and show it cannot exceed Carnot.`,
  }),
  course({
    n: 26, name: "Electromagnetismo II", clave: "FIS-1926", cuatri: 5, creditos: 9, seriacion: "FIS-1921 (Electromagnetismo I)",
    e1: 0.62, e2: 0.85, e3: 0.12,
    body:
`Magnetism and induction through to the full theory: magnetic fields and forces, Biot–Savart and Ampère's law, magnetic materials, Faraday's law and inductance, displacement current, and **Maxwell's equations** assembled — then electromagnetic waves, energy flow and the Poynting vector.

**Deliverable:** derive the wave equation from Maxwell's equations in vacuum and read the speed of light off the constants.`,
  }),

  // ── Cuatrimestre 6 ─────────────────────────────────────────────────────────
  course({
    n: 27, name: "Física IV", clave: "FIS-1927", cuatri: 6, creditos: 7, seriacion: "FIS-1925 (Física III)",
    e1: 0.45, e2: 0.9, e3: 0.15,
    body:
`The bridge into modern physics: special relativity kinematics, the photoelectric effect, atomic spectra and the Bohr model, wave–particle duality and the de Broglie wavelength.

**Deliverable:** compute a relativistic time dilation and the same problem's Newtonian answer; state the velocity at which the difference becomes measurable.`,
  }),
  course({
    n: 28, name: "Termodinámica", clave: "FIS-1928", cuatri: 6, creditos: 9,
    e1: 0.6, e2: 0.85, e3: 0.1,
    body:
`Thermodynamics properly: state variables and equations of state, the first law and work, the second law, entropy, thermodynamic potentials (Helmholtz, Gibbs, enthalpy), Maxwell relations, phase transitions.

**Deliverable:** derive one Maxwell relation from the exactness of a potential's differential and say what it lets you measure indirectly.`,
  }),
  course({
    n: 29, name: "Física Moderna", clave: "FIS-1929", cuatri: 6, creditos: 7,
    e1: 0.5, e2: 0.88, e3: 0.18,
    body:
`Relativity and quanta as a coherent story: Lorentz transformations, relativistic energy and momentum, blackbody radiation, the Compton effect, atomic structure, X-rays, and an introduction to the nucleus.

**Deliverable:** explain the photoelectric effect in terms of what classical wave theory predicts and what is actually observed.`,
  }),
  course({
    n: 30, name: "Mecánica Cuántica I", clave: "FIS-1930", cuatri: 6, creditos: 9,
    e1: 0.75, e2: 0.72, e3: 0.15,
    body:
`The formalism: the wavefunction and Born's rule, the Schrödinger equation, the infinite and finite square well, the harmonic oscillator, tunnelling, operators and observables, expectation values, and the uncertainty principle.

**Deliverable:** solve the infinite square well from scratch and show the normalization and orthogonality of its eigenfunctions.`,
  }),

  // ── Cuatrimestre 7 ─────────────────────────────────────────────────────────
  course({
    n: 31, name: "Física Estadística I", clave: "FIS-1931", cuatri: 7, creditos: 7,
    e1: 0.8, e2: 0.7, e3: 0.1,
    body:
`Statistical mechanics from microstates: ensembles, the partition function, the Boltzmann distribution, entropy as $S = k_B \\ln \\Omega$, and the derivation of thermodynamics from counting.

**Deliverable:** compute the partition function of a two-level system and recover its heat capacity.`,
  }),
  course({
    n: 32, name: "Electrónica Analógica", clave: "FIS-1932", cuatri: 7, creditos: 7,
    e1: 0.4, e2: 0.85, e3: 0.35,
    body:
`Circuits as instruments: diodes, transistors, biasing, amplifiers, operational amplifiers and feedback, filters.

**Deliverable:** design, build and measure an op-amp amplifier; compare measured gain to design gain.`,
  }),
  course({
    n: 33, name: "Mecánica Cuántica II", clave: "FIS-1933", cuatri: 7, creditos: 9, seriacion: "FIS-1930 (Mecánica Cuántica I)",
    e1: 0.78, e2: 0.7, e3: 0.15,
    body:
`Quantum mechanics in three dimensions: angular momentum and its algebra, spherical harmonics, the hydrogen atom, **spin**, addition of angular momenta, and identical particles.

**Deliverable:** work out the allowed states of two spin-½ particles and identify the singlet and triplet.`,
  }),
  course({
    n: 34, name: "Metrología", clave: "FIS-1834", cuatri: 7, creditos: 5,
    e1: 0.5, e2: 0.9, e3: 0.1,
    body:
`Measurement science: standards and traceability, the SI base units and their modern definitions, calibration, error analysis and propagation, instrument characteristics.

*(The map prints the clave as FIS-1834; by position in the sequence this is almost certainly FIS-1934.)*

**Deliverable:** propagate uncertainty through a multi-step measurement and identify which single term dominates the final error.`,
  }),
  course({
    n: 35, name: "Astronomía", clave: "FIS-1935", cuatri: 7, creditos: 7,
    e1: 0.4, e2: 0.9, e3: 0.25,
    body:
`Positional and observational astronomy: celestial coordinates, the sky's motion, telescopes, stellar magnitudes and spectra, the HR diagram, the solar system.

*(No clave is printed on the map for this subject; FIS-1935 is inferred from position.)*

**Deliverable:** identify a star's place on the HR diagram from its colour and luminosity, and say what that implies about its life stage.`,
  }),

  // ── Cuatrimestre 8 ─────────────────────────────────────────────────────────
  course({
    n: 36, name: "Física Estadística II", clave: "FIS-1936", cuatri: 8, creditos: 7, seriacion: "FIS-1931 (Física Estadística I)",
    e1: 0.82, e2: 0.7, e3: 0.12,
    body:
`Quantum statistics: Fermi–Dirac and Bose–Einstein distributions, the degenerate Fermi gas, Bose–Einstein condensation, blackbody radiation from the photon gas, and phase transitions.

**Deliverable:** show how both quantum distributions reduce to Boltzmann in the dilute limit.`,
  }),
  course({
    n: 37, name: "Electrónica Digital", clave: "FIS-1937", cuatri: 8, creditos: 7,
    e1: 0.6, e2: 0.7, e3: 0.45,
    body:
`Boolean algebra, logic gates, combinational and sequential circuits, flip-flops, counters, registers, and an introduction to microprocessors.

**Deliverable:** design a small sequential circuit from a state diagram and verify its truth table.`,
  }),
  course({
    n: 38, name: "Mecánica Cuántica III", clave: "FIS-1938", cuatri: 8, creditos: 9, seriacion: "FIS-1933 (Mecánica Cuántica II)",
    e1: 0.8, e2: 0.68, e3: 0.15,
    body:
`Approximation and application: time-independent and time-dependent perturbation theory, the variational method, WKB, scattering, selection rules and transitions.

**Deliverable:** compute a first-order energy correction and state the condition under which the perturbation expansion is trustworthy.`,
  }),
  course({
    n: 39, name: "Física Nuclear", clave: "FIS-1939", cuatri: 8, creditos: 9,
    e1: 0.55, e2: 0.88, e3: 0.12,
    body:
`Nuclear structure and processes: binding energy and the semi-empirical mass formula, the shell model, radioactive decay, fission and fusion, and nuclear reactions.

**Deliverable:** compute the energy released in one fusion reaction from the mass defect.`,
  }),
  course({
    n: 40, name: "Astrofísica", clave: "FIS-1940", cuatri: 8, creditos: 7,
    e1: 0.5, e2: 0.9, e3: 0.2,
    body:
`Stellar structure and evolution, nucleosynthesis, stellar remnants (white dwarfs, neutron stars, black holes), galaxies, and introductory cosmology.

**Deliverable:** estimate the main-sequence lifetime of a star from its mass and explain the scaling.`,
  }),

  // ── Cuatrimestre 9 ─────────────────────────────────────────────────────────
  course({
    n: 41, name: "Topología", clave: "FIS-1941", cuatri: 9, creditos: 9,
    e1: 0.95, e2: 0.15, e3: 0.25,
    body:
`Topological spaces, open and closed sets, continuity, compactness, connectedness, metric spaces, and an introduction to homotopy — the language behind modern geometric physics.

**Deliverable:** prove that continuity in the $\\varepsilon$–$\\delta$ sense and the preimage-of-open-sets sense agree on metric spaces.`,
  }),
  course({
    n: 42, name: "Física Computacional I", clave: "FIS-1942", cuatri: 9, creditos: 7,
    e1: 0.75, e2: 0.6, e3: 0.45,
    body:
`Numerical methods for physics: root finding, interpolation, numerical differentiation and integration, ODE integrators, linear systems, and the analysis of numerical error and stability.

**Deliverable:** integrate an orbit and show whether your integrator conserves energy over long times — and why.`,
  }),
  course({
    n: 43, name: "Mecánica Relativista", clave: "FIS-1843", cuatri: 9, creditos: 9,
    e1: 0.7, e2: 0.8, e3: 0.15,
    body:
`Relativistic mechanics: four-vectors, the Minkowski metric, relativistic dynamics, the stress-energy tensor, covariant electrodynamics, and an introduction to general relativity.

*(The map prints the clave as FIS-1843; by position this is almost certainly FIS-1943.)*

**Deliverable:** show that the interval $s^2 = c^2t^2 - x^2$ is invariant under a Lorentz boost, by direct substitution.`,
  }),
  course({
    n: 44, name: "Física Atómica", clave: "FIS-1944", cuatri: 9, creditos: 9,
    e1: 0.7, e2: 0.82, e3: 0.15,
    body:
`Many-electron atoms: the central-field approximation, the periodic table from quantum mechanics, fine and hyperfine structure, LS and jj coupling, the Zeeman and Stark effects, and atomic spectroscopy.

**Deliverable:** predict the term symbol of a ground-state atom and justify each quantum number from Hund's rules.`,
  }),
  course({
    n: 45, name: "Teoría del Caos", clave: "FIS-1945", cuatri: 9, creditos: 9,
    e1: 0.75, e2: 0.7, e3: 0.4,
    body:
`Nonlinear dynamics: phase space, fixed points and stability, bifurcations, limit cycles, sensitive dependence on initial conditions, Lyapunov exponents, strange attractors and fractals.

*(No clave is printed on the map; FIS-1945 is inferred from position.)*

**Deliverable:** compute the Lyapunov exponent of the logistic map numerically and locate the onset of chaos.`,
  }),

  // ── Cuatrimestre 10 ────────────────────────────────────────────────────────
  course({
    n: 46, name: "Física del Estado Sólido", clave: "FIS-1946", cuatri: 10, creditos: 9,
    e1: 0.7, e2: 0.85, e3: 0.15,
    body:
`Condensed matter: crystal structure and the reciprocal lattice, X-ray diffraction and Bragg's law, lattice vibrations and phonons, the free-electron model, band theory, semiconductors, and magnetic and superconducting properties.

**Deliverable:** explain the difference between a conductor, a semiconductor and an insulator purely in terms of band structure and the Fermi level.`,
  }),
  course({
    n: 47, name: "Física Computacional II", clave: "FIS-1947", cuatri: 10, creditos: 7, seriacion: "FIS-1942 (Física Computacional I)",
    e1: 0.78, e2: 0.62, e3: 0.45,
    body:
`Advanced computational physics: Monte Carlo methods, molecular dynamics, partial differential equations numerically, simulation of physical systems, and high-performance practice.

**Deliverable:** run a Monte Carlo simulation of the Ising model and locate the critical temperature from your data.`,
  }),
  course({
    n: 48, name: "Seminario de Investigación", clave: "FIS-1948", cuatri: 10, creditos: 9,
    e1: 0.6, e2: 0.7, e3: 0.55,
    body:
`Research method and communication: literature search, formulating a question, methodology, scientific writing, and presenting results. The integrative course where the degree's pieces are made to serve one question.

**Deliverable:** a research protocol — question, method, expected result, and what would falsify it.`,
  }),
  course({
    n: 49, name: "Física Ecológica", clave: "FIS-1949", cuatri: 10, creditos: 9,
    e1: 0.5, e2: 0.85, e3: 0.35,
    body:
`Physics applied to environmental systems: energy resources and conversion, climate physics and radiative balance, transport of pollutants, renewable energy, and sustainability analysed quantitatively.

**Deliverable:** compute a radiative-forcing estimate and state which assumption your answer is most sensitive to.`,
  }),
];

// ── The alternative-formalism twins (cuatrimestres 1–3) ──────────────────────
// Each lives in ITS OWN lens (GA_DOMAIN / SIA_DOMAIN), not in the degree lens, and
// is joined to its course by an "alternative formulation of" bridge. These are the
// owner's own view of the same material — read alongside the course, not instead
// of it: the exam still wants the orthodox treatment.

// markdown.js renders h1–h6, p, br, strong, em, code, pre, ul/ol/li, a, span and
// img — and nothing else. A "> " blockquote would come out with its markers
// showing, so this leads with bold instead.
const twinNote =
`**Parallel view.** This is the same content as the course it is bridged to, rebuilt in a different formalism. Study it *next to* the official treatment — the exam asks for the official one; this is the one that explains why it works.`;

export const UNIVERSITAM_TWINS = [
  // ---- SIA twins over the calculus spine -----------------------------------
  {
    id: SIA(1), name: "SIA view: Introducción al cálculo",
    domain: SIA_DOMAIN, e1: 0.9, e2: 0.05, e3: 0.42,
    description:
`# SIA view: Introducción al cálculo

${twinNote}

The course builds the derivative on the **limit**: $f'(x) = \\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}$. Synthetic Infinitesimal Analysis refuses that move. Instead it *postulates* a set of infinitesimals

$$\\Delta = \\{\\varepsilon \\in R : \\varepsilon^2 = 0\\}$$

the **nilsquare** elements — quantities so small their square is exactly zero, yet which are not themselves zero. No limits, no epsilon-delta, no "approaches".

**The Kock–Lawvere axiom (microaffineness).** For any $f: R \\to R$ and any $\\varepsilon \\in \\Delta$, there is a *unique* number $f'(x)$ such that

$$f(x + \\varepsilon) = f(x) + \\varepsilon\\, f'(x)$$

This is an **equality**, not an approximation. Every curve is *literally straight* over an infinitesimal stretch — the intuition every physicist already uses when writing $ds$, $dt$, $dV$, made into the axiom rather than apologised for.

**Why it matters to you:** when your physics courses write $dU = TdS - PdV$ and manipulate differentials as algebraic objects, they are using SIA reasoning and justifying it with limits afterwards. Here it is simply legitimate.

**The catch — and it is the interesting part.** The logic must be *intuitionistic*: the law of excluded middle fails. You may not argue "either $\\varepsilon = 0$ or $\\varepsilon \\neq 0$". If you could, you could prove $\\Delta = \\{0\\}$ and the whole structure collapses. This is the same intuitionistic setting as **Lógica y Conjuntos** — the two courses secretly meet here.

**Deliverable:** derive the product rule using only microaffineness. Expand $(fg)(x+\\varepsilon)$, use $\\varepsilon^2 = 0$ to kill one term, and read off the answer. Compare with the limit proof from class: which one told you *why*?`,
  },
  {
    id: SIA(2), name: "SIA view: Cálculo I — derivatives without limits",
    domain: SIA_DOMAIN, e1: 0.9, e2: 0.1, e3: 0.45,
    description:
`# SIA view: Cálculo I — derivatives without limits

${twinNote}

Every differentiation rule the course proves by limits falls out of microaffineness in one line.

**Chain rule.** Let $g$ be differentiable at $x$ and $f$ at $g(x)$. For $\\varepsilon \\in \\Delta$, $\\;g(x+\\varepsilon) = g(x) + \\varepsilon g'(x)$. Now $\\varepsilon g'(x)$ is itself nilsquare, so applying microaffineness to $f$:

$$f(g(x+\\varepsilon)) = f(g(x) + \\varepsilon g'(x)) = f(g(x)) + \\varepsilon g'(x) f'(g(x))$$

Read off the coefficient of $\\varepsilon$: $\\,(f\\circ g)'(x) = f'(g(x))\\,g'(x)$. No "$\\Delta u \\to 0$" hand-waving about the case $\\Delta u = 0$ — the classical proof's one genuinely awkward step simply does not arise.

**Stationary points.** $f$ has a stationary point at $x$ exactly when $f(x+\\varepsilon) = f(x)$ for all $\\varepsilon \\in \\Delta$ — the function is *constant to first order*. That is a cleaner definition than "the derivative is zero", and it is the one that generalises.

**What you lose.** SIA has no discontinuous functions — every function is smooth. That is a genuine restriction, not a bug to route around: it means SIA models a world of smooth physics, which is the world your degree is about.

**Deliverable:** prove the quotient rule by microaffineness, then state precisely where your proof would break if you allowed $\\varepsilon^2 \\neq 0$.`,
  },
  {
    id: SIA(3), name: "SIA view: Cálculo II — the integral and the FTC",
    domain: SIA_DOMAIN, e1: 0.9, e2: 0.12, e3: 0.45,
    description:
`# SIA view: Cálculo II — the integral and the FTC

${twinNote}

The course defines $\\int_a^b f$ as a limit of Riemann sums, then proves the Fundamental Theorem. SIA takes the **integration axiom** instead: for every $f:[0,1]\\to R$ there is a *unique* $F$ with $F' = f$ and $F(0)=0$. The integral is defined to be that $F$.

**The FTC becomes a definition, not a theorem.** This inverts the course's logical order, and it is worth understanding why that is allowed: the classical construction *earns* the FTC through limits; SIA *assumes* the antiderivative exists and derives Riemann-sum behaviour afterwards. Two routes to the same calculus, with the effort spent in different places.

**Infinitesimal area.** The area under $f$ over $[x, x+\\varepsilon]$ is exactly $\\varepsilon f(x)$ — not approximately. The strip *is* a rectangle, because $f$ is straight there. Every "consider a small element $dA = f(x)dx$" in your physics courses is this statement.

**Where physics uses it constantly:** flux through a surface element, work over a displacement $d\\vec r$, charge in a volume $dV$. Your Electromagnetismo courses will write these daily.

**Deliverable:** derive the formula for the volume of a solid of revolution by treating the infinitesimal slice as an exact cylinder, and compare to the Riemann-sum derivation from class.`,
  },

  // ---- GA twins over the geometry/algebra/mechanics spine -------------------
  {
    id: GA(1), name: "GA view: Introducción al álgebra — directed magnitudes",
    domain: GA_DOMAIN, e1: 0.72, e2: 0.6, e3: 0.2,
    description:
`# GA view: Introducción al álgebra — directed magnitudes

${twinNote}

School algebra treats numbers as quantities without direction, then bolts vectors on later as a separate species with two incompatible products (dot and cross). Geometric Algebra starts differently: it asks what happens if you can simply **multiply vectors**.

The geometric product of two vectors is defined as

$$ab = a\\cdot b + a \\wedge b$$

a **scalar** plus a **bivector** — a number plus an oriented plane element. It looks illegal to add two different kinds of thing, but it is exactly as legal as $3 + 4i$, which you accept without complaint.

**The consequences are immediate:** - $a\\cdot b = \\tfrac12(ab + ba)$ — the symmetric part - $a\\wedge b = \\tfrac12(ab - ba)$ — the antisymmetric part - $aa = a\\cdot a = |a|^2$, so a nonzero vector has an **inverse**: $a^{-1} = a/|a|^2$

That last one is the payoff. You can *divide by a vector*. Nothing in the standard course lets you do that.

**Deliverable:** verify $ab = a\\cdot b + a\\wedge b$ for two concrete 2-D vectors, and confirm $ba$ gives the same scalar part but the opposite bivector.`,
  },
  {
    id: GA(2), name: "GA view: Álgebra Superior — complex numbers are not fundamental",
    domain: GA_DOMAIN, e1: 0.78, e2: 0.5, e3: 0.25,
    description:
`# GA view: Álgebra Superior — complex numbers are not fundamental

${twinNote}

The course introduces $i = \\sqrt{-1}$ as a definition to be accepted, and complex numbers as a formal device that turns out to be useful. GA says: they were the even part of plane geometry all along.

Take orthonormal $e_1, e_2$ in the plane. The unit bivector is $I = e_1e_2$. Compute:

$$I^2 = e_1e_2e_1e_2 = -e_1e_1e_2e_2 = -1$$

using $e_2e_1 = -e_1e_2$ and $e_ie_i = 1$. **There is your $i$** — and it is not a mystery, it is the oriented unit area of the plane. "Imaginary" is a historical slander.

**So $\\mathbb{C}$ is the even subalgebra $\\{a + bI\\}$ of the plane's geometric algebra.** De Moivre's theorem becomes the statement that multiplying by $e^{I\\theta}$ rotates by $\\theta$ — and now the *reason* is visible: you are multiplying by a plane element, and a plane has an orientation to rotate in.

**The generalization that matters later:** in 3-D there are three such bivectors ($e_1e_2, e_2e_3, e_3e_1$), each squaring to $-1$. They are the **quaternions**, and they are what actually describes 3-D rotation and spin. Your Mecánica Cuántica II course will call them Pauli matrices.

**Deliverable:** compute the $n$-th roots of unity as rotors $e^{2\\pi Ik/n}$ and show they are the same numbers the course obtained from De Moivre.`,
  },
  {
    id: GA(3), name: "GA view: Geometría Analítica without coordinates",
    domain: GA_DOMAIN, e1: 0.7, e2: 0.55, e3: 0.35,
    description:
`# GA view: Geometría Analítica without coordinates

${twinNote}

The course does geometry by *choosing axes and pushing coordinates*. The hardest exam problem — rotating axes to eliminate the $xy$ term of a conic — exists only because coordinates were chosen badly in the first place.

**GA writes the objects directly:** - A **line** through points $P$ and $Q$: the set of $X$ with $(X - P)\\wedge(Q-P) = 0$. The wedge vanishing *is* collinearity — no slope, no special case for vertical lines, which is the one the coordinate treatment always has to except. - A **plane** through three points: $(X-P)\\wedge(Q-P)\\wedge(R-P) = 0$. - The **outer product's magnitude** $|a \\wedge b|$ is the area of the parallelogram they span, so areas need no determinant formula to memorise — the algebra *is* the determinant.

**Rotation without rotating axes.** To rotate a vector $v$ by angle $\\theta$ in the plane $B$, sandwich it between rotors:

$$v' = R v \\tilde R, \\qquad R = e^{-B\\theta/2}$$

The same expression works in any dimension and composes by multiplication. The exam's rotation-of-axes formulas are this, expanded in a particular basis and then memorised.

**Deliverable:** take the conic problem you were set in class, and instead of rotating axes, express the conic in a basis aligned with its own principal directions. Note how much of the algebra disappears.`,
  },
  {
    id: GA(4), name: "GA view: Álgebra Lineal I — rotors instead of matrices",
    domain: GA_DOMAIN, e1: 0.75, e2: 0.5, e3: 0.3,
    description:
`# GA view: Álgebra Lineal I — rotors instead of matrices

${twinNote}

A matrix is a linear map *written in a chosen basis*. Change the basis and every entry changes, though the map did not. GA writes many of the same maps **basis-free**.

**Reflection.** Reflecting $v$ in the hyperplane perpendicular to unit $n$:

$$v' = -n v n$$

One line. No matrix, no basis.

**Rotation is two reflections.** Compose reflections in $m$ then $n$:

$$v' = (nm)\\,v\\,(mn) = R v \\tilde R, \\qquad R = nm$$

$R$ is a **rotor**, an even-grade element. Rotors compose by *multiplication* — $R_2R_1$ — which is far cheaper and numerically better-behaved than multiplying rotation matrices, and it never suffers gimbal lock.

**What this reframes in the course:** - **Orthogonal matrices** ($\\det = +1$) ↔ rotors. The determinant condition becomes "even grade, unit norm". - **Change of basis** becomes conjugation by a rotor, which is the same operation as the rotation itself — one idea, not two. - **Eigenvectors of a rotation**: the axis is the vector the rotor leaves fixed, visible directly as the dual of the rotation bivector.

**Honest limitation:** GA does not replace linear algebra. Non-orthogonal maps, rank, nullity and the general eigenvalue problem still want matrices. GA replaces the *geometric* part — which is most of what physics uses.

**Deliverable:** compose two rotations as rotors and as $3\\times3$ matrices; verify the same result and count the multiplications each took.`,
  },
  {
    id: GA(5), name: "GA view: Física I — mechanics with bivectors",
    domain: GA_DOMAIN, e1: 0.62, e2: 0.75, e3: 0.25,
    description:
`# GA view: Física I — mechanics with bivectors

${twinNote}

The course teaches rotation with the **cross product**: $\\vec\\tau = \\vec r \\times \\vec F$, $\\vec L = \\vec r \\times \\vec p$. The cross product has three defects it never admits to:

1. It exists **only in 3-D**. There is no cross product in 2-D or 4-D — so this
   machinery cannot follow you into relativity.
2. Its outputs are **pseudovectors**: they flip sign under reflection, unlike real
   vectors. The course handles this with the "right-hand rule", a convention, not a
   physical fact.
3. Angular momentum is not really an arrow. It is a **plane of rotation**. The arrow
   is a 3-D-only stand-in for that plane.

**GA says the honest thing.** Torque and angular momentum are **bivectors**:

$$L = r \\wedge p, \\qquad \\tau = r \\wedge F$$

These are oriented plane elements — which is what rotation actually is. They work in any dimension, need no hand rule, and behave correctly under reflection.

**Rigid-body rotation.** A body's orientation is a rotor $R(t)$, evolving as

$$\\dot R = -\\tfrac12 \\Omega R$$

with $\\Omega$ the angular-velocity **bivector**. This is the equation numerical simulations actually want — no gimbal lock, and renormalising a rotor is trivial.

**Deliverable:** redo one angular-momentum problem from class with $L = r\\wedge p$, and confirm the bivector's components match the cross product's — then say what the bivector expresses that the arrow does not.`,
  },
  {
    id: GA(6), name: "GA view: Óptica — reflection and refraction as versors",
    domain: GA_DOMAIN, e1: 0.6, e2: 0.78, e3: 0.3,
    description:
`# GA view: Óptica — reflection and refraction as versors

${twinNote}

Geometric optics is built on reflection, and reflection is GA's most natural operation. A ray with direction $d$ hitting a surface with unit normal $n$ reflects to

$$d' = -n\\,d\\,n$$

That is the whole law of reflection — angle of incidence equals angle of reflection is a *consequence*, not a separate rule to state.

**Why this is more than notation.** An optical system is a sequence of reflections and refractions. In GA each is a versor, and the whole system is their **product** — so a compound instrument is one algebraic object you can simplify before computing anything. Ray-tracing codes exploit exactly this.

**Snell's law** appears as the statement that the component of the wave vector *in the interface plane* — that is, the wedge $n \\wedge k$ — is conserved across the boundary:

$$n_1 (n \\wedge k_1) = n_2 (n \\wedge k_2)$$

which is $n_1\\sin\\theta_1 = n_2\\sin\\theta_2$ once you take magnitudes, but says *why*: it is the tangential part that must match.

**Polarization** is where it pays off most: polarization states are rotors acting in the plane transverse to propagation, so a stack of wave plates is a rotor product.

**Deliverable:** apply $d' = -ndn$ to a ray hitting a mirror at 30°, and check the angle. Then compose two mirrors and predict the total deviation as a single rotor.`,
  },
  {
    id: GA(7), name: "GA view: Introducción a la Física — why geometry is the language",
    domain: GA_DOMAIN, e1: 0.65, e2: 0.7, e3: 0.35,
    description:
`# GA view: Introducción a la Física — why geometry is the language

${twinNote}

The first physics course teaches that some quantities are scalars and some are vectors, and leaves it there. GA supplies the missing organising idea: physical quantities are graded by **how many directions they carry**.

| Grade | Object | Physical example |
|---|---|---|
| 0 | scalar | mass, charge, temperature |
| 1 | vector | velocity, force, electric field |
| 2 | bivector | angular momentum, torque, magnetic field |
| 3 | trivector | oriented volume, the pseudoscalar |

The single most useful correction this makes early: **the magnetic field is not a vector.** It is a bivector. The reason $\\vec B$ needs a right-hand rule, behaves oddly under reflection, and is called an "axial vector" is that it has been forced into the wrong grade. In Electromagnetismo II you will meet $F = E + I B$ — the electromagnetic field as a single object, with $E$ grade 1 and $B$ grade 2 — and Maxwell's four equations collapse into

$$\\nabla F = J$$

**Why bother now, in the first course?** Because if you learn $\\vec B$ as an arrow now, you will spend four semesters unlearning it. Knowing it is a plane from the start costs nothing and explains every sign convention you are about to memorise.

**Deliverable:** for each quantity in your first physics course, write down its grade, and flag the ones the course calls vectors that are really bivectors.`,
  },
];

// ── Bridges ─────────────────────────────────────────────────────────────────
// Two kinds: the degree's own SERIACIÓN (official prerequisites, printed on the
// map) plus the sequence within a subject line, and the CROSS-LENS twin edges.
export const UNIVERSITAM_BRIDGES = [
  // official seriación, transcribed from the map
  { id: BR(1), from: U(6), to: U(11), concept: "seriación: Cálculo I → Cálculo II" },
  { id: BR(2), from: U(7), to: U(12), concept: "seriación: Álgebra Superior → Álgebra Lineal I" },
  { id: BR(3), from: U(3), to: U(15), concept: "seriación: Introducción a la Física → Física I" },
  { id: BR(4), from: U(11), to: U(17), concept: "seriación: Cálculo II → Cálculo III" },
  { id: BR(5), from: U(12), to: U(18), concept: "seriación: Álgebra Lineal I → Álgebra Lineal II" },
  { id: BR(6), from: U(14), to: U(19), concept: "seriación: Programación I → Programación II" },
  { id: BR(7), from: U(15), to: U(20), concept: "seriación: Física I → Física II" },
  { id: BR(8), from: U(17), to: U(22), concept: "seriación: Cálculo III → Cálculo IV" },
  { id: BR(9), from: U(20), to: U(25), concept: "seriación: Física II → Física III" },
  { id: BR(10), from: U(21), to: U(26), concept: "seriación: Electromagnetismo I → II" },
  { id: BR(11), from: U(25), to: U(27), concept: "seriación: Física III → Física IV" },
  { id: BR(12), from: U(30), to: U(33), concept: "seriación: Mecánica Cuántica I → II" },
  { id: BR(13), from: U(31), to: U(36), concept: "seriación: Física Estadística I → II" },
  { id: BR(14), from: U(33), to: U(38), concept: "seriación: Mecánica Cuántica II → III" },
  { id: BR(15), from: U(42), to: U(47), concept: "seriación: Física Computacional I → II" },
  // implicit dependencies the map does not print but the material demands
  { id: BR(16), from: U(1), to: U(6), concept: "prepares" },
  { id: BR(17), from: U(2), to: U(7), concept: "prepares" },
  { id: BR(18), from: U(9), to: U(12), concept: "geometry the linear algebra formalises" },
  { id: BR(19), from: U(11), to: U(13), concept: "integration needed to solve ODEs" },
  { id: BR(20), from: U(22), to: U(26), concept: "the integral theorems ARE Maxwell's equations" },
  { id: BR(21), from: U(13), to: U(30), concept: "the Schrödinger equation is a PDE" },
  { id: BR(22), from: U(18), to: U(30), concept: "eigenvalue problems are quantum observables" },
  { id: BR(23), from: U(27), to: U(43), concept: "special relativity deepened" },
  { id: BR(24), from: U(4), to: U(41), concept: "sets and logic underpin topology" },

  // ── cross-lens twin edges (the domain meet) ──────────────────────────────
  // Concept string is uniform on purpose: "alternative formulation of" is how a
  // twin is found programmatically, now and by R-0097's ⇄ affordance.
  { id: BR(40), from: SIA(1), to: U(1), concept: "alternative formulation of" },
  { id: BR(41), from: SIA(2), to: U(6), concept: "alternative formulation of" },
  { id: BR(42), from: SIA(3), to: U(11), concept: "alternative formulation of" },
  { id: BR(43), from: GA(1), to: U(2), concept: "alternative formulation of" },
  { id: BR(44), from: GA(2), to: U(7), concept: "alternative formulation of" },
  { id: BR(45), from: GA(3), to: U(9), concept: "alternative formulation of" },
  { id: BR(46), from: GA(4), to: U(12), concept: "alternative formulation of" },
  { id: BR(47), from: GA(5), to: U(15), concept: "alternative formulation of" },
  { id: BR(48), from: GA(6), to: U(8), concept: "alternative formulation of" },
  { id: BR(49), from: GA(7), to: U(3), concept: "alternative formulation of" },
];

// ── The followable path: the degree in its official order ────────────────────
export const UNIVERSITAM_PATH = {
  id: "d0000000-0000-0000-0000-000000000003",
  title: "Licenciatura en Física — Universitam",
  goal: "Your actual degree, cuatrimestre by cuatrimestre: 49 asignaturas, 381 créditos, in the order the plan requires.",
  steps: UNIVERSITAM_PLATEAUS.map((p) => p.id),
};

// The parallel route: the same spine, read in the alternative formalisms. Kept
// separate so it can be followed on its own — this is the owner's own view, not
// the examined one.
export const UNIVERSITAM_TWIN_PATH = {
  id: "d0000000-0000-0000-0000-000000000004",
  title: "The parallel view — GA & SIA over the degree",
  goal: "The same first-year topics rebuilt in Geometric Algebra and Synthetic Infinitesimal Analysis — read alongside each course, not instead of it.",
  steps: [
    GA(7), // Introducción a la Física
    SIA(1), // Introducción al cálculo
    GA(1), // Introducción al álgebra
    SIA(2), // Cálculo I
    GA(2), // Álgebra Superior
    GA(3), // Geometría Analítica
    GA(6), // Óptica
    SIA(3), // Cálculo II
    GA(4), // Álgebra Lineal I
    GA(5), // Física I
  ],
};
