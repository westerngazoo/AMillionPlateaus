// curriculum.js — pure data. The "Quantum Computing Physics & AI — A Ground-Up
// Rebuild" curriculum, imported as a region of the seed world: fixed-id plateaus,
// prerequisite + cross-domain bridges, and a few curated resources that every tab
// upserts on load (same convergent, id-keyed seed contract as seeds.js / R-0004).
//
// This is the rhizome from the source doc's §1 dependency graph, re-expressed in
// the world's GA space. Axes (GARUST_INTEGRATION.md): e1 = Formal, e2 = Empirical,
// e3 = Creative. Read the bridges as a BUILD ORDER — an edge A→B means "A's
// vocabulary before B's definitions type-check."
//
// The two-logic fork is modeled as two domains (persona.js):
//   CLASSICAL_DOMAIN      — LEM · ZFC · hyperreal; the branch that reconnects to
//                            measured physics + carries the GA/QC/AI trunk.
//   INTUITIONISTIC_DOMAIN — topos · SIA; the constructive branch.
// Their planes MEET on the pure Formal axis (the shared infinitesimal-calculus /
// algebra spine). Cross-domain bridges below ARE that meet in action.
//
// Fixed-id namespaces (curriculum.test.mjs asserts uniqueness mechanically):
//   1…NN plateaus   2…NN bridges   3…NN resources   (disjoint from seeds.js' 0…)

import { CLASSICAL_DOMAIN, INTUITIONISTIC_DOMAIN } from "./persona.js";

const CL = CLASSICAL_DOMAIN;
const IN = INTUITIONISTIC_DOMAIN;

// Two trailheads sit on their lens' canonical direction so a Logician / a
// Constructivist persona clears the SEED=0.16 > 0.15 fog margin on step one
// (persona.js); everything downstream is earned by traversal.
export const QC_PLATEAUS = [
  // ── Phase I · Logic (the bootloader) ─────────────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Classical Predicate Logic",
    domain: CL,
    e1: 0.95,
    e2: 0.3,
    e3: 0.0,
    description: `# Classical Predicate Logic
The logic underneath ZFC, ε-δ analysis, and the hyperreals. It **assumes** the Law of the Excluded Middle: $P \\lor \\lnot P$ always holds, so double-negation elimination and unrestricted proof-by-contradiction are free.

*Embedded analogy:* every pin is HIGH or LOW at all times — the digital abstraction.

**Deliverable:** state, in Hehner-style predicate notation, what LEM buys you that you lose without it.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Intuitionistic Logic",
    domain: IN,
    e1: 0.95,
    e2: 0.0,
    e3: 0.3,
    description: `# Intuitionistic Logic
Drop LEM as an *axiom* — $P \\lor \\lnot P$ must be **constructed**, not asserted. Its algebraic semantics is a **Heyting algebra** (a lattice with an implication operator), not a Boolean one. Every Boolean algebra is Heyting; not conversely.

This single fact is *why* nilpotent infinitesimals can exist without contradiction: you cannot always prove $\\varepsilon = 0 \\lor \\varepsilon \\neq 0$, and that gap leaves room for a nonzero $\\varepsilon$ with $\\varepsilon^2 = 0$.

**Deliverable:** exhibit a Heyting algebra that is not Boolean.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    name: "Hehner Predicative Logic",
    domain: CL,
    e1: 0.85,
    e2: 0.3,
    e3: 0.15,
    description: `# Hehner Predicative Programming
Stop treating *specification* and *program* as different kinds of object. **Both are predicates** over (initial, final) state pairs, in one calculus. "Program $P$ refines spec $S$" is just $S \\Leftarrow P$ — refinement is entailment; the predicate *is* the meaning.

Compatible with classical **or** intuitionistic calculus underneath — it states the LEM question precisely without forcing it.

**Deliverable:** specify the geometric product as a predicate, and the refinement relation between a reference (bivector-table) and an optimized (bitmask) implementation — formalize what garust already does.`,
  },

  // ── Phase II · Set theory (two kernels) ──────────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000004",
    name: "ZFC Set Theory",
    domain: CL,
    e1: 0.95,
    e2: 0.2,
    e3: 0.0,
    description: `# ZFC — the classical kernel
Extensionality, pairing, union, power set, infinity, replacement, foundation, choice. The "legacy ISA": Cauchy/Dedekind reals, standard analysis, and most physics-as-taught target it. Full LEM available.

**Deliverable:** identify which axiom each step of the ℝ construction actually uses.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    name: "Elementary Topos Theory",
    domain: IN,
    e1: 0.88,
    e2: 0.0,
    e3: 0.32,
    description: `# Topos Theory — the intuitionistic kernel
