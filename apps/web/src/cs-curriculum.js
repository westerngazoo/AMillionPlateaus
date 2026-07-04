// cs-curriculum.js — the Computation curriculum: all of computer science, grown
// from Lisp up (SICP's arc), as seeded plateaus + bridges + a followable path.
//
// Same contract as curriculum.js (which this mirrors): pure data, fixed ids in
// reserved namespaces (plateaus 5…, bridges 6…, resources 7…), idempotently
// upserted by main.js via seed_plateau/seed_bridge/seed_resource, so reload/sync
// converge and re-seeding never duplicates (R-0004/R-0027).
//
// The design decision this file carries: computation is not an island. Five
// bridges marked "(meet)" cross INTO the mathematics curriculum — Curry–Howard
// into Intuitionistic Logic, Church numerals into the Real Tower, lazy streams
// into SIA's potential infinity, diagonalization into Classical Logic, reversible
// computation into the qubit — and the path's FINAL STEP is the math path's own
// summit (GA-Equivariant AI & EML). Two journeys, one peak: the paths literally
// intersect on shared plateaus today, ahead of the RFC-0002 domain-meet feature.

import { COMPUTATION_DOMAIN } from "./persona.js";
import { Q } from "./curriculum.js";

const CS = COMPUTATION_DOMAIN;

