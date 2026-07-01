# A Curriculum of Plateaus — rebuilding mathematics, physics, and computation on LEM-free foundations

The **master roadmap** for the "ground-up new physicist" lens: the level-0 journey of
main plateaus. It is deliberately NOT the final list — as study exposes a gap or a
subtopic needs depth, **draft a new plateau there, bridge it, go deep, come back**. The
in-app region seeded from [`curriculum.js`](../../apps/web/src/curriculum.js) is the
first (QC ground-up) slice of this program; this document is the long-horizon spine.
How to drive the tool while studying: [STUDY-GUIDE.md](STUDY-GUIDE.md).

## TL;DR

- A coherent multi-year program, **sequenced strictly**: intuitionistic logic + type
  theory FIRST (the load-bearing wall — SIA, topos theory, and the "non-LEM computer"
  all reduce to it), then GA + constructive/smooth analysis in parallel, then rebuilt
  physics, then the computational-hardware layer last.
- **The central reconciliation** — hyperreals (classical, invertible infinitesimals)
  vs SIA (intuitionistic, nilpotent) — is resolved by holding BOTH: the
  constructive-nonstandard bridge (Moerdijk/Palmgren sheaf models) + the
  double-negation translation. Forward-mode AD with dual numbers is literally SIA's
  nilpotent D = {d : d²=0} made computational — the honest on-ramp connecting garust,
  GAPU, and the foundations.
- **The "non-LEM computer" exists in software** (Agda/Coq/Lean ARE intuitionistic
  machines via Curry–Howard) but has never been built as native Heyting hardware; the
  realistic KV260 path is exact-real/interval arithmetic + Kleene-3 "undetermined"
  logic, Ghica's Geometry-of-Synthesis linear-logic-to-FPGA compilation, and an analog
  reservoir front-end with a digital constructive observer (GAPU Layer 1/2).

## Key findings (why this program hangs together)

1. **The foundation is logic, smaller than it looks.** Intuitionistic logic = classical
   minus LEM. Heyting algebra (algebraic), open-set topology (spatial, Tarski 1938),
   Curry–Howard typed λ-calculus (type-theoretic) are the same object three ways — and
   each maps to one goal: hardware logic unit, analog/continuous computation,
   proof-assistant software.
2. **SIA requires intuitionistic logic — not optional.** Kock–Lawvere micro-affineness
   is provably inconsistent with LEM (Bell): LEM forces every nilpotent ε to 0.
3. **GA/GC is mature and physics-complete; its synthesis with SIA is unexplored** — a
   genuine research gap to occupy: geometric calculus inside a smooth topos.
4. **Constructive nonstandard analysis is the bridge**: Moerdijk (1995) / Palmgren
   (1997–98) sheaf models host a hyperreal line inside intuitionistic logic — relocate
   the hyperreals, don't abandon them.
5. **Software non-LEM computers exist; hardware ones don't.** Closest artifacts:
   Ghica's Geometry of Synthesis (POPL 2007 + GoS II–IV) compiling affine-typed
   programs to circuits; Kleene-3 "X" logic already in HDL simulation. Linear logic —
   not Heyting — is what has reached hardware; its no-copy/no-delete = quantum
   no-cloning/no-deleting.
6. **Analog/continuous dynamics are naturally intuitionistic**: open sets = verifiable
   propositions (x > 0 verifiable; x = 0 undecidable). Bournez–Graça–Pouly (J. ACM
   2017): Shannon's GPAC ≡ computable analysis, polynomially — the analog reservoir is
   a rigorous computer.
7. **Gisin's intuitionistic physics** (Nature Physics 16:114–116, 2020; Del Santo &
   Gisin PRA 100:062107, 2019) independently argues LEM-free math is the *right* math
   for physics (finite-information quantities, genuine indeterminism) — peer-reviewed
   motivation, not settled science.

## The plateaus (level-0 spine)