A topos is a category with finite limits and a power-object structure whose **internal logic is intuitionistic by default** (classical only if you *add* that the subobject classifier is Boolean). A **smooth topos** additionally hosts SIA.

The "ground-up RISC-V ISA": design in the primitives you want (nilpotent infinitesimals) instead of inheriting ZFC's.

**Deliverable:** state precisely why a smooth topos *cannot* host classical LEM together with nonzero nilsquare infinitesimals.`,
  },

  // ── Phase III · Numbers (the completion tree) ────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000006",
    name: "The Real Tower ℕ→ℤ→ℚ→ℝ",
    domain: CL,
    e1: 0.9,
    e2: 0.3,
    e3: 0.05,
    description: `# The classical number tower
$\\mathbb{N}$ (Peano) → $\\mathbb{Z}$ (group completion) → $\\mathbb{Q}$ (fractions) → $\\mathbb{R}$ (metric completion of $\\mathbb{Q}$ under $|\\cdot|$). ℚ is dense but has holes; ℝ is *one* way to fill them.

**Deliverable:** complete the decimal expansion of $1/3$ in ℝ and hold it for comparison with the p-adic view.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000007",
    name: "Ostrowski & the p-adics",
    domain: CL,
    e1: 0.82,
    e2: 0.15,
    e3: 0.35,
    description: `# Ostrowski's theorem — the branch point
Every nontrivial absolute value on ℚ is equivalent to either the usual (archimedean) one or a **p-adic** $|\\cdot|_p$ (more factors of $p$ → *smaller*). Completing at $|\\cdot|_p$ gives $\\mathbb{Q}_p$ — one complete field **for every prime**. ℝ is just the completion "at the infinite prime," not privileged.

Non-archimedean: $|x+y|_p \\le \\max(|x|_p,|y|_p)$, every triangle isosceles, balls disjoint-or-nested. Natural for tree-structured data (→ p-adic neural nets).

**Deliverable:** compute the 5-adic expansion of $1/3$ beside its decimal expansion.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000008",
    name: "Infinitesimal Systems (ℝ*, Surreals)",
    domain: CL,
    e1: 0.85,
    e2: 0.2,
    e3: 0.25,
    description: `# Infinitesimals, the classical way
**Hyperreals** $\\mathbb{R}^*$: ultrapower $\\mathbb{R}^{\\mathbb{N}}/\\mathcal{U}$ for a nonprincipal ultrafilter — classical logic, a weak form of choice; infinitesimals are *invertible*. **Surreals** (Conway): $\\langle L \\mid R\\rangle$ recursion, the largest ordered field, containing both ℝ and the hyperreals.

