# SPEC-0046 — In-browser compute cell (Pyodide), self-hosted & lazy

- **Status:** Accepted (architect: APPROVE-WITH-NITS, 2026-07-04 — findings folded below)
- **Realizes:** R-0046
- **Author:** Claude (Opus 4.8)
- **Created:** 2026-07-04
- **Depends on:** SPEC-0020 (plateau read/Study view + the vendored-asset pattern), SPEC-0023
  (Study drawer + inline `add_resource`), SPEC-0034 (`cas.js` — the deterministic checker this
  complements), SPEC-0014 (resource/marker path + `MARKER_KIND`), SPEC-0004/0012 (CRDT + IndexedDB
  durability), the deploy-pages workflow (self-hosting).
- **Module(s):** `apps/web/src/{compute.js,pyodide-runner.js,main.js,study.js,renderers/canvas.js}`,
  `.github/workflows/deploy-pages.yml`, `apps/web/.gitignore`, `scripts/fetch-pyodide.sh`; and the
  minimal core touch: `crates/mp-domain` (`Resource.content` + `ResourceKind::Notebook`),
  `crates/mp-wasm` (`add_resource`/`seed_resource` + convert/DTO). mp-crdt needs no change.

## 1. Motivation

R-0046: a learner should be able to **run real Python on a plateau** — the open-ended complement to
`cas.js` (R-0034), which only *checks* answers over a closed grammar. Pyodide (CPython → WASM) gives
`numpy`/`sympy` in the browser with no server and no model; three owner decisions shape the build:
a **compute cell** in our own UI (not an embedded notebook), the runtime **self-hosted** from the
app origin (placed by the deploy workflow, never committed), loaded **lazily** (never at first
paint), and a cell **saved as a "Notebook" resource** whose small code payload **travels with the
graph (CRDT)**. This spec makes those mechanical.

## 2. Design

### 2.1 Two edges: a pure core + a thin impure runner

- **`compute.js` — pure, unit-tested.** Owns every decision with no `window`/`fetch`/`importScripts`:
  the runtime **state machine** (`idle → loading → ready → running → {ready|error}`), **import
  detection** (scan a cell's source for `import numpy` / `import sympy` → the package set to preload,
  bounded to the vendored allow-list), **output shaping** (normalise stdout / last-value / traceback
  / an inline image into a `{ streams, value, error, imagePng }` view model), and the **save/load
  mapping** between a cell and a `Notebook` resource (`cellToResource(code,title)` /
  `resourceToCell(resource)`). No Pyodide reference lives here — it is testable exactly like
  `cas.js`/`viewpipeline.js`.
- **`pyodide-runner.js` — the ONLY impure edge.** Loads Pyodide from the app origin and executes a
  cell **in a Web Worker** (clean cancel + timeout, keeps the UI thread free). Public surface:
  `createRunner()` → `{ ensureReady(onState), run(code, {packages, timeoutMs}) → Promise<RunResult>,
  cancel() }`. It imports `compute.js` for its state/shape helpers; `main.js` never talks to the
  worker directly.

### 2.2 Self-hosting the runtime (no repo bloat, same-origin, offline)

- Pyodide lives at `apps/web/vendor/pyodide/` — **gitignored** (mirrors `pkg/`), fetched by
  `scripts/fetch-pyodide.sh` from a **pinned** Pyodide release (`PYODIDE_VERSION`), keeping only the
  core (`pyodide.js`, `pyodide.asm.{js,wasm}`, `python_stdlib.zip`, `pyodide-lock.json`) plus the
  `numpy` and `sympy` wheels — a few MB, not the full ~200 MB distribution. The script **verifies a
  SHA-256** of the downloaded archive against a checked-in `pyodide.sha256` (AC "runtime provenance").
- The **deploy workflow** runs `scripts/fetch-pyodide.sh` before `upload-pages-artifact`, so the
  published site serves Pyodide from **its own origin** (`./vendor/pyodide/…`, resolved via
  `import.meta.url` — subpath-safe under `/AMillionPlateaus/`). The runner passes
  `indexURL: <vendor>/pyodide/` so Pyodide never reaches for a CDN. Dev parity: `scripts/serve.py`
  users run `fetch-pyodide.sh` once; if the dir is absent the cell shows AC2's "runtime unavailable"
  state (never a silent hang, never a third-party fallback).

### 2.3 The cell UI (Study view)