// Positions live in the Formal(e1)×Creative(e3) quadrant — code is proof AND
// craft — drifting toward Empirical(e2) exactly where computation becomes
// physical (machines, entropy). The trailhead sits ON the lens' canonical
// direction (0.8, 0, 0.6 — a unit vector, so the Programmer's SEED=0.16
// projection clears mp-graph's 0.15 fog threshold on step one, R-0019).
export const CS_PLATEAUS = [
  // ── Phase I · A language you can hold in your head ─────────────────────────
  {
    id: "50000000-0000-0000-0000-000000000001",
    name: "The REPL & S-expressions",
    domain: CS, e1: 0.8, e2: 0.0, e3: 0.6,
    description:
`# The REPL & S-expressions
Lisp's whole syntax is one shape: the parenthesized list, \`(op arg1 arg2 …)\`. Programs and data share it — **code is data** — which is why Lisp can read, transform, and write itself, and why everything later on this island (macros, the metacircular evaluator) is *possible* rather than magic.

The REPL — read, eval, print, loop — is the tightest feedback cycle in programming: a conversation with the machine.

*Embedded analogy:* the REPL is a serial console to a live system — poke a register, read it back, no rebuild.

**Deliverable:** in any Lisp (Racket, Guile, SBCL), write \`assoc\` from scratch — a key → pair lookup over a list of pairs — at the REPL, testing as you go.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000002",
    name: "Recursion & the Substitution Model",
    domain: CS, e1: 0.82, e2: 0.05, e3: 0.55,
    description:
`# Recursion & the Substitution Model
A recursive procedure is a definition that stands on smaller versions of itself; the **substitution model** is SICP's first honest account of what \`(f x)\` *means*: replace the call with the body, arguments substituted. Meaning by rewriting — no machine required yet.

The split that matters: a recursive **process** grows a chain of deferred work; an **iterative** process (tail recursion) carries its state in the arguments and runs in constant space.

**Deliverable:** write factorial both ways, then show by substitution-trace which one grows and which one doesn't.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000003",
    name: "Higher-Order Functions",
    domain: CS, e1: 0.84, e2: 0.02, e3: 0.52,
    description:
`# Higher-order functions
Procedures that take and return procedures. \`map\`, \`filter\`, \`fold\` — three shapes that subsume most loops you will ever write. Abstraction stops being about *values* and starts being about *patterns of control*.

$$\\mathrm{fold}(\\oplus, z, [a_1,\\dots,a_n]) = a_1 \\oplus (a_2 \\oplus (\\cdots \\oplus z))$$

*Embedded analogy:* a fold is a pipeline of combinational stages — the operator is the ALU, the accumulator is the register.

**Deliverable:** implement \`map\` and \`filter\` as folds.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000004",
    name: "Data Abstraction & Closures",
    domain: CS, e1: 0.8, e2: 0.05, e3: 0.58,
    description:
`# Data abstraction & closures
SICP's quiet bombshell: \`cons\`, \`car\`, \`cdr\` need no data at all —

\`\`\`scheme
(define (cons x y) (lambda (m) (m x y)))
(define (car z) (z (lambda (x y) x)))
\`\`\`

A pair is a **closure**: a procedure remembering its birth environment. If data can be procedure, the wall between them was never load-bearing — the *interface* (the contract between constructor and selectors) is the only real thing.

**Deliverable:** extend the trick to \`cdr\`, then build a rational-number type on top of it without ever using native pairs.`,
  },

  // ── Phase II · The calculus underneath (where CS meets mathematics) ────────
  {
    id: "50000000-0000-0000-0000-000000000005",
    name: "The Lambda Calculus",
    domain: CS, e1: 0.92, e2: 0.0, e3: 0.38,
    description:
`# The lambda calculus
Strip Lisp to its skeleton: variables, abstraction $\\lambda x.\\,e$, application $e_1\\,e_2$. Three forms, one rewrite rule (β-reduction) — and it is **universal**: everything computable, expressible here. Church built it in the 1930s as *logic*; it turned out to be *the* programming language, of which all others are costumes.

*Embedded analogy:* the λ-calculus is the transistor of programming — one primitive, composed without limit.

**Deliverable:** β-reduce $(\\lambda x.\\lambda y.\\,x\\,y)(\\lambda z.z)\\,w$ to normal form, every step written out.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000006",
    name: "Church Encodings",
    domain: CS, e1: 0.9, e2: 0.0, e3: 0.42,
    description:
`# Church encodings
Numbers, booleans, pairs — all definable as pure functions. A Church numeral is *iteration itself*: $\\bar{n} = \\lambda f.\\lambda x.\\,f^n(x)$. Addition is composition of iterators; \`true\`/\`false\` are the two projections; the pair trick from Data Abstraction was Church's all along.

This is ℕ **constructed** rather than axiomatized — the same tower the mathematics island raises from Peano through ZFC, built here from λ alone. Two constructions, one ℕ.

**Deliverable:** define Church addition and multiplication, and verify $\\bar{2}+\\bar{2}=\\bar{4}$ by reduction.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000007",
    name: "Types & Curry–Howard",
    domain: CS, e1: 0.94, e2: 0.0, e3: 0.34,
    description:
`# Types & Curry–Howard
The deepest bridge on this island. Read the typed λ-calculus next to natural deduction and the correspondence is exact:

| Logic | Programs |
|---|---|
| proposition $A \\to B$ | function type $A \\to B$ |
| proof | program (a term) |
| proof normalization | evaluation |

And the logic on the left is **intuitionistic** — the LEM-free logic the mathematics island rebuilds everything on. A constructive proof *is* a program you can run; LEM is precisely the axiom with no program witness. Your two journeys are one subject seen from two coasts.

**Deliverable:** exhibit the program whose type is $A \\to (B \\to A)$, and say which propositional axiom it proves.`,
  },

  // ── Phase III · Meaning, state, and self-reference ─────────────────────────
  {
    id: "50000000-0000-0000-0000-000000000008",
    name: "Environments & Mutable State",
    domain: CS, e1: 0.78, e2: 0.08, e3: 0.56,
    description:
`# Environments & mutable state
\`set!\` breaks the substitution model — once a name's value can *change*, "replace the call with the body" stops being true. The repair is the **environment model**: frames of bindings, chained; a closure is code plus a pointer into that chain.

The cost is real: with state, *when* something runs changes *what* it means. Referential transparency — the property that made the first island feel like mathematics — is what you just spent.

**Deliverable:** implement \`make-counter\` (a closure over a mutable count) and explain, with an environment diagram, why two counters don't share.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000009",
    name: "Streams & Lazy Evaluation",
    domain: CS, e1: 0.8, e2: 0.04, e3: 0.55,
    description:
`# Streams & lazy evaluation
Delay evaluation and infinite structures become ordinary values: \`(define ones (cons-stream 1 ones))\` is the whole infinite sequence — as *potential*, computed only as far as you look. Signals, event streams, generators: all this idea.

Constructive mathematics recognizes this immediately: it is **potential infinity** — never a completed infinite totality, always "as far as you ask" — the same stance SIA takes on the continuum.

**Deliverable:** define the stream of Fibonacci numbers via \`stream-map\` over shifted copies of itself, and take its first ten elements.`,
  },
  {
    id: "50000000-0000-0000-0000-00000000000a",
    name: "The Metacircular Evaluator",
    domain: CS, e1: 0.76, e2: 0.02, e3: 0.64,
    description:
`# The metacircular evaluator
Lisp in Lisp: \`eval\` dispatches on expression shape, \`apply\` binds arguments and evaluates bodies, and the two recur through each other. Perhaps forty lines — and the language is now an **object of study inside itself**. Change those lines and you change what the language *is*: lazy Lisp, logic Lisp, your Lisp.

*Embedded analogy:* an emulator running on the very chip it emulates.

**Deliverable:** add a new special form (\`unless\`, say) to a metacircular evaluator — without using macros.`,
  },
  {
    id: "50000000-0000-0000-0000-00000000000b",
    name: "Macros & Syntactic Abstraction",
    domain: CS, e1: 0.74, e2: 0.0, e3: 0.66,
    description:
`# Macros & syntactic abstraction
Because code is data (island step one), a program can rewrite programs **before** they run. Functions abstract over values; macros abstract over *syntax* — control flow, binding forms, whole sub-languages. \`and\`, \`or\`, \`let\` are not primitives; they are macros over \`if\` and \`lambda\`.

The discipline that keeps this safe is **hygiene**: a macro's names must not capture yours.

**Deliverable:** write \`my-let\` as a macro expanding to an immediately-applied \`lambda\`, and show one capture bug hygiene prevents.`,
  },
  {
    id: "50000000-0000-0000-0000-00000000000c",
    name: "Continuations & Control",
    domain: CS, e1: 0.78, e2: 0.0, e3: 0.62,
    description:
`# Continuations & control
A continuation is "the rest of the computation", reified as a value you can store, invoke, or invoke *twice*. \`call/cc\` hands it to you; exceptions, generators, backtracking search, coroutines, async/await — every exotic control construct is this one idea wearing different clothes.

**Deliverable:** use \`call/cc\` to write an early-exit \`product\` over a list that stops multiplying the moment it sees 0.`,
  },

  // ── Phase IV · Cost, limits, and the machine ───────────────────────────────
  {
    id: "50000000-0000-0000-0000-00000000000d",
    name: "Data Structures & Orders of Growth",
    domain: CS, e1: 0.86, e2: 0.1, e3: 0.42,
    description:
`# Data structures & orders of growth
The same interface, wildly different costs: a list finds in $\\Theta(n)$, a balanced tree in $\\Theta(\\log n)$, a hash table in $\\Theta(1)$ amortized. Big-O is the *only* honest summary of an algorithm that survives hardware, language, and decade.

*Embedded analogy:* $\\Theta(\\log n)$ vs $\\Theta(n)$ is a lookup table vs a linear scan of flash — the constant factors change, the shape never does.

**Deliverable:** implement a binary search tree's \`insert\`/\`lookup\` and argue their depth bound on a balanced tree.`,
  },
  {
    id: "50000000-0000-0000-0000-00000000000e",
    name: "Algorithms: Divide, Conquer, Remember",
    domain: CS, e1: 0.86, e2: 0.12, e3: 0.4,
    description:
`# Algorithms: divide, conquer, remember
Three moves generate most of algorithmics: **divide & conquer** (split, solve, merge — mergesort, $T(n)=2T(n/2)+\\Theta(n)$), **greedy** (commit locally, prove it's globally safe), and **dynamic programming** (recursion + a memo — trade space to never solve a subproblem twice).

DP is the island's own trick returned: it is *just* memoized recursion — the substitution model with a cache.

**Deliverable:** write Fibonacci naively, then memoized; measure the cliff between $\\Theta(\\varphi^n)$ and $\\Theta(n)$.`,
  },
  {
    id: "50000000-0000-0000-0000-00000000000f",
    name: "Computability & the Halting Problem",
    domain: CS, e1: 0.94, e2: 0.04, e3: 0.3,
    description:
`# Computability & the halting problem
Church's λ-calculus and Turing's machines define the **same** class of functions — that convergence (Church–Turing) is why "computable" is a discovery, not a convention. And the class has a hole you can exhibit: no program decides whether an arbitrary program halts. The proof is **diagonalization** — feed the supposed decider a program built to contradict it — the same knife Gödel and Cantor drew on the mathematics island.

**Deliverable:** write out the halting-problem contradiction in full, as a six-line program sketch.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000010",
    name: "Interpreters vs Compilers",
    domain: CS, e1: 0.74, e2: 0.1, e3: 0.6,
    description:
`# Interpreters vs compilers
An interpreter *is* the meaning of a program, step by step; a compiler is a **theorem** that a translation preserves that meaning. SICP's register-machine chapter walks the whole gradient: metacircular eval → explicit-control eval → compiled code, each step trading flexibility for speed while the observable behaviour stays fixed.

The Futamura projections make the relationship exact: specializing an interpreter to one program *is* compiling it.

**Deliverable:** hand-compile \`(if (null? x) 0 1)\` into register-machine ops (test, branch, assign), preserving the interpreter's exact behaviour.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000011",
    name: "The Physical Machine",
    domain: CS, e1: 0.6, e2: 0.45, e3: 0.3,
    description:
`# The physical machine
Computation eventually cashes out in matter: gates made of transistors, registers made of gates, the von Neumann fetch–decode–execute loop made of registers. The stored-program idea — instructions *are* data in the same memory — is Lisp's code-is-data, in silicon.

And physics charges for it: **Landauer's principle** — erasing one bit costs at least $kT\\ln 2$ of dissipated heat. Information is physical.

**Deliverable:** trace one fetch–decode–execute cycle for a two-instruction toy ISA, naming what each register holds at each step.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000012",
    name: "Information & Entropy",
    domain: CS, e1: 0.55, e2: 0.5, e3: 0.25,
    description:
`# Information & entropy
Shannon 1948: information is measurable, $H = -\\sum p_i \\log_2 p_i$ — the *average surprise* of a source, in bits. Compression presses toward $H$ from above; error-correcting codes buy reliability under noise for bandwidth. The same $H$, with $k_B$ in front, is thermodynamic entropy — the bridge Landauer walked.

Erasure costs energy; **reversible** computation, in principle, doesn't — which is exactly the door quantum computing enters through: unitary gates are reversible by construction.

**Deliverable:** compute $H$ for a fair coin, a two-headed coin, and a 90/10 coin, and say which one a compressor loves.`,
  },
  {
    id: "50000000-0000-0000-0000-000000000013",
    name: "Learning Machines",
    domain: CS, e1: 0.66, e2: 0.3, e3: 0.45,
    description:
`# Learning machines
A neural network is a program whose behaviour is a **parameter vector**, and training is search in that space: follow $-\\nabla_\\theta \\mathcal{L}$ downhill. The loss $\\mathcal{L}$ is cross-entropy — Shannon's $H$ turned into a training signal — and backpropagation is just the chain rule, applied by a compiler for derivatives (differentiable programming: the interpreter/compiler idea, one more time).

From here the three islands converge: the *geometry* of the parameter space is mathematics, the *substrate and limits* are physics, the *search* is computation. The summit plateau is shared with the mathematics journey — one peak, two ascents.

**Deliverable:** derive the gradient-descent update for one weight of a single sigmoid neuron under cross-entropy loss.`,
  },
];

