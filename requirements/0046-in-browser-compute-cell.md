# R-0046 — In-browser compute cell: run real Python on a plateau, offline

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-04
- **Depends on:** R-0020 (plateau content + read view — where the cell lives), R-0023 (plateau Study
  view + inline resource add), R-0034 (`cas.js` — the deterministic *checker* this complements with
  open-ended *compute*), R-0014 (trail markers / resource kinds — the "Notebook" resource this saves
  as), R-0004/R-0012 (CRDT sync + IndexedDB durability — how a saved Notebook travels), R-0036
  (persist & share — the deliberate-publish pattern). Composes existing primitives; adds one
  lazily-loaded runtime.
- **Realized by:** SPEC-0046 (Accepted, architect-reviewed APPROVE-WITH-NITS 2026-07-04)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

On a plateau, a learner can **open a compute cell and run real Python in the browser** — write
code, press Run, see the output (text, values, and plots) inline — with the scientific stack
(`numpy`, `sympy`) available on demand. The runtime is **Pyodide** (CPython compiled to WASM); it
runs **entirely client-side**, needs **no server and no model**, and is **loaded lazily** — nothing
downloads until the learner first opens a cell, so the map's first paint is untouched. The runtime
is **self-hosted from the app's own origin** (placed into the deployed site at build time), so a
learner who has loaded it once can compute **offline**, and the app still makes **no third-party
request** except the visitor's own chosen model endpoint. A cell's code can be **saved to the
plateau as a "Notebook" resource**, so it travels with the graph (CRDT) — a plateau can ship
**runnable worked examples**, and a learner can share a computation the same deliberate way they
share a proof (R-0036).

## 2. Rationale

The owner asked why the study surface only *links out* to search, and named notebooks/Jupyter:
they want to **do**, not only read. The project already *verifies* answers deterministically
(`cas.js`, R-0034) over a closed grammar — but that engine cannot be *programmed*. A compute cell
is the open-ended complement: instead of reading *about* a rotor you **build one**; instead of
being told `ε² = 0` you **evaluate it**; you integrate, simulate a qubit gate, plot a field. This is
the concrete form of the owner's standing goal — *"deeper and more interactive than a book."* It is
especially apt for this curriculum (GA, LEM-free maths, physics, quantum): the geometry and the
algebra become things the learner runs, not prose they skim. And because Pyodide is fully offline
once cached, the cell **joins the offline-first floor** (R-0026 digest, R-0030 self-attest, R-0034
CAS) as its *exploratory* rung — rigor you can drive yourself, with no model and no network.

## 3. Acceptance criteria

- **AC1 — A cell on the plateau.** The Study view offers **"Compute"**, opening a code editor
  (textarea) + **Run** on the current plateau. Available with **no model connected**. Opening the
  Study view or the map does **not** load the runtime.

- **AC2 — Lazy runtime, honest states.** Pyodide loads **only on the first Run** (or first cell
  open), from the **app's own origin**. While it loads the cell shows a clear **loading** state;
  once ready, subsequent runs are immediate. If the runtime asset is unreachable (never cached +
  offline), the cell says so plainly and stays usable once connectivity returns — it never hangs
  silently and never falls back to a third-party host.

- **AC3 — Real execution + output.** Run executes the cell's Python and shows **stdout**, the
  **last-expression value**, and **errors/tracebacks** inline. A run that raises shows the traceback,
  not a crash. Long/looping code is bounded so a runaway cell cannot wedge the tab (a stop/timeout
  or worker isolation).

- **AC4 — Scientific stack on demand.** `import numpy` / `import sympy` work, loaded **on demand**
  the first time they're used (not eagerly). Plots render inline as an image. The exact package set
  is SPEC-0046's call, but `numpy` + `sympy` are in scope (the math/physics curriculum).

- **AC5 — Save as a Notebook resource.** A cell can be **saved to the plateau** as a new
  **"Notebook"** resource kind — its **code and title become a resource attached to the plateau,
  and the code travels with the graph (CRDT)** so the same Notebook opens on any device/peer synced
  to the world. It is broadcast + persisted like any other resource, appears in the Study drawer, and
  shows as a **typed marker dot** on the map (its own colour in `MARKER_KIND`, per the R-0014
  declutter model). Opening a saved Notebook **loads its code back into a runnable cell**. (Because
  the resource carries no body today, this admits **one small, additive core change** — see AC8.)

- **AC6 — Offline & same-origin.** Once the runtime has been fetched once, a cell **runs with the
  network off**. The runtime is served from the deployed site's **own origin** (self-hosted at
  build time) — no runtime dependency on a third-party CDN, consistent with the app's "no external
  request except the chosen model" property.

- **AC7 — Safe & sandboxed.** Cell execution is confined to the Pyodide/WASM sandbox: it cannot
  read the visitor's model key, cannot touch graph geometry (positions/rotors/reputation stay in
  garust), and cannot make network calls on the learner's behalf beyond loading its own packages
  from the app origin. Saved Notebook code is **data**, never auto-executed on load — the learner
  presses Run.