- A **"Compute"** affordance in the plateau Study view (sibling of "Prove it"/"Solve it" at
  `main.js:1489+`), available with **no model connected**. It reveals a code `<textarea>` + **Run** +
  an output pane. Opening the Study view does **not** touch the runtime; the **first Run** (or first
  cell open) calls `runner.ensureReady`, which flips the cell to a **loading** state, then runs.
- **Run** → `compute.detectPackages(code)` → `runner.run(code,{packages,timeoutMs})` → render the
  shaped `{streams,value,error,imagePng}` (traceback shown as text; a `matplotlib`/PNG value shown as
  an `<img>` from a blob URL). A **Stop** cancels the worker (AC3 runaway bound).
- **Save** → `compute.cellToResource(code, title)` → `doc.add_resource(plateau, title, "Notebook",
  "")` with the code placed in the new `content` field (see §2.4), then the same **pump → peer →
  persist** broadcast as the authoring forms (`main.js:2342` path). The Study drawer lists it; the
  map shows a **Notebook** dot (§2.5). **Opening** a Notebook resource → `resourceToCell` → its code
  loads into a fresh cell (never auto-run — AC7).

### 2.4 The minimal core change (carry the code in the CRDT)

The resource today is `(plateau, title, kind, uri, contributor)` with a fixed `ResourceKind`; it has
nowhere to hold code. The owner chose "code travels with the graph", and code is **small text**, so
it belongs in the CRDT (contrast R-0045 media → IndexedDB). Additive, backward-compatible:

- `crates/mp-domain` (architect: the types live here, **not** mp-graph): `Resource { …,
  #[serde(default)] content: String }` and `enum ResourceKind { …, Notebook }`. The
  **`#[serde(default)]` is load-bearing** (architect BLOCKING-1): a pre-`content` blob omits the
  key, and without the default `serde_json::from_str::<Resource>` errors → `to_graph()` fails →
  R-0012 discards-and-reseeds an existing world. With it, old docs decode to `content == ""` — the
  Rust test suite gains a legacy-blob round-trip (a `Resource` JSON with `content` stripped decodes
  to `""`). Keep `Resource::new`'s signature unchanged; set content via a `with_content` builder
  (mirroring `with_description`), so the 5 existing `Resource::new` call sites are untouched.
- `crates/mp-crdt`: no change needed — the blob rides the existing `to_string`/`from_str` path once
  the serde default exists.
- `crates/mp-wasm`: `add_resource`/`seed_resource` gain a trailing `content: &str`; `convert.rs`
  maps `"Notebook" ⇆ ResourceKind::Notebook` (unknown still falls to `Note`); `ResourceDto` +
  `resource_dto` gain `content` so `resourceToCell` can read it back. **All FOUR existing JS call
  sites must pass an explicit `""`** (architect BLOCKING-2): `main.js:260` (`seed_resource` loop),
  `main.js:1740`, `main.js:1745`, `main.js:2342` — a missing trailing arg marshals as the string
  `"undefined"` through wasm-bindgen, silently corrupting the CRDT. **garust untouched** — no
  position/rotor/reputation; the GA invariant re-validation in `to_graph` is unchanged.

*(Fallback if the owner/architect prefers zero core change for v1: reuse `kind:"Interactive"` and
store code in IndexedDB via the R-0045 `resource://local/<id>` scheme — but then code is device-local
and does not sync, contradicting AC5. §5 Q1.)*

### 2.5 Map marker

`MARKER_KIND` (renderers/canvas.js) gains `Notebook: "#e6c34a"` (a distinct dot); the viewpipeline
already carries `kind` through unchanged. The legend (index.html) gains the matching swatch row —
added in lockstep per the canvas.js sync comment. (Architect note: the table already drifts from the
Rust enum — a `Book` key that isn't a `ResourceKind`, missing `Paper`/`Tool`; don't widen the drift,
and optionally true it up in this PR.)

### 2.6 Safety (AC7)

