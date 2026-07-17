// math-curriculum.js — the DETAILED mathematics core (R-0067), for the Geometer
// lens (and any MATH-facing lens). Mathematics had only 4 bare seed plateaus
// (Arithmetic/Algebra/Geometry/Calculus, no bodies, no path); this seeds the
// granular Khan-Math / OpenStax sequence a learner actually walks — number sense
// up through calculus, stats and a first taste of linear algebra — as real,
// numbered, followable plateaus.
//
// Same contract as the other curricula: pure data, fixed ids in a reserved MATH
// namespace (plateaus e0…, bridges e1…, resources e2…, path e3…), idempotently
// upserted by main.js via seed_plateau/seed_bridge/seed_resource. Each body ends
// in a concrete **Deliverable** and a **Study (official)** pointer (Khan Academy /
// OpenStax) so the teaching is source-grounded, not generic. Math is the FORMAL
// axis (e1-dominant), matching the seed pillars.

import { MATH_DOMAIN } from "./persona.js";

const ARITHMETIC = "00000000-0000-0000-0000-0000000000a1"; // the seed MATH trailhead, threaded into

export const MATH_PLATEAUS = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    name: "Number Sense & Operations",
    domain: MATH_DOMAIN, e1: 0.95, e2: 0.08, e3: 0.05,
    description:
`# Number Sense & Operations
The number line and the four operations, made rigorous: place value, integers and the rules of signs, order of operations (PEMDAS), factors, multiples, primes, and the divisibility that powers fractions later. Negative numbers are the first real abstraction — a direction, not just a count — and the number line is the picture that carries you all the way to the reals.

**Deliverable:** compute $-3 - (-7) \\times 2$ by the order of operations, and state which prime factorization $360$ has.

**Study (official):** Khan Academy — *Arithmetic* / *Pre-algebra: Factors and multiples*; OpenStax *Prealgebra 2e*, Ch. 1–3.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    name: "Fractions, Decimals & Percents",
    domain: MATH_DOMAIN, e1: 0.92, e2: 0.1, e3: 0.06,
    description:
`# Fractions, Decimals & Percents
Three notations for the same rational number, and the fluent translation between them. A fraction $a/b$ is a division and a ratio; a common denominator is what lets you add them; a decimal is base-ten place value continued past the point; a percent is "per hundred". Master this and every later formula that hides a rate becomes readable.

**Deliverable:** show $\\tfrac{3}{8} = 0.375 = 37.5\\%$, and add $\\tfrac{2}{3} + \\tfrac{1}{4}$ by a common denominator.

**Study (official):** Khan Academy — *Fractions* and *Decimals*; OpenStax *Prealgebra 2e*, Ch. 4–5.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    name: "Ratios, Rates & Proportions",
    domain: MATH_DOMAIN, e1: 0.9, e2: 0.14, e3: 0.06,
    description:
`# Ratios, Rates & Proportions
A ratio compares two quantities; a rate is a ratio with units ($\\text{km}/\\text{h}$); a proportion sets two ratios equal, $\\tfrac{a}{b} = \\tfrac{c}{d}$, and cross-multiplication solves it. Proportional reasoning — "$y$ is $k$ times $x$" — is the seed of linear functions and of unit conversion, the single most reused skill in physics and chemistry.

**Deliverable:** if $5$ workers build a wall in $12$ days, use a proportion to find how long $8$ workers take (state the assumption).

**Study (official):** Khan Academy — *Ratios, rates, & percentages*; OpenStax *Prealgebra 2e*, Ch. 6.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000004",
    name: "Variables & Algebraic Expressions",
    domain: MATH_DOMAIN, e1: 0.88, e2: 0.16, e3: 0.08,
    description:
`# Variables & Algebraic Expressions
The leap from arithmetic to algebra: a letter stands for any number, so a pattern becomes an expression you can manipulate. The distributive law $a(b+c)=ab+ac$, combining like terms, and evaluating/​simplifying are the grammar. "Solve for the unknown" is just doing the same operation to both sides until the letter stands alone.

**Deliverable:** simplify $3(2x-4) - (x-5)$ and evaluate it at $x=3$.

**Study (official):** Khan Academy — *Algebra basics: Introduction to algebra*; OpenStax *Elementary Algebra 2e*, Ch. 2.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000005",
    name: "Linear Equations & Inequalities",
    domain: MATH_DOMAIN, e1: 0.85, e2: 0.2, e3: 0.1,
    description:
`# Linear Equations & Inequalities
A line is $y = mx + b$ — slope $m$ (rise over run, the rate) and intercept $b$. Solving $ax+b=0$, graphing lines, and reading systems of two equations (substitution, elimination, or the point where two lines meet) is the workhorse of applied math. Inequalities are the same moves, with the rule that multiplying by a negative flips the sign.

**Deliverable:** solve the system $y = 2x+1$, $y = -x+7$ both algebraically and as the intersection of two lines.

**Study (official):** Khan Academy — *Algebra 1: Linear equations & graphs*; OpenStax *Elementary Algebra 2e*, Ch. 3–4.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000006",
    name: "Functions & Their Graphs",
    domain: MATH_DOMAIN, e1: 0.82, e2: 0.22, e3: 0.12,
    description:
`# Functions & Their Graphs
A function is a machine: one input, one output, $f(x)$. Domain and range, function notation, composition $f(g(x))$, inverses, and the shape-library (linear, absolute-value, step) plus transformations — shifts, stretches, reflections — that turn one graph into a family. This is the object the rest of mathematics is *about*.

**Deliverable:** given $f(x)=2x-3$, find $f^{-1}(x)$ and verify $f(f^{-1}(x))=x$.

**Study (official):** Khan Academy — *Algebra 1: Functions*; OpenStax *Algebra and Trigonometry 2e*, Ch. 3.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000007",
    name: "Quadratics & Polynomials",
    domain: MATH_DOMAIN, e1: 0.8, e2: 0.24, e3: 0.12,
    description:
`# Quadratics & Polynomials
Beyond straight lines: $ax^2+bx+c$ and its parabola. Factoring, completing the square, and the quadratic formula $x = \\tfrac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ (whose discriminant $b^2-4ac$ counts the real roots). Polynomials generalize the idea — degree, roots, end behavior — and the factor theorem ties roots to factors.

**Deliverable:** solve $x^2 - 6x + 8 = 0$ two ways (factoring and the quadratic formula) and say what the discriminant predicted.

**Study (official):** Khan Academy — *Algebra 1: Quadratics*; OpenStax *Algebra and Trigonometry 2e*, Ch. 5.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000008",
    name: "Exponentials & Logarithms",
    domain: MATH_DOMAIN, e1: 0.78, e2: 0.26, e3: 0.14,
    description:
`# Exponentials & Logarithms
Repeated multiplication: $a^x$ grows (or decays) by a constant *factor* per step, the shape of compound interest, population, and radioactive decay. The logarithm is its inverse — $\\log_a y = x \\iff a^x = y$ — turning multiplication into addition (the laws $\\log(xy)=\\log x+\\log y$). $e$ and the natural log are the calculus-friendly base.

**Deliverable:** solve $2^{x} = 40$ using logarithms, to two decimals.

**Study (official):** Khan Academy — *Algebra 2: Exponential & logarithmic functions*; OpenStax *Algebra and Trigonometry 2e*, Ch. 6.`,
  },
  {
    id: "e0000000-0000-0000-0000-000000000009",
    name: "Euclidean & Coordinate Geometry",
    domain: MATH_DOMAIN, e1: 0.74, e2: 0.16, e3: 0.34,
    description:
`# Euclidean & Coordinate Geometry
Shape and proof: points, lines, angles, congruence and similarity, the Pythagorean theorem $a^2+b^2=c^2$, area and volume. Coordinate geometry puts it on the plane — the distance and midpoint formulas, the equation of a circle $(x-h)^2+(y-k)^2=r^2$ — so geometric facts become algebra and vice-versa. Proof is where "why", not just "what", is learned.

**Deliverable:** prove the distance between $(1,2)$ and $(4,6)$ is $5$, and write the circle centered there through the other point.

**Study (official):** Khan Academy — *Geometry (all)*; OpenStax *Elementary Algebra 2e* (coordinate geometry) + Euclidean geometry references.`,
  },
  {
    id: "e0000000-0000-0000-0000-00000000000a",
    name: "Trigonometry",
    domain: MATH_DOMAIN, e1: 0.72, e2: 0.22, e3: 0.3,
    description:
`# Trigonometry
The mathematics of angles and periodicity. Sine, cosine, tangent from the right triangle (SOH-CAH-TOA) and then the **unit circle**, where they become functions of any angle and the source of every wave. Radians, the identities ($\\sin^2\\theta+\\cos^2\\theta=1$), and the laws of sines/cosines for non-right triangles. This is the bridge to waves, oscillation, and Fourier.

**Deliverable:** using the unit circle, give exact values of $\\sin$, $\\cos$, $\\tan$ at $\\theta = \\tfrac{\\pi}{6}$.