- **AC8 — Additive, lean repo, garust untouched.** No **npm dependency** added; the ~10 MB+ runtime
  is **not committed to the repo** — the deploy workflow places it into the Pages artifact. The
  feature is overwhelmingly `apps/web`; the **only** permitted core change is the minimal, additive
  storage needed for AC5's CRDT-synced code — a small optional **`Resource.content`** string
  (mirroring the plateau body of R-0020) plus a **`ResourceKind::Notebook`** variant — backward
  compatible, defaulting empty, encoded in the existing CRDT map. **garust is untouched** (no graph
  geometry, no rotors, no reputation). Pure decision logic (runtime state machine, import detection,
  save/load mapping) is a **unit-tested** module; the impure edges (loading Pyodide, running code)
  are thin and isolated. Existing suites stay green.

## 4. Constraints & non-goals

- **Compute cell, not a full notebook.** Scope is **one runnable cell per plateau** in the app's own
  UI — not an embedded JupyterLite multi-cell notebook IDE in an iframe. (Decision log; the full
  notebook is a possible later track, out of scope here.)
- **Self-hosted, lazy, uncommitted runtime.** The runtime is fetched into the **deployed artifact**
  at build time and loaded **lazily at runtime** from the app origin. It is **never committed to
  git** (keeps the ~2 MiB repo lean) and **never first-painted** (keeps the map fast).
- **Reuses the resource path.** A saved Notebook is an **ordinary resource** — sync, durability, the
  Study drawer, and the map marker all apply for free. The only additions are a **`Notebook` kind**
  and a **small optional `Resource.content`** string to carry the (small, text) code inside the
  existing CRDT resource map; no new persistence primitive, no store, no channel.
- **Non-goals (follow-ups):** multi-cell notebooks; a package manager UI; GPU/threads; persisting a
  cell's *outputs* (only code is saved — outputs are recomputed on Run); sharing/publishing a
  Notebook to peers beyond the existing CRDT/R-0036 mechanics; the companion authoring or fixing
  cell code (a natural later tie-in, not required here).

## 5. Open questions

- **Isolation mechanism (AC3).** Web Worker (clean cancel/timeout, keeps the UI thread free) vs.
  main-thread Pyodide with a bounded interrupt. SPEC-0046 decides; a worker is the leaning.
- **Package set + size budget (AC4).** `numpy` + `sympy` are in; `matplotlib` (plots) is heavier —
  in v1 or a follow-up? What total artifact-size budget is acceptable for the Pages deploy?
- **Where "Compute" sits (AC1).** A third mastery-adjacent action next to "Solve it"/"Prove it",
  or a distinct study affordance? Should a correct **computation** ever feed mastery, or stay purely
  exploratory (leaning: exploratory — mastery stays with R-0030/R-0032/R-0034)?
- **Runtime provenance (AC6).** Pin an exact Pyodide version + verify its integrity when the deploy
  workflow fetches it (checksum), so a self-hosted runtime can't be silently swapped.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-04 | A **compute cell** in our own UI, not an embedded JupyterLite notebook | Matches the app's build-your-own-UI idiom; integrates with the plateau/companion/CAS/graph; far lighter than the full notebook IDE (owner choice) |
| 2026-07-04 | **Self-host** the runtime via the deploy workflow; never commit it | Keeps the ~2 MiB repo lean **and** keeps the runtime same-origin + offline-capable — no third-party origin (owner choice) |
| 2026-07-04 | Load Pyodide **lazily** (first cell open/Run), never at first paint | The map must stay instant; the ~10 MB runtime is only paid for by learners who actually compute |
| 2026-07-04 | Save a cell as a **"Notebook" resource** (new resource kind, CRDT) | A plateau can ship runnable worked examples; reuses the resource/marker/sync path; shareable like a proof (R-0036) — owner choice |
| 2026-07-04 | Save **code only**, recompute outputs on Run; code is never auto-run | Trust + determinism: saved code is data, the learner presses Run; keeps the CRDT small and outputs honest |
| 2026-07-04 | Carry the code in a small optional **`Resource.content`** CRDT field (not IndexedDB-local) | The owner chose "travels with the graph"; code is small text, so it belongs in the CRDT (unlike R-0045 media). Mirrors R-0020's plateau body; one minimal, additive, backward-compatible core change |

## Changelog

- 2026-07-04 created (Draft) — in-browser Pyodide compute cell on a plateau: lazy, self-hosted,
  offline-capable Python (numpy/sympy) with inline output; the open-ended complement to the R-0034
  CAS *checker*; a cell saves to the plateau as a shareable "Notebook" resource. Three shaping
  decisions taken with the owner (compute-cell / self-host / Notebook-resource). Pending SPEC-0046
  + architect review to settle isolation, package/size budget, the "Compute" placement, and runtime
  provenance.