**Deliverable:** state Łoś's theorem and where the ultrafilter/choice enters.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000009",
    name: "SIA Infinitesimals (Kock–Lawvere)",
    domain: IN,
    e1: 0.85,
    e2: 0.0,
    e3: 0.38,
    description: `# Synthetic differential geometry
Infinitesimals internal to a smooth topos: **nilsquare** ($\\varepsilon^2 = 0$), *not* invertible, intuitionistic logic required. The Kock–Lawvere axiom makes the derivative an algebraic identity, not a limit:
$$f(x+\\varepsilon) = f(x) + f'(x)\\,\\varepsilon \\quad \\text{exactly, for all nilsquare } \\varepsilon.$$
$f'(x)$ is the *unique* $b$ making this hold.

**Deliverable:** show $\\varepsilon^2 = 0$ kills every higher-order Taylor term automatically.`,
  },

  // ── Phase IV · Algebra (why there is no single algebra) ───────────────────
  {
    id: "10000000-0000-0000-0000-000000000010",
    name: "Universal Algebra",
    domain: CL,
    e1: 0.95,
    e2: 0.15,
    e3: 0.15,
    description: `# Universal algebra — the spec layer
An algebraic structure = a **signature** (operation symbols + arities) + **equational axioms**. Groups, rings, lattices, Boolean *and* Heyting algebras are all points in one design space, differing only in which ops and equations you require. Literally an ISA-design exercise.

**Deliverable:** write the signature+axioms for a group, then extend to a ring by adding exactly one operation and distributivity.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000011",
    name: "Hurwitz's Theorem (ℝ ℂ ℍ 𝕆)",
    domain: CL,
    e1: 0.9,
    e2: 0.2,
    e3: 0.2,
    description: `# Hurwitz — the hard stop
Among normed division algebras over ℝ there are **exactly four**: $\\mathbb{R}, \\mathbb{C}, \\mathbb{H}, \\mathbb{O}$ of dimension $1, 2, 4, 8$. A *theorem*, not a convention. The quaternions $\\mathbb{H}$ turn out to be the even subalgebra of $Cl(3,0)$ — the spin piece of a bigger structure nobody had named.

**Deliverable:** verify $\\mathbb{H}$ is normed and division; note where dimension 16 (sedenions) fails.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000012",
    name: "Grassmann / Exterior Algebra",
    domain: CL,
    e1: 0.8,
    e2: 0.25,
    e3: 0.4,
    description: `# Grassmann (1844) — area without metric
An algebra from antisymmetric multiplication alone: the wedge $\\wedge$, with $v \\wedge v = 0$, generating $\\Lambda(V) = \\bigoplus_k \\Lambda^k(V)$ — oriented $k$-dimensional area/volume elements (bivectors, trivectors…). No length, no angle: pure incidence.

**Deliverable:** in $\\Lambda(\\mathbb{R}^3)$, expand $(a_1e_1+a_2e_2+a_3e_3)\\wedge(b_1e_1+b_2e_2+b_3e_3)$ and recognize the cross product.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000013",
    name: "Clifford Algebra Cl(V,Q)",
    domain: CL,
    e1: 0.78,
    e2: 0.35,
    e3: 0.32,
    description: `# Clifford (1878) — Grassmann + a metric
Add a quadratic form $Q$ with the single axiom $v^2 = Q(v)\\,1$. That derives the full geometric product
$$uv = u\\cdot v + u\\wedge v$$
(symmetric = metric/inner, antisymmetric = wedge). **Clifford = Grassmann + metric**: turn off $Q$ and you're back to pure Grassmann; ℂ and ℍ appear as even subalgebras.

**Deliverable:** derive $Cl(2,0)$ from $v^2=Q(v)$; verify $e_1e_2$ squares to $-1$, recovering ℂ as the even subalgebra.`,
  },

  // ── Phase V · Analysis rebuilt ────────────────────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000014",
    name: "τ and Rotors",
    domain: CL,
    e1: 0.72,
    e2: 0.3,
    e3: 0.42,
    description: `# τ, and rotation as a geometric object
Use $\\tau = 2\\pi$ (radians per full turn). Euler's formula generalizes to a **rotor**
$$R = e^{-B\\theta/2}, \\qquad v' = R\\,v\\,R^{-1},$$
where $B$ is a unit bivector (the *plane* of rotation). This replaces "$i$" with an oriented plane and works in **any** dimension — strictly more information than $e^{i\\theta}$, because $B$ tells you which plane.

**Deliverable:** rotate $e_1$ by $\\tau/4$ in the $e_1e_2$ plane using the sandwich product.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000015",
    name: "Three Derivatives, One Spec",
    domain: CL,
    e1: 0.85,
    e2: 0.25,
    e3: 0.2,
    description: `# Three derivatives, three logics
- **ε-δ (Weierstrass)** — classical, limits of sequences.
- **Standard-part (Robinson)** — classical + choice, $f'(x)=\\mathrm{st}\\!\\big(\\tfrac{f(x+\\varepsilon)-f(x)}{\\varepsilon}\\big)$.
- **Kock–Lawvere (SIA)** — intuitionistic, algebraic identity, no limit.

They agree on well-behaved functions; they disagree on what a derivative *is*.

**Deliverable:** differentiate $f(x)=x^3$ three ways, get $3x^2$ each time, and say precisely *why* they had to agree here.`,
  },

  // ── Phase VI · GA physics ─────────────────────────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000016",
    name: "The GA Substrate",
    domain: CL,
    e1: 0.7,
    e2: 0.45,
    e3: 0.3,
    description: `# Geometric algebra as computation
With $uv = u\\cdot v + u\\wedge v$ and rotors in hand, GA is the substrate. This *is* garust's \`Multivector<T,P,Q,R,DIM>\` with the XOR-bitmask blade representation; the sandwich-product/rotor ops are the $Cl^+(3,0)$ machinery the qubit phases need.

**Deliverable:** map each grade of a 3D multivector to its geometric meaning (scalar, vector, bivector, pseudoscalar).`,
  },
  {
    id: "10000000-0000-0000-0000-000000000017",
    name: "Maxwell: ∇F = J/ε₀c",
    domain: CL,
    e1: 0.55,
    e2: 0.78,
    e3: 0.15,
    description: `# Maxwell, in one equation
In spacetime algebra the four equations become
$$\\nabla F = J/\\varepsilon_0 c,$$
with $F$ a single **bivector field**: $E$ and $B$ are two grades of the *same* object, not two separately-postulated fields you later notice mix.

**Deliverable:** split $\\nabla F = J/\\varepsilon_0 c$ back into the familiar four by grade.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000018",
    name: "Dirac in Real GA",
    domain: CL,
    e1: 0.6,
    e2: 0.7,
    e3: 0.22,
    description: `# The Dirac equation, real-valued
Hestenes: the "$i$" in the complex Dirac equation is a specific **bivector** once the spinor is rewritten as an even-graded multivector over $Cl(1,3)$. This removes an unexplained "why complex numbers?" from QM's foundations — the answer is "because spacetime has this bivector."

**Deliverable:** identify which bivector of $Cl(1,3)$ plays the role of the imaginary unit.`,
  },

  // ── Phase VII · Quantum computing ─────────────────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000019",
    name: "Qubit = Spinor",
    domain: CL,
    e1: 0.62,
    e2: 0.6,
    e3: 0.2,
    description: `# A qubit is a rotor
The even subalgebra $Cl^+(3,0) \\cong \\mathbb{H}$ double-covers $SU(2)$: a single-qubit state **is** a rotor, and gate application is the sandwich product $\\psi' = R\\psi R^{\\dagger}$ you already have. The global-phase ambiguity is exactly the $\\pm$ double cover of $SU(2)$ over $SO(3)$ — a geometric fact, not a QM curiosity.

**Deliverable:** place $|0\\rangle, |1\\rangle, |+\\rangle$ on the Bloch sphere as unit vectors a rotor acts on.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000020",
    name: "Gates as Rotors",
    domain: CL,
    e1: 0.62,
    e2: 0.55,
    e3: 0.25,
    description: `# Single-qubit gates
Every single-qubit gate is a rotor in $Cl^+(3,0)$; the Bloch sphere *is* the space of unit vectors they act on. $X, Y, Z, H$ are rotations by $\\tau/2$ (or $\\tau/4$) about specific axes.

**Deliverable:** write the Hadamard as a rotor $R = e^{-B\\theta/2}$ — find its plane $B$ and angle.`,
  },
  {
    id: "10000000-0000-0000-0000-000000000021",
    name: "Multi-Qubit & Entanglement",
    domain: CL,
    e1: 0.65,
    e2: 0.55,
    e3: 0.2,
    description: `# The hard extension (flagged honestly)
Multi-qubit states need the tensor/graded structure of the full multivector algebra over the combined space. Single-qubit GA is clean; **multi-qubit GA formalizations are an active, less-settled research area** — this node overclaims nothing.

**Deliverable:** state the dimension of the state space for $n$ qubits and where the clean single-qubit rotor picture stops.`,
  },

  // ── Phase VIII · AI (closing the rhizome) ─────────────────────────────────
  {
    id: "10000000-0000-0000-0000-000000000022",
    name: "GA-Equivariant AI & EML",
    domain: CL,
    e1: 0.68,
    e2: 0.55,
    e3: 0.28,
    description: `# AI on the GA substrate
- **EML operator** $\\mathrm{eml}(x,y)=e^{x}-\\ln y$ as a continuous Sheffer stroke — a Phase I (Hehner) × Phase V (continuous-valued predicates) synthesis; one operator generating the elementary functions, its truth value doubling as a fitness oracle.
- **GA-equivariant nets (GATr-style)**: grade-aware inner products are where the geometric product meets learned representations. The honest claim is **equivariance**, not invariance.
- **p-adic connection**: ultrametric distances for hierarchical/tree data — live research, not settled textbook.

**Deliverable:** state the equivariance property a GA-layer must satisfy, as a predicate to falsify.`,
  },
];

