# SPEC-0011 — Plateau Authoring: Draft DB POC

- **Status:** Draft
- **Realizes:** R-0011
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** SPEC-0005 (fog-world), SPEC-0009 (authored personas pattern), SPEC-0010 (wizard identity)
- **Module(s):** `apps/web/src/plateau.js`, `apps/web/src/plateau.test.mjs`, `apps/web/index.html`, `apps/web/src/main.js`

## 1. Motivation

R-0011: let a wizard author a new plateau node through the web UI. The WASM
`WasmCrdtDoc::add_plateau(name, domain_id, e1, e2, e3)` binding and the
BroadcastChannel CRDT sync path already work (proven by the existing stub). This
spec adds the thin pure-JS authoring layer (factory + tests) and replaces the
crude stub with a proper form, following the pattern established by `persona.js` /
`authorPersona` (SPEC-0009).

## 2. Design

### 2.1 Module layout

```
apps/web/src/
  plateau.js          ← NEW  pure factory: buildPlateau({ name, domain, e1, e2, e3 })
  plateau.test.mjs    ← NEW  node --test; no WASM
  main.js             ← EDIT replace "add" stub; wire form submit → buildPlateau → wasm
  index.html          ← EDIT replace crude "Add" button with a Draft Plateau form
```

No Rust changes. No new crate surface.

### 2.2 `plateau.js` — pure factory

Mirrors the shape of `persona.js`.

```js
// plateau.js — pure. Validates and normalises plateau authoring inputs.
// Returns the arg shape wasm.add_plateau() accepts, or null on invalid input.
// No GA math here; that lives in Rust.

import { DOMAINS, AXES } from "./persona.js";

export const PLATEAU_NAME_FALLBACK = "Untitled Plateau";

// Returns { name, domain, e1, e2, e3 } or null.
// Null cases: unknown domain id, all-zero direction.
// Returns { name, domain, e1, e2, e3, error: null } or { error: string }.
// Null/NaN coordinates, unknown domain, or all-zero direction → error.
export function buildPlateau({ name, domain, e1 = 0, e2 = 0, e3 = 0 } = {}) {
  const knownDomain = DOMAINS.find((d) => d.id === domain);
  if (!knownDomain) return { error: "Unknown domain." };
  const fE1 = Number(e1), fE2 = Number(e2), fE3 = Number(e3);
  if (!Number.isFinite(fE1) || !Number.isFinite(fE2) || !Number.isFinite(fE3))
    return { error: "Position contains non-finite value." };
  if (Math.hypot(fE1, fE2, fE3) === 0) return { error: "Position must be non-zero." };
  return {
    name: (typeof name === "string" ? name.trim() : "") || PLATEAU_NAME_FALLBACK,
    domain,
    e1: fE1, e2: fE2, e3: fE3,
    error: null,
  };
}
```

### 2.3 `index.html` — Draft Plateau form

Replaces:
```html
<button id="add">Add a plateau (syncs)</button>
```

With a small collapsible form:
```html
<details id="draft-plateau">
  <summary>Draft a plateau</summary>
  <form id="draft-plateau-form">
    <input id="dp-name" type="text" placeholder="Plateau name" />
    <select id="dp-domain">
      <!-- populated by main.js from DOMAINS -->
    </select>
    <label>Formal (e1) <input id="dp-e1" type="range" min="-1" max="1" step="0.05" value="0.8" /></label>
    <label>Empirical (e2) <input id="dp-e2" type="range" min="-1" max="1" step="0.05" value="0" /></label>
    <label>Creative (e3) <input id="dp-e3" type="range" min="-1" max="1" step="0.05" value="0" /></label>
    <button type="submit">Draft plateau</button>
    <p id="dp-error" hidden></p>
  </form>
</details>
```

Sliders default to `(0.8, 0, 0)` — a non-zero Formal axis, satisfying AC5
without forcing the wizard to move any slider.

### 2.4 `main.js` — wire form

```js
// Populate domain select from DOMAINS (persona.js)
const dpDomain = document.getElementById("dp-domain");
for (const d of DOMAINS) {
  const opt = document.createElement("option");
  opt.value = d.id;
  opt.textContent = d.label;
  dpDomain.appendChild(opt);
}

document.getElementById("draft-plateau-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const spec = buildPlateau({
    name:   document.getElementById("dp-name").value,
    domain: dpDomain.value,
    e1: parseFloat(document.getElementById("dp-e1").value),
    e2: parseFloat(document.getElementById("dp-e2").value),
    e3: parseFloat(document.getElementById("dp-e3").value),
  });
  const errEl = document.getElementById("dp-error");
  if (spec.error) {
    errEl.textContent = spec.error;
    errEl.hidden = false;
    return;
  }
  errEl.hidden = true;
  const id = doc.add_plateau(spec.name, spec.domain, spec.e1, spec.e2, spec.e3);
  DOMAIN_OF.set(id, spec.domain);
  sync.pump();
  draw();
});
```