### Plateau 0 — Orientation & tooling (≈1 month)
Read Gisin (Nat. Phys. 2020) + Del Santo–Gisin (PRA 2019); Bell, "An Invitation to
Smooth Infinitesimal Analysis" (~30 pp). **Milestone:** in `garust`, dual numbers as
Cl(0,0,1) + verify forward-mode AD; doc-comment the Rosetta Stone — the same ε is (a) a
degenerate Clifford generator, (b) the AD dual unit, (c) SIA's nilpotent.

### Plateau 1 — Intuitionistic logic & constructive reasoning (≈3–4 months)
van Dalen, *Logic and Structure*; Troelstra & van Dalen (anchor/reference — Vol. 2 is a
spike); SEP "Intuitionistic Logic". Nail: natural deduction/sequent IPC, Heyting
algebras, Kripke semantics, realizability, BHK, double-negation translation.
**Milestone:** a finite Heyting-algebra evaluator in Rust (open sets of a finite space;
∧ ∨ → ¬) mechanically showing ¬¬p→p and p∨¬p fail while ¬¬(p∨¬p) holds — the software
germ of the Heyting logic unit.

### Plateau 2 — Curry–Howard, type theory & proof assistants (≈4–5 months)
Sørensen & Urzyczyn; Girard–Lafont–Taylor *Proofs and Types*; HoTT Book + Escardó's
Agda intro; cubical type theory (Cubical Agda) as the computational univalence.
Martin-Löf DTT as the spine (Π, Σ, identity types). **Milestone:** formalize in
Agda/Lean that Cauchy reals lack decidable equality; re-prove `ufl-discovery`'s
equality-saturation soundness lemma as a checked proof.

### Plateau 3 — Constructive analysis & the two infinitesimals (≈5–6 months)
Bishop & Bridges; Bridges & Vîță; Bell *Primer* (do the physics chapters); Kock *SDG*;
Lavendhomme; Moerdijk & Reyes (existence proof — reference, spike); Keisler + Goldblatt
+ Robinson (hyperreal side); **the bridge:** Palmgren BSL 4(3) 1998, Moerdijk APAL 73
1995, Massas AJL 20(3) 2023. **Rule:** SIA nilpotents for differential/local structure;
hyperreals for global limit/measure/transfer; separate logical modes, translate via ¬¬
or sheaf semantics — never mix proofs directly (transfer uses LEM). **Milestone:**
`garust` Weil-algebra module (Ishii arXiv:2106.14153) — higher-order/multivariate AD
via nilpotents of order > 2, usable by GAPU.

### Plateau 4 — Topos theory & categorical logic (≈4–5 months)
Goldblatt *Topoi* (gentle); Mac Lane & Moerdijk (standard); Johnstone *Elephant*
(reference only). Payoff: internal logic of any topos is intuitionistic; Ω is a Heyting
algebra; ¬¬ is Lawvere–Tierney; SIA's smooth topos is a well-adapted model.
**Milestone:** expository note deriving ∇F = J and one SIA derivative in the internal
language of a topos — first artifact of the original synthesis.

### Plateau 5 — GA & geometric calculus mastery (≈5–6 months, overlaps 3–4)
Macdonald (on-ramp) → Doran & Lasenby (central) → Hestenes & Sobczyk (the calculus
bible — terse, idiosyncratic inner product, treat as reference) → Hestenes NFCM;
Dorst–Fontijne–Mann (computational, → garust); Lounesto; Snygg. **The gap:** GA-in-a-
smooth-topos — redevelop ∇ on Δ-microneighborhoods instead of ε-δ. **Milestone:**
garust at Cl(1,3) parity; Dirac operator; Maxwell as one GA equation numerically; SIA-
style symbolic derivative via the Weil module.