export const Q = Object.fromEntries(QC_PLATEAUS.map((p) => [p.name, p.id]));

// Bridges are the §1 dependency graph. Most are within the classical trunk; the
// four marked "meet" are cross-domain — Classical ↔ Intuitionistic — and ARE the
// bivector meet (shared_line) the fork narrates: two backends, one spec.
export const QC_BRIDGES = [
  // Phase I → II
  {
    id: "20000000-0000-0000-0000-000000000001",
    from: Q["Classical Predicate Logic"],
    to: Q["ZFC Set Theory"],
    concept: "LEM ⇒ classical sets",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    from: Q["Intuitionistic Logic"],
    to: Q["Elementary Topos Theory"],
    concept: "internal logic",
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    from: Q["Classical Predicate Logic"],
    to: Q["Hehner Predicative Logic"],
    concept: "predicate calculus",
  },
  // the fork itself (meet)
  {
    id: "20000000-0000-0000-0000-000000000004",
    from: Q["Classical Predicate Logic"],
    to: Q["Intuitionistic Logic"],
    concept: "drop LEM (meet)",
  },
  // Phase II → III / IV
  {
    id: "20000000-0000-0000-0000-000000000005",
    from: Q["ZFC Set Theory"],
    to: Q["The Real Tower ℕ→ℤ→ℚ→ℝ"],
    concept: "Cauchy/Dedekind",
  },
  {
    id: "20000000-0000-0000-0000-000000000006",
    from: Q["ZFC Set Theory"],
    to: Q["Universal Algebra"],
    concept: "structures",
  },
  {
    id: "20000000-0000-0000-0000-000000000007",
    from: Q["Elementary Topos Theory"],
    to: Q["SIA Infinitesimals (Kock–Lawvere)"],
    concept: "nilsquare dx²=0",
  },
  // Phase III internal
  {
    id: "20000000-0000-0000-0000-000000000008",
    from: Q["The Real Tower ℕ→ℤ→ℚ→ℝ"],
    to: Q["Ostrowski & the p-adics"],
    concept: "completions of ℚ",
  },
  {
    id: "20000000-0000-0000-0000-000000000009",
    from: Q["The Real Tower ℕ→ℤ→ℚ→ℝ"],
    to: Q["Infinitesimal Systems (ℝ*, Surreals)"],
    concept: "hyperreals",
  },
  {
    id: "20000000-0000-0000-0000-00000000000a",
    from: Q["Infinitesimal Systems (ℝ*, Surreals)"],
    to: Q["SIA Infinitesimals (Kock–Lawvere)"],
    concept: "same spec, two backends (meet)",
  },
  // Phase IV internal
  {
    id: "20000000-0000-0000-0000-00000000000b",
    from: Q["Universal Algebra"],
    to: Q["Hurwitz's Theorem (ℝ ℂ ℍ 𝕆)"],
    concept: "division algebras",
  },
  {
    id: "20000000-0000-0000-0000-00000000000c",
    from: Q["Universal Algebra"],
    to: Q["Grassmann / Exterior Algebra"],
    concept: "exterior algebra",
  },
  {
    id: "20000000-0000-0000-0000-00000000000d",
    from: Q["Hurwitz's Theorem (ℝ ℂ ℍ 𝕆)"],
    to: Q["Clifford Algebra Cl(V,Q)"],
    concept: "ℍ = even subalgebra",
  },
  {
    id: "20000000-0000-0000-0000-00000000000e",
    from: Q["Grassmann / Exterior Algebra"],
    to: Q["Clifford Algebra Cl(V,Q)"],
    concept: "+ quadratic form Q",
  },
  // Phase V
  {
    id: "20000000-0000-0000-0000-00000000000f",
    from: Q["Clifford Algebra Cl(V,Q)"],
    to: Q["τ and Rotors"],
    concept: "e^{-Bθ/2}",
  },
  {
    id: "20000000-0000-0000-0000-000000000010",
    from: Q["Infinitesimal Systems (ℝ*, Surreals)"],
    to: Q["Three Derivatives, One Spec"],
    concept: "standard-part",
  },
  {
    id: "20000000-0000-0000-0000-000000000011",
    from: Q["Three Derivatives, One Spec"],
    to: Q["SIA Infinitesimals (Kock–Lawvere)"],
    concept: "Kock–Lawvere derivative (meet)",
  },
  // Phase VI
  {
    id: "20000000-0000-0000-0000-000000000012",
    from: Q["Clifford Algebra Cl(V,Q)"],
    to: Q["The GA Substrate"],
    concept: "geometric product",
  },
  {
    id: "20000000-0000-0000-0000-000000000013",
    from: Q["τ and Rotors"],
    to: Q["The GA Substrate"],
    concept: "rotors",
  },
  {
    id: "20000000-0000-0000-0000-000000000014",
    from: Q["The GA Substrate"],
    to: Q["Maxwell: ∇F = J/ε₀c"],
    concept: "F as one bivector",
  },
  {
    id: "20000000-0000-0000-0000-000000000015",
    from: Q["The GA Substrate"],
    to: Q["Dirac in Real GA"],
    concept: "even-multivector spinor",
  },
  // Phase VII
  {
    id: "20000000-0000-0000-0000-000000000016",
    from: Q["The GA Substrate"],
    to: Q["Qubit = Spinor"],
    concept: "Cl⁺(3,0)≅ℍ≅SU(2)",
  },
  {
    id: "20000000-0000-0000-0000-000000000017",
    from: Q["Dirac in Real GA"],
    to: Q["Qubit = Spinor"],
    concept: "spinors",
  },
  {
    id: "20000000-0000-0000-0000-000000000018",
    from: Q["Qubit = Spinor"],
    to: Q["Gates as Rotors"],
    concept: "ψ' = RψR†",
  },
  {
    id: "20000000-0000-0000-0000-000000000019",
    from: Q["Gates as Rotors"],
    to: Q["Multi-Qubit & Entanglement"],
    concept: "tensor structure",
  },
  // Phase VIII
  {
    id: "20000000-0000-0000-0000-00000000001a",
    from: Q["The GA Substrate"],
    to: Q["GA-Equivariant AI & EML"],
    concept: "equivariance",
  },
  {
    id: "20000000-0000-0000-0000-00000000001b",
    from: Q["Hehner Predicative Logic"],
    to: Q["GA-Equivariant AI & EML"],
    concept: "EML / predicative",
  },
  {
    id: "20000000-0000-0000-0000-00000000001c",
    from: Q["Ostrowski & the p-adics"],
    to: Q["GA-Equivariant AI & EML"],
    concept: "ultrametric nets",
  },
];

