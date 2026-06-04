# SPEC-0013 — Bridge Authoring: connect two plateaus with a named concept

- **Status:** Accepted
- **Realizes:** R-0013
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** SPEC-0011 (plateau authoring pattern), SPEC-0012 (durability), SPEC-0005 (sync + render)
- **Module(s):** `apps/web/src/bridge.js` + `bridge.test.mjs` (new), `apps/web/index.html`, `apps/web/src/main.js`

## 1. Motivation

R-0013: let a wizard connect two existing plateaus with a concept label. The
`WasmCrdtDoc::add_bridge(from, to, concept)` binding already computes the rotor
in Rust (garust `Bridge::between`) and `render.js` already draws bridges with
their concept labels, so this is a thin JS layer — a pure validation factory plus
a form — mirroring SPEC-0011's plateau authoring. No Rust change.

## 2. Design

### 2.1 Module layout

```
apps/web/src/
  bridge.js          ← NEW  pure factory: buildBridge({ from, to, concept })
  bridge.test.mjs    ← NEW  node --test; no WASM
  main.js            ← EDIT  Draft Bridge form: populate selects, submit handler
  index.html         ← EDIT  the Draft Bridge form markup
```

No Rust changes. `add_bridge` and bridge rendering already exist.

### 2.2 `bridge.js` — pure factory

Mirrors `plateau.js`. Pure, no WASM, no GA. Returns a tagged result.

```js
// bridge.js — pure. Validates and normalises bridge authoring inputs.
// Returns { from, to, concept, error: null } or { error }. No GA: the rotor is
// computed in Rust by Bridge::between (CLAUDE.md §1).

export const CONCEPT_FALLBACK = "relates to";

export function buildBridge({ from, to, concept } = {}) {
  if (!from || !to) return { error: "Pick both plateaus to connect." };
  if (from === to) return { error: "A bridge needs two different plateaus." };
  return {
    from,
    to,
    concept: (typeof concept === "string" ? concept.trim() : "") || CONCEPT_FALLBACK,
    error: null,
  };
}
```

Decisions (R-0013 open questions resolved):
- **Blank concept → fallback** `"relates to"` (low friction, mirrors R-0011's
  name fallback). The factory never errors on a blank concept.
- **Endpoints:** the UI lists **all** plateaus (lit + fogged) — you may bridge
  toward the fog. The factory only checks non-empty + distinct; it does not know
  the plateau set (the selects guarantee valid ids; an unknown id still surfaces
  as a handled `add_bridge` error in the submit handler).
- **Duplicates allowed:** `add_bridge` mints a fresh bridge id each call, so two
  bridges between the same pair with different concepts are distinct edges.

### 2.3 `index.html` — Draft Bridge form

A second collapsible form beside Draft Plateau, same styling:

```html
<details id="draft-bridge" class="draft-plateau" hidden>
  <summary>Draft a bridge</summary>
  <form id="draft-bridge-form" class="draft-plateau-body">
    <div class="dp-row"><label for="db-from">From</label>
      <select id="db-from"></select></div>
    <div class="dp-row"><label for="db-to">To</label>
      <select id="db-to"></select></div>
    <div class="dp-row"><label for="db-concept">Concept</label>
      <input id="db-concept" type="text" placeholder="e.g. frequency ratios" /></div>
    <p id="db-error" class="dp-error" hidden></p>
    <div class="dp-actions"><button type="submit">Draft bridge</button></div>
  </form>
</details>
```

A toolbar button `#draft-bridge-toggle` ("Draft a bridge") shows/hides it. It is
added to the existing `.bar` div, immediately after `#draft-plateau-toggle`, so
the two authoring entry points sit together.

### 2.4 `main.js` — wire form

```js
import { buildBridge } from "./bridge.js";

// Rebuild both endpoint selects from the CURRENT graph each time the form opens,
// so plateaus authored this session are selectable (AC1).
function refreshBridgeOptions() {
  const ps = doc.to_graph().plateaus(); // [{ id, name, domain_id, position }]
  for (const sel of [document.getElementById("db-from"), document.getElementById("db-to")]) {
    sel.replaceChildren(...ps.map((p) => {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = p.name;
      return o;
    }));
  }
}
document.getElementById("draft-bridge-toggle").addEventListener("click", () => {
  const panel = document.getElementById("draft-bridge");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) { panel.open = true; refreshBridgeOptions(); }
});

document.getElementById("draft-bridge-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const spec = buildBridge({
    from: document.getElementById("db-from").value,
    to: document.getElementById("db-to").value,
    concept: document.getElementById("db-concept").value,
  });
  const errEl = document.getElementById("db-error");
  if (spec.error) { errEl.textContent = spec.error; errEl.hidden = false; return; }
  try {
    doc.add_bridge(spec.from, spec.to, spec.concept); // rotor computed in Rust (AC5)
  } catch (err) {
    errEl.textContent = "Could not add bridge."; errEl.hidden = false; return; // AC3
  }
  errEl.hidden = true;
  sync.pump();   // broadcast (AC4)
  persist();     // durable snapshot (AC4, R-0012)
  draw();        // labelled line appears same frame (AC2)
  document.getElementById("db-concept").value = "";
});
```