### Plateau 6 — Rebuilding physics (≈8–10 months)
6a mechanics (NFCM + Bell's *Primer*; variational δ as an honest infinitesimal);
6b EM & SR (STA; ∇F = J/(cε₀); boosts as rotors); 6c QM in real GA (Hestenes' real
Dirac, no imaginary unit); 6d GR as Gauge Theory Gravity (Lasenby–Doran–Gull Phil.
Trans. 1998; Hestenes Found. Phys. 2005 — rigorous but minority; flag honestly).
Bridge texts: Baez & Muniain; Frankel (standard-language cross-check). **QFT is an open
frontier, not a stage.** **Milestone:** a code-backed "physics rebuilt" notebook series
(garust/GAPU): orbit, EM field, Dirac scattering, Schwarzschild-in-GTG.

### Plateau 7 — The non-LEM computer: theory (≈4–5 months)
Curry–Howard as the software answer; linear logic + GoI (Girard; Troelstra); optimal
reduction (Lamping, Gonthier–Abadi–Lévy); interaction nets/combinators (Lafont);
quantum λ-calculus (Selinger–Valiron); categorical QM + ZX (Coecke & Kissinger).
**Caveat:** Birkhoff–von Neumann quantum logic is non-distributive — NOT Heyting; use
ZX or topos-theoretic intuitionistic quantum logic instead. Hehner (aPToP, Unified
Algebra, quantum/probabilistic predicative programming) as the specification layer.
**Milestone:** an interaction-net / GoI token-machine evaluator in Rust reducing
linear-λ terms, benchmarked vs a tree-walking interpreter.

### Plateau 8 — The non-LEM computer: hardware/analog/quantum (≈6–8 months)
Honest headline: **no Heyting CPU exists — don't chase an "intuitionistic gate."**
Realize constructive computation by representation: (1) exact-real/interval ALU with a
true/undetermined comparator; (2) Kleene-3 logic unit (HDL "X" is already this);
(3) GoI/interaction-net token core per Ghica GoS; (4) analog reservoir front-end +
digital constructive observer (GAPU L1/L2; Tanaka et al. Neural Networks 2019;
Bournez–Graça–Pouly for legitimacy; BrainScaleS/Loihi as reference points). Quantum
stays a linear-typed target, not a QPU build. **Milestone:** GAPU v0 on KV260 —
interval core + Kleene-3 comparator + small reservoir with trained linear readout.

### Plateau 9 — AI models from the foundation (ongoing, overlaps 5–8)
CGENN (Ruhe et al. NeurIPS 2023), GATr (Brehmer et al. NeurIPS 2023), CliffordLayers,
Clifford-Steerable CNNs, L-GATr; forward-mode AD = dual numbers = SIA nilpotents =
Cl(0,0,1) as the conceptual glue; Friston free-energy/predictive coding for the GAPU
observer-corrector; certified kernels in Agda/Lean (grade-projection equivariance,
IEEE-754 grade corruption). **Milestone:** a GAPU prototype — Clifford-equivariant
reservoir + SIA/dual-number differentiable readout, update equations discovered/
simplified via `ufl-discovery` equality saturation.

## Sequence (do not reorder the first three)

1. **Months 0–8:** logic + type theory + proof assistant (P0–P2). Advance when: Agda
   proof that constructive reals lack decidable equality; hand-derivation of why LEM
   fails in SIA.
2. **Months 6–18:** constructive/smooth analysis + GA in parallel (P3, P5), topos
   theory (P4) once SIA feels concrete. Advance when: garust does Weil-algebra
   higher-order AD + Cl(1,3).
3. **Months 18–30:** rebuild physics (P6). Advance when: the four code-backed
   derivations run.
4. **Months 24–40:** the computer, theory → hardware (P7–P8), AI threaded (P9).
   Benchmark: GAPU v0 on KV260.

**Thresholds that change the plan:** formalization >30% of hours → drop to reading HoTT
+ lightweight Agda. GTG blocks progress → keep EM/QM GA rebuilds, make GTG optional.
KV260 bottlenecks the analog reservoir → emulate in DSP fabric first.

## Caveats (honest flags)

- GTG: rigorous but minority; equivalent to GR in standard regimes; distinctive
  predictions unestablished.
- Gisin: peer-reviewed perspective/comment, contested — motivation, not settled.
- No native Heyting hardware exists; the build *represents* constructive computation.
- Constructive-GA QFT: essentially non-existent — open frontier.
- Realistic total: **3–5+ years** of serious part-time study; estimates are planning
  aids. Difficulty spikes: Moerdijk–Reyes, Hestenes–Sobczyk, the *Elephant*,
  Troelstra–van Dalen Vol. 2 — take the named gentle on-ramps first.