**Study (official):** Khan Academy — *Trigonometry*; OpenStax *Algebra and Trigonometry 2e*, Ch. 7–10.`,
  },
  {
    id: "e0000000-0000-0000-0000-00000000000b",
    name: "Precalculus & Limits",
    domain: MATH_DOMAIN, e1: 0.7, e2: 0.28, e3: 0.2,
    description:
`# Precalculus & Limits
The on-ramp to calculus: rational and piecewise functions, sequences and series, and the central new idea — the **limit**, $\\lim_{x\\to a} f(x)$, "what value does $f$ approach". Continuity, one-sided limits, and the behavior at infinity make precise the "arbitrarily close" that derivatives and integrals both rest on.

**Deliverable:** evaluate $\\lim_{x\\to 2}\\dfrac{x^2-4}{x-2}$ by factoring, and explain why you can't just substitute.

**Study (official):** Khan Academy — *Precalculus* + *Limits and continuity*; OpenStax *Precalculus 2e* / *Calculus Vol. 1*, Ch. 2.`,
  },
  {
    id: "e0000000-0000-0000-0000-00000000000c",
    name: "Differential Calculus",
    domain: MATH_DOMAIN, e1: 0.66, e2: 0.32, e3: 0.22,
    description:
`# Differential Calculus
The derivative $f'(x) = \\lim_{h\\to0}\\tfrac{f(x+h)-f(x)}{h}$ — the instantaneous rate of change, the slope of the tangent. The rules (power, product, quotient, chain) make it mechanical; applications are everywhere: velocity from position, optimization (max/min where $f'=0$), and related rates. This is the first half of the calculus the seed "Calculus" pillar names.

**Deliverable:** differentiate $f(x) = (3x^2+1)^4$ with the chain rule, and find where $g(x)=x^3-3x$ has its local extrema.

**Study (official):** Khan Academy — *Differential calculus* (AP Calculus AB); OpenStax *Calculus Vol. 1*, Ch. 3–4.`,
  },
  {
    id: "e0000000-0000-0000-0000-00000000000d",
    name: "Integral Calculus",
    domain: MATH_DOMAIN, e1: 0.64, e2: 0.34, e3: 0.22,
    description:
`# Integral Calculus
The integral $\\int f\\,dx$ — accumulation and area under a curve — and the **Fundamental Theorem of Calculus** that makes it the inverse of the derivative: $\\int_a^b f'(x)\\,dx = f(b)-f(a)$. Techniques (substitution, parts) and applications (area, volume, average value, and the "sum of infinitely many infinitesimal pieces" that reappears in every physics integral).

**Deliverable:** evaluate $\\int_0^2 (3x^2)\\,dx$ and state, in one line, why the answer is $x^3$ evaluated at the endpoints.

**Study (official):** Khan Academy — *Integral calculus* (AP Calculus BC); OpenStax *Calculus Vol. 1*, Ch. 5–6.`,
  },
  {
    id: "e0000000-0000-0000-0000-00000000000e",
    name: "Probability & Statistics",
    domain: MATH_DOMAIN, e1: 0.7, e2: 0.42, e3: 0.14,
    description:
`# Probability & Statistics
Reasoning under uncertainty. Descriptive statistics (mean, median, spread, the normal distribution) and probability (sample spaces, conditional probability, Bayes' rule $P(A|B) = \\tfrac{P(B|A)P(A)}{P(B)}$, expected value). This is the empirical wing of mathematics — how data becomes a claim — and the language of every experiment.

**Deliverable:** two fair dice are rolled; find $P(\\text{sum}=7)$ and the expected value of the sum.

**Study (official):** Khan Academy — *Statistics and probability*; OpenStax *Introductory Statistics 2e*.`,
  },
  {
    id: "e0000000-0000-0000-0000-00000000000f",
    name: "Linear Algebra: Vectors & Matrices",
    domain: MATH_DOMAIN, e1: 0.68, e2: 0.3, e3: 0.24,
    description:
`# Linear Algebra: Vectors & Matrices
The mathematics of many dimensions at once. Vectors and vector spaces, matrices as linear maps, matrix multiplication as composition, the determinant (a signed volume), eigenvalues/eigenvectors (the directions a map only scales), and solving $A\\mathbf{x}=\\mathbf{b}$. This is the language of graphics, data, quantum mechanics — and, in this world, of the geometric-algebra lens.

**Deliverable:** find the eigenvalues of $\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}$ and one eigenvector for each.