`add_bridge` is wrapped in try/catch because it throws a `JsError` on an unknown
endpoint or bad UUID; the selects make that unreachable in practice, but the
handler stays console-clean either way (AC3/AC8).

**Default-submit is a safe self-loop.** Both selects default to the same first
option, so submitting without changing them yields `from === to`, which
`buildBridge` rejects with "A bridge needs two different plateaus" — no CRDT
write, no throw. This (not an empty-select case) is the most likely first user
action; AC3 validation covers it. The selects are never truly empty because the
deterministic seed runs before the first render.

## 3. Code outline

See §2: one ~15-line pure `bridge.js`, its test, ~10 lines of form markup, and
~30 lines of `main.js` wiring. No Rust.

## 4. Non-goals

- No Rust changes; `add_bridge` and the rotor math already exist.
- No signed `BridgeProposal` events; bridges are CRDT state this phase.
- No wizard attribution (created_by stays nil — R-0013 AC7).
- No bridge edit/delete, no click-two-plateaus canvas UX, no bidirectional-rotor UI.

## 5. Open questions (resolved here)

- Blank concept → fallback `"relates to"` (§2.2).
- Endpoint list → all plateaus (§2.2).
- Duplicates → allowed (§2.2).

## 6. Acceptance criteria

Maps 1-to-1 to R-0013 AC:

- [ ] AC1 — Draft Bridge form: from/to selects (rebuilt on open from the current
      graph), concept input, submit.
- [ ] AC2 — On submit the bridge draws as a labelled line same-frame.
- [ ] AC3 — Self-loop / missing endpoint rejected with inline error, no CRDT
      write; unknown-endpoint throw is caught, never uncaught.
- [ ] AC4 — Syncs to another tab (BroadcastChannel) and survives reload (IndexedDB
      snapshot).
- [ ] AC5 — Rotor/grade computed by `Bridge::between` in Rust; JS passes only
      `(from, to, concept)`.
- [ ] AC6 — Pure `buildBridge` unit-tested: distinct→ok, from===to→error, missing
      endpoint→error, blank concept→fallback, **whitespace-only concept→fallback**
      (exercises `.trim()`), **non-string concept→fallback** (exercises the
      `typeof` guard), deterministic.
- [ ] AC7 — Attribution deferred (created_by nil), documented.
- [ ] AC8 — All suites green; author a bridge + reload, no uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Pure `bridge.js` factory + form, mirroring `plateau.js` | Consistency; keeps GA in Rust, JS only validates/normalises |
| 2026-06-02 | Two `<select>` endpoints rebuilt on form-open, not click-on-canvas | Avoids conflict with click-to-traverse; session-authored plateaus stay selectable |
| 2026-06-02 | Blank concept → `"relates to"` fallback; duplicates allowed | Low-friction authoring; distinct concepts are legitimately distinct edges |
| 2026-06-02 | `add_bridge` wrapped in try/catch | It throws JsError on unknown endpoint/bad UUID; keep the page console-clean (AC3/AC8) |
| 2026-06-02 | When `BridgeProposal` (Kind 30002) lands, the CRDT `bridges` map becomes a **projection of verified bridge events**, not a parallel write | Forward seam (architect finding 7): bridges must converge on the event-sourced model (like reputation from traversals, CLAUDE.md §7), not ossify as CRDT-authoritative. Do NOT wire a future signed bridge event AND an independent CRDT write — the event is the source, the map its projection. Plateaus (R-0011 AC7) face the same fork. |

## Changelog

- 2026-06-02 created (Draft) — pending architect review, then Accepted.
- 2026-06-02 architect design review: **APPROVE-WITH-NITS** (all claims verified
  against real code). Folded in: explicit toggle-button placement in `.bar`;
  default-equal-selects → safe self-loop note; two extra factory tests
  (whitespace-only + non-string concept → fallback); the forward seam that a
  future `BridgeProposal` (30002) makes the CRDT bridges map a projection of
  verified events, not a parallel write. **Status → Accepted**; ready to implement.