Execution is confined to the Pyodide WASM sandbox in a Worker. The isolation is **structural**
(architect NIT-5): the model key lives in the main thread's `localStorage`, which a Worker cannot
reach — the worker is never handed the key, holds no `WasmGraph`/`WasmCrdtDoc` handle, and only
`{ code, packages, timeoutMs }` ever cross the `postMessage` boundary. The worker has no app-origin
network beyond loading its own vendored packages. The worker script itself is loaded via a
subpath-relative `new URL("./…", import.meta.url)` (never an absolute `/…` path) so it resolves
under `/AMillionPlateaus/` (architect NIT-6); single-thread Pyodide needs no COOP/COEP, which GitHub
Pages couldn't set anyway. Saved code is **data**, rendered as text and only executed when the
learner presses Run; the rendered `value`/`streams` are size-capped (PROOF_BODY_CAP discipline) so a
runaway `print` loop can't wedge the DOM even after the timeout fires.

## 3. Code outline

```
// compute.js — PURE (no window/fetch/worker). Unit-tested in compute.test.mjs.
export const RUNTIME = { IDLE:"idle", LOADING:"loading", READY:"ready", RUNNING:"running", ERROR:"error" };
export const PACKAGES = new Set(["numpy", "sympy"]);        // the vendored allow-list

export function detectPackages(code) { /* /^\s*(?:import|from)\s+(\w+)/gm ∩ PACKAGES */ }
export function shapeResult({ stdout, value, error, imagePng }) { /* → {streams,value,error,imagePng} */ }
export function nextState(cur, event) { /* the state-machine transition table */ }
export function cellToResource(code, title) { return { title: title || "Notebook", kind: "Notebook", uri: "", content: code }; }
export function resourceToCell(r) { return { title: r.title, code: r.content ?? "" }; }

// pyodide-runner.js — the ONLY impure edge (loads Pyodide, owns the Worker).
export function createRunner(indexURL) {
  // ensureReady(onState): lazy new Worker(...) → loadPyodide({indexURL}) → READY, streaming state.
  // run(code,{packages,timeoutMs}): loadPackagesFromImports/loadPackage → runPythonAsync,
  //   capture stdout + repr(last) + traceback + a base64 PNG if matplotlib drew; race a timeout → cancel().
}

// deploy-pages.yml — one step before upload-pages-artifact:
//   - name: Fetch the self-hosted Pyodide runtime (numpy, sympy)
//     working-directory: app
//     run: scripts/fetch-pyodide.sh apps/web/vendor/pyodide
```

## 4. Non-goals

- Multi-cell notebooks, a JupyterLite iframe, a package-manager UI, GPU/threads (R-0046 §4).
- Persisting cell **outputs** (only code is saved; outputs recompute on Run).
- The companion **authoring/fixing** cell code (natural follow-up; not here).
- A correct computation feeding **mastery** — mastery stays with R-0030/0032/0034 (leaning:
  compute is exploratory).

## 5. Open questions

- **Q1 — RESOLVED (architect, 2026-07-04).** The `Resource.content` + `ResourceKind::Notebook` core
  change is confirmed legitimate: authored text riding the resources map exactly as the R-0020
  plateau body rides the plateaus map — not reputation, not geometry, no CLAUDE.md conflict. The
  IndexedDB fallback is rejected (would not sync, contradicting AC5).
- **Q2 — Package/size budget.** `numpy` + `sympy` are in. `matplotlib` (inline plots, AC4) is heavier
  — v1 or fast-follow? What total artifact-size budget is acceptable for the Pages deploy?
- **Q3 — Worker vs main thread.** Worker (chosen: clean cancel/timeout) needs the runtime served with
  the right headers; confirm GitHub Pages serves the `.wasm`/worker acceptably (no COOP/COEP needed
  for single-thread Pyodide).
- **Q4 — Runtime provenance.** Pin `PYODIDE_VERSION` + checked-in `pyodide.sha256`; the fetch script
  fails closed on mismatch.

## 6. Test strategy

- **`compute.test.mjs` (node --test, pure):** `detectPackages` (finds numpy/sympy, ignores others +
  stdlib, bounded to the allow-list); `nextState` transition table (idle→loading→ready→running→ready,
  and →error); `shapeResult` (stdout/value/traceback/image shapes); `cellToResource`/`resourceToCell`
  round-trip incl. empty content.
- **Rust:** `Resource.content` defaults empty + survives a CRDT encode/decode round-trip; an old doc
  without the field decodes to `""`; `"Notebook"` parses to `ResourceKind::Notebook` and unknown
  still falls back to `Note`.
- **Manual/preview:** first Run loads the runtime (loading state) then computes `sympy` output;
  offline-after-cache run; Save → Notebook dot on the map + reopen loads code.