// A few curated, public https resources so key plateaus aren't empty. Interactive
// links carry the "animations" the source doc wants; nothing is fetched here.
export const QC_RESOURCES = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    plateau: Q["τ and Rotors"],
    kind: "Video",
    title: "3Blue1Brown — Quaternions & 3D rotation, visualized",
    uri: "https://www.youtube.com/watch?v=zjMuIxRvygQ",
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    plateau: Q["The GA Substrate"],
    kind: "Interactive",
    title: "bivector.net — Geometric Algebra, interactive intro",
    uri: "https://bivector.net/",
  },
  {
    id: "30000000-0000-0000-0000-000000000003",
    plateau: Q["Clifford Algebra Cl(V,Q)"],
    kind: "Article",
    title: "Hestenes — Geometric Algebra primer (Oersted lecture)",
    uri: "https://geocalc.clas.asu.edu/pdf/OerstedMedalLecture.pdf",
  },
  {
    id: "30000000-0000-0000-0000-000000000004",
    plateau: Q["Elementary Topos Theory"],
    kind: "Article",
    title: "nLab — synthetic differential geometry",
    uri: "https://ncatlab.org/nlab/show/synthetic+differential+geometry",
  },
  {
    id: "30000000-0000-0000-0000-000000000005",
    plateau: Q["Qubit = Spinor"],
    kind: "Interactive",
    title: "quantum.country — Quantum computing for the very curious",
    uri: "https://quantum.country/qcvc",
  },
];