export const C = Object.fromEntries(CS_PLATEAUS.map((p) => [p.name, p.id]));

// The dependency graph. Bridges marked "(meet)" are cross-domain — Computation ↔
// the mathematics curriculum — and are the intersections the path feature will
// formalize as the domain meet (RFC-0002): Curry–Howard, ℕ-two-ways, potential
// infinity, diagonalization, reversibility, and the shared AI summit.
export const CS_BRIDGES = [
  // Phase I spine
  { id: "60000000-0000-0000-0000-000000000001", from: C["The REPL & S-expressions"], to: C["Recursion & the Substitution Model"], concept: "meaning by rewriting" },
  { id: "60000000-0000-0000-0000-000000000002", from: C["Recursion & the Substitution Model"], to: C["Higher-Order Functions"], concept: "procedures as values" },
  { id: "60000000-0000-0000-0000-000000000003", from: C["Higher-Order Functions"], to: C["Data Abstraction & Closures"], concept: "closures" },
  // Phase II — down to the calculus
  { id: "60000000-0000-0000-0000-000000000004", from: C["Higher-Order Functions"], to: C["The Lambda Calculus"], concept: "λ is all you need" },
  { id: "60000000-0000-0000-0000-000000000005", from: C["The Lambda Calculus"], to: C["Church Encodings"], concept: "numbers as functions" },
  { id: "60000000-0000-0000-0000-000000000006", from: C["The Lambda Calculus"], to: C["Types & Curry–Howard"], concept: "simply-typed λ" },
  { id: "60000000-0000-0000-0000-000000000007", from: C["The Lambda Calculus"], to: C["Computability & the Halting Problem"], concept: "Church–Turing" },
  // Phase III — meaning and state
  { id: "60000000-0000-0000-0000-000000000008", from: C["Data Abstraction & Closures"], to: C["Environments & Mutable State"], concept: "assignment breaks substitution" },
  { id: "60000000-0000-0000-0000-000000000009", from: C["Environments & Mutable State"], to: C["Streams & Lazy Evaluation"], concept: "streams tame state" },
  { id: "60000000-0000-0000-0000-00000000000a", from: C["Data Abstraction & Closures"], to: C["The Metacircular Evaluator"], concept: "eval/apply" },
  { id: "60000000-0000-0000-0000-00000000000b", from: C["The Metacircular Evaluator"], to: C["Macros & Syntactic Abstraction"], concept: "code is data" },
  { id: "60000000-0000-0000-0000-00000000000c", from: C["The Metacircular Evaluator"], to: C["Continuations & Control"], concept: "explicit control" },
  { id: "60000000-0000-0000-0000-00000000000d", from: C["The Metacircular Evaluator"], to: C["Interpreters vs Compilers"], concept: "from eval to compile" },
  // Phase IV — cost, limits, machine
  { id: "60000000-0000-0000-0000-00000000000e", from: C["Recursion & the Substitution Model"], to: C["Data Structures & Orders of Growth"], concept: "orders of growth" },
  { id: "60000000-0000-0000-0000-00000000000f", from: C["Data Structures & Orders of Growth"], to: C["Algorithms: Divide, Conquer, Remember"], concept: "design paradigms" },
  { id: "60000000-0000-0000-0000-000000000010", from: C["Interpreters vs Compilers"], to: C["The Physical Machine"], concept: "register machines" },
  { id: "60000000-0000-0000-0000-000000000011", from: C["The Physical Machine"], to: C["Information & Entropy"], concept: "Landauer's principle" },
  { id: "60000000-0000-0000-0000-000000000012", from: C["Algorithms: Divide, Conquer, Remember"], to: C["Learning Machines"], concept: "search as descent" },
  { id: "60000000-0000-0000-0000-000000000013", from: C["Information & Entropy"], to: C["Learning Machines"], concept: "cross-entropy loss" },
  // The meets — Computation ↔ Mathematics (cross-domain, RFC-0002 material)
  { id: "60000000-0000-0000-0000-000000000014", from: C["Types & Curry–Howard"], to: Q["Intuitionistic Logic"], concept: "proofs are programs (meet)" },
  { id: "60000000-0000-0000-0000-000000000015", from: C["Church Encodings"], to: Q["The Real Tower ℕ→ℤ→ℚ→ℝ"], concept: "ℕ, constructed twice (meet)" },
  { id: "60000000-0000-0000-0000-000000000016", from: C["Streams & Lazy Evaluation"], to: Q["SIA Infinitesimals (Kock–Lawvere)"], concept: "potential infinity (meet)" },
  { id: "60000000-0000-0000-0000-000000000017", from: C["Computability & the Halting Problem"], to: Q["Classical Predicate Logic"], concept: "diagonalization (meet)" },
  { id: "60000000-0000-0000-0000-000000000018", from: C["Information & Entropy"], to: Q["Qubit = Spinor"], concept: "reversible computation (meet)" },
  { id: "60000000-0000-0000-0000-000000000019", from: C["Learning Machines"], to: Q["GA-Equivariant AI & EML"], concept: "one summit, two ascents (meet)" },
];

