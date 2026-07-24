# R-0096 — 🎓 Your degree as a lens, with a GA/SIA twin per topic

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-23
- **Depends on:** R-0038 (lenses), R-0057 (GA + SIA lenses), R-0065 (lens → numbered path),
  R-0093/R-0093a (a lens is a portable, publishable bundle).
- **Source:** the owner, attaching their curricular map: "this is the program I am following in my
  university, let's put it as a lens — and in each topic I would like to use the normal lens, the
  usual programmed one, and have a GA alternative lens, so I can be studying each of the topics to
  pass my classes but also have my own GA view of how it'd apply. Also SIA calculus: I study the
  usual way and alternative SIA."

## 1. Statement

The owner's actual degree — **Licenciatura en Física, plan FÍSICA-2019, Universitario Tecnológico
Terra at Mundi Universitam**; cuatrimestral, 10 cuatrimestres, 49 asignaturas, 381 créditos — is
now a lens of its own, seeded from the curricular map: every asignatura is a plateau carrying its
clave, cuatrimestre, créditos and seriación, wired by the prerequisite chains the map prints, and
followable as a numbered path in the official order.

It is deliberately **not** more plateaus in the Physics lens. The Physics lens answers *how does the
world work*; this one answers *what must I pass, and in what order*. Keeping them apart is what
makes the second half of the request possible.

**The parallel view.** Each topic is studied twice on purpose: the orthodox treatment the syllabus
examines, and the same content rebuilt in an alternative formalism — **GA** for the
geometry/algebra/mechanics spine, **SIA** for the calculus spine. A twin is a first-class plateau in
*its own* lens (GA or SIA), joined to its course by a cross-lens bridge labelled uniformly
`alternative formulation of`. That edge is the domain meet the model is built on, it is what
R-0093a's `external_bridges` preserve when a lens is published, and it makes course ⇄ twin
machine-findable for the ⇄ affordance in R-0097.

Twin depth follows where the owner is: **cuatrimestres 1–3 are written**; later cuatrimestres carry
the course plateau only, and their twins get written as the degree advances.

## 2. Acceptance criteria

- **AC1** — all **49 asignaturas** from the map are seeded as plateaus in a new
  `UNIVERSITAM_DOMAIN` lens, each body carrying its clave, cuatrimestre, créditos, seriación, what
  the course covers, what the exam wants, and a concrete Deliverable. Ids are fixed UUIDs in a
  reserved namespace, idempotently upserted like every other curriculum.
- **AC2** — the **seriación printed on the map** is seeded as bridges (Cálculo I→II→III→IV, Álgebra
  Superior→Lineal I→II, Física I→II→III→IV, Electro I→II, Cuántica I→II→III, Estadística I→II,
  Computacional I→II, Intro Física→Física I), plus the implicit dependencies the map omits but the
  material demands (e.g. Cálculo IV's integral theorems → Electromagnetismo II).
- **AC3** — **10 alternative-formalism twins** for cuatrimestres 1–3, each living in GA_DOMAIN or
  SIA_DOMAIN (never in the degree lens): SIA for Introducción al cálculo, Cálculo I and Cálculo II;
  GA for Introducción al álgebra, Introducción a la Física, Álgebra Superior, Geometría Analítica,
  Óptica, Álgebra Lineal I and Física I. Every twin is joined to its course by an
  `alternative formulation of` bridge, and each twin says explicitly that the exam wants the
  official treatment.
- **AC4** — two followable paths: the degree in its official order (49 steps), and a separate
  parallel-view path over the twins, so the alternative route can be followed on its own.
- **AC5** — the degree lens is registered in `DOMAINS`, so it is faceable, labelled (never
  "Uncharted"), pickable in Draft-a-plateau, and publishable as a lens bundle (R-0093).
- **AC6** — content renders correctly in the app's markdown subset; guarded by tests.
- **AC7** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-23 created (Accepted) + implemented. Suite 607/607 (10 new). Live-verified: HUD reports
  **170 topics · 173 bridges** (111 + 49 courses + 10 twins); the picker shows "Licenciatura en
  Física — Universitam — 49 topics" with GA 7→14 and SIA 5→8; searching "Geometría Analítica"
  returns **both** the course and its GA twin; opening a course shows its clave/cuatrimestre/
  seriación; opening a twin renders its heading, KaTeX display math and prose cleanly.
- 2026-07-23 — two content-rendering defects found by live verification and fixed before merge, both
  caused by `markdown.js`'s strict block rules rather than by the app: (1) prose was hard-wrapped at
  ~80 columns, and lines inside one block join with `<br>` and **no space**, gluing words together
  ("in allits forms") — paragraphs are now one line each, the house style the other curricula
  already follow; (2) the twin note used a `>` blockquote, which the renderer does not support (it
  renders h1–h6, p, br, strong, em, code, pre, lists, a, span, img only), so the markers showed
  literally — it now leads with bold. A test renders **every** body and asserts the heading is a
  real `<h1>`, no literal `#` or `>` leaks, and no `<br>` glues two words.
- 2026-07-23 — **noted, not fixed here:** the literal-`#` problem is pre-existing across *all* the
  seeded curricula (physics-core, math, music, CS, QC all render their title as a literal `# Title`
  because a heading only becomes a heading when it is its own block). R-0096's content is correct;
  repairing the others is a separate change.
- 2026-07-23 — transcription notes from the source map, seeded as printed with the discrepancy
  called out in the body: FIS-1924 in cuatrimestre 5 repeats the title "Ecuaciones Diferenciales
  Ordinarias" already used by FIS-1913 (almost certainly meant to be *Parciales*); Metrología is
  printed `FIS-1834` and Mecánica Relativista `FIS-1843` (1934/1943 by sequence); Astronomía and
  Teoría del Caos carry no clave on the map (FIS-1935/FIS-1945 inferred from position).

## R-0096a — FIS-1924 confirmed as PDEs (2026-07-23)

The owner confirmed with their coordinación: FIS-1924 is **Ecuaciones Diferenciales Parciales**, not a
second ODE course (the map repeated FIS-1913's title). Renamed, its body rewritten to explain why
PDEs are the load-bearing prerequisite (Laplace/Poisson = electrostatics with boundaries; the wave
equation = Maxwell in vacuum; the Schrödinger equation = a parabolic PDE, and the hydrogen atom is
separation of variables in spherical coordinates). Three bridges wire the real dependency chain that
the map omitted: **ODEs (FIS-1913) → PDEs (FIS-1924) → Electromagnetismo II (FIS-1926)** and **PDEs
→ Mecánica Cuántica I (FIS-1930)** (BR(21), the "Schrödinger equation is a PDE" edge, re-pointed to
originate at the PDE topic rather than at ODEs). Suite 608/608 (1 new test asserting the chain);
live: 170 topics · **175 bridges** (was 173).