The old `document.getElementById("add")` listener is removed.

### 2.5 Reachability of isolated nodes (AC2)

`KnowledgeGraph::is_reachable` and `reachable_plateaus` are **purely geometric**:
they compute the GA projection of the plateau's position against the wizard's
reputation direction and compare it to `REACHABILITY_THRESHOLD`. Graph edges
(bridges) play no part in the fog query. An isolated plateau (no bridges) is
therefore fully reachable if its domain + position produce a projection above the
threshold — confirmed in `mp-domain/src/graph.rs`. No auto-bridge is required for
AC2. (A bridge from the new plateau to an existing seed would be authored via
R-0012, not this spec.)

### 2.6 Attribution (AC7 — deferred to R-0012)

`WasmCrdtDoc::add_plateau` does not accept a `created_by` argument; the Rust
`PlateauNode::new` signature is `(name, domain_id, e1, e2, e3)`. Threading the
pubkey requires a Rust change scoped to R-0012. R-0011 AC7 has been amended
accordingly — this POC records the plateau without attribution in the CRDT field.
The wizard's pubkey is available from `identity.js` and will be used in R-0012.

## 3. Code outline

See §2. The implementation is fully described: one new `plateau.js` module, one
test file, and surgical edits to `index.html` + `main.js`.

## 4. Non-goals

- No Rust changes. No `created_by` threading through `WasmCrdtDoc::add_plateau`
  (AC7 is achieved by noting the pubkey is available; attribution in the CRDT
  field is R-0012 work).
- No domain creation — `DOMAINS` is read-only.
- No plateau deletion or editing.
- No bridge authoring (R-0012).
- No Nostr event signed for the create-plateau action.
- No visual distinction between seeded and authored plateaus (open question left
  to implementation; a `data-authored` attribute is fine if trivial).

## 5. Open questions

- **Visual distinction**: should authored plateaus render with a dashed ring or
  different colour? Implementation choice; does not affect AC.
- **Slider defaults**: spec says `(0.8, 0, 0)` — Formal axis, Math-leaning.
  Fine as a default since it satisfies AC5 and makes the first authored plateau
  immediately reachable by a Geometer.

## 6. Acceptance criteria

Maps 1-to-1 to R-0011 AC:

- [ ] AC1 — Draft Plateau form: name input, domain select (Math/Music), three
      human-labeled sliders (Formal/Empirical/Creative), submit button.
- [ ] AC2 — On submit the plateau appears in the fog-world same-frame; fog/lit
      state matches the wizard's orientation.
- [ ] AC3 — Drafted plateau lives for the session and converges across open
      tabs. NOT durable across a full close/reload (redb is compiled out of the
      wasm build); durable IndexedDB persistence is R-0012.
- [ ] AC4 — Syncs to a second open tab via BroadcastChannel.
- [ ] AC5 — All-zero slider position is blocked (error message or snap).
- [ ] AC6 — `buildPlateau` is pure and unit-tested: deterministic, name trim,
      blank-name fallback, all-zero → `{ error }`, NaN coordinate → `{ error }`,
      unknown domain → `{ error }`, valid input → `{ ..., error: null }`.
- [ ] AC7 — Attribution deferred to R-0012 (no CRDT `created_by` field this POC;
      R-0011 AC7 amended).
- [ ] AC8 — All test suites green; no uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Pure `plateau.js` factory mirroring `persona.js` | Keeps GA math in Rust; JS is only input validation + normalisation |
| 2026-06-02 | `<details>` collapsible form, not a modal | Low-friction; consistent with existing persona creator pattern |
| 2026-06-02 | Slider defaults `(0.8, 0, 0)` | Non-zero on submission without any wizard action; Formal axis is the most "neutral" starting orientation |
| 2026-06-02 | `buildPlateau` returns `{ error }` tagged result, not bare `null` | Makes error display precise; NaN guard folded in (architect nit 1 + 4) |
| 2026-06-02 | No auto-bridge for authored plateau | `reachable_plateaus` is purely geometric — no edge traversal — so isolated nodes are reachable; confirmed in `mp-domain/src/graph.rs` (architect nit 2) |
| 2026-06-02 | Skip `created_by` threading for this POC; R-0011 AC7 amended | Requires Rust signature change; scoped to R-0012 (architect nit 3) |

## Changelog

- 2026-06-02 created (Draft) — pending architect review, then Accepted.
- 2026-06-02 AC3 corrected — drafted plateaus are session + cross-tab only, not
  durable across a full reload (redb is compiled out of the wasm build). Durable
  IndexedDB persistence carved out to SPEC-0012 / R-0012.