// Curated public starting resources (R-0027 pattern) — so the island isn't bare.
export const CS_RESOURCES = [
  {
    id: "70000000-0000-0000-0000-000000000001",
    plateau: C["The REPL & S-expressions"], kind: "Article",
    title: "SICP — Structure and Interpretation of Computer Programs (full text)",
    uri: "https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/index.html",
  },
  {
    id: "70000000-0000-0000-0000-000000000002",
    plateau: C["The REPL & S-expressions"], kind: "Video",
    title: "MIT 6.001 (1986) — Abelson & Sussman, Lecture 1a",
    uri: "https://www.youtube.com/watch?v=-J_xL4IGhJA",
  },
  {
    id: "70000000-0000-0000-0000-000000000003",
    plateau: C["The REPL & S-expressions"], kind: "Tool",
    title: "Racket — a batteries-included Scheme to learn in",
    uri: "https://racket-lang.org/",
  },
  {
    id: "70000000-0000-0000-0000-000000000004",
    plateau: C["Types & Curry–Howard"], kind: "Article",
    title: "nLab — propositions as types",
    uri: "https://ncatlab.org/nlab/show/propositions+as+types",
  },
  {
    id: "70000000-0000-0000-0000-000000000005",
    plateau: C["Information & Entropy"], kind: "Paper",
    title: "Shannon (1948) — A Mathematical Theory of Communication",
    uri: "https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf",
  },
  {
    id: "70000000-0000-0000-0000-000000000006",
    plateau: C["Learning Machines"], kind: "Video",
    title: "3Blue1Brown — Gradient descent, how neural networks learn",
    uri: "https://www.youtube.com/watch?v=IHZwWFHWa-w",
  },
];

// The second seeded PATH (R-0039): the whole CS journey in dependency order —
// whose LAST step is the mathematics path's summit plateau. Two seeded paths
// now share a step: the first literal path intersection in the world.
export const CS_PATHS = [
  {
    id: "40000000-0000-0000-0000-000000000002",
    title: "Master Computation, from Lisp Up",
    goal:
      "All of computer science grown from one seed — the REPL — through the " +
      "lambda calculus, meaning, machines, and information, converging with " +
      "mathematics and physics at learning machines on the GA substrate.",
    steps: [...CS_PLATEAUS.map((p) => p.id), Q["GA-Equivariant AI & EML"]],
  },
];