**Study (official):** Khan Academy — *Linear algebra*; 3Blue1Brown — *Essence of Linear Algebra*; OpenStax *(Linear Algebra references)*.`,
  },
];

// ── Prerequisite spine (build order) + a link from the seed Arithmetic trailhead ─
const M = (n) => `e0000000-0000-0000-0000-0000000000${n}`;
export const MATH_BRIDGES = [
  { id: "e1000000-0000-0000-0000-000000000001", from: ARITHMETIC, to: M("01"), concept: "arithmetic made rigorous — the number line" },
  { id: "e1000000-0000-0000-0000-000000000002", from: M("01"), to: M("02"), concept: "division of integers becomes fractions & decimals" },
  { id: "e1000000-0000-0000-0000-000000000003", from: M("02"), to: M("03"), concept: "a ratio is a fraction with units" },
  { id: "e1000000-0000-0000-0000-000000000004", from: M("03"), to: M("04"), concept: "a proportion generalizes to a variable" },
  { id: "e1000000-0000-0000-0000-000000000005", from: M("04"), to: M("05"), concept: "an expression set equal is an equation" },
  { id: "e1000000-0000-0000-0000-000000000006", from: M("05"), to: M("06"), concept: "a line is a function; generalize" },
  { id: "e1000000-0000-0000-0000-000000000007", from: M("06"), to: M("07"), concept: "beyond linear — quadratics & polynomials" },
  { id: "e1000000-0000-0000-0000-000000000008", from: M("07"), to: M("08"), concept: "polynomials to exponential growth" },
  { id: "e1000000-0000-0000-0000-000000000009", from: M("06"), to: M("09"), concept: "functions on the coordinate plane" },
  { id: "e1000000-0000-0000-0000-00000000000a", from: M("09"), to: M("0a"), concept: "angles on the unit circle" },
  { id: "e1000000-0000-0000-0000-00000000000b", from: M("0a"), to: M("0b"), concept: "periodic functions & the limit" },
  { id: "e1000000-0000-0000-0000-00000000000c", from: M("08"), to: M("0b"), concept: "exponentials need the limit too" },
  { id: "e1000000-0000-0000-0000-00000000000d", from: M("0b"), to: M("0c"), concept: "the limit becomes the derivative" },
  { id: "e1000000-0000-0000-0000-00000000000e", from: M("0c"), to: M("0d"), concept: "the derivative's inverse is the integral" },
  { id: "e1000000-0000-0000-0000-00000000000f", from: M("03"), to: M("0e"), concept: "proportions → data & probability" },
  { id: "e1000000-0000-0000-0000-000000000010", from: M("06"), to: M("0f"), concept: "functions of many variables → vectors & matrices" },
];

// Canonical, free/official references (R-0027 shape).
export const MATH_RESOURCES = [
  { id: "e2000000-0000-0000-0000-000000000001", plateau: M("01"), title: "Khan Academy — Arithmetic (full course)", kind: "Course", uri: "https://www.khanacademy.org/math/arithmetic" },
  { id: "e2000000-0000-0000-0000-000000000002", plateau: M("06"), title: "OpenStax — Algebra and Trigonometry 2e", kind: "Book", uri: "https://openstax.org/details/books/algebra-and-trigonometry-2e" },
  { id: "e2000000-0000-0000-0000-000000000003", plateau: M("0c"), title: "3Blue1Brown — Essence of Calculus", kind: "Video", uri: "https://www.3blue1brown.com/topics/calculus" },
  { id: "e2000000-0000-0000-0000-000000000004", plateau: M("0c"), title: "OpenStax — Calculus Volume 1", kind: "Book", uri: "https://openstax.org/details/books/calculus-volume-1" },
  { id: "e2000000-0000-0000-0000-000000000005", plateau: M("0f"), title: "3Blue1Brown — Essence of Linear Algebra", kind: "Video", uri: "https://www.3blue1brown.com/topics/linear-algebra" },
];

// The numbered curriculum path — number sense → calculus → stats & linear algebra.
export const MATH_PATH = {
  id: "e3000000-0000-0000-0000-000000000001",
  title: "The Mathematics Core",
  goal: "Walk the Khan/OpenStax sequence end to end: number sense → algebra → geometry & trig → calculus, with probability and a first linear algebra.",
  steps: [
    ARITHMETIC, // seed trailhead
    M("01"), M("02"), M("03"), M("04"), M("05"), M("06"), M("07"), M("08"),
    M("09"), M("0a"), M("0b"), M("0c"), M("0d"), M("0e"), M("0f"),
  ],
  domains: [MATH_DOMAIN],
};
