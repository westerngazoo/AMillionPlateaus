# SPEC-0044 — Rhizome drill-down: grow a nested, bridged plateau from a selected term

- **Status:** Accepted
- **Realizes:** R-0044
- **Author:** Claude (Opus 4.8)
- **Created:** 2026-07-04
- **Depends on:** R-0011/SPEC-0011 (`add_plateau`), R-0013/SPEC-0013 (`add_bridge`), R-0020 (read
  view), R-0023 (plateau-scoped companion), R-0007 (model client). Composes existing primitives —
  **no core/Rust/wasm/DTO change**.
- **Module(s):** `apps/web/src/rhizome.js` (pure, shipped), `apps/web/src/main.js` (DOM seam),
  `apps/web/index.html` (menu CSS). `apps/web/src/rhizome.test.mjs` (pure tests).

## 1. Approach

Reading a plateau, you select an unfamiliar term and **grow** it into a new plateau — a durable,
bridged, further-drillable node, not a throwaway gloss. The pure logic (where a child sits, its
starter body, the prompts) is a dependency-free module; the impure edges (`add_plateau` /
`add_bridge` / `sendTurn` / the selection UI) live in `main.js`. **Slice 1 (the desktop pointer
path) is implemented and on `main`;** this spec documents it and specifies the three follow-up
slices so a dev can implement them mechanically (issues #57 / #58 / #59).

## 2. Design

### 2.1 `rhizome.js` — the pure core (SHIPPED)

Dependency-free, unit-tested. Exact exported contracts (do not change signatures):

| Export | Contract |
|--------|----------|
| `isGrowable(term) → bool` | trims; false if < 2 or > 80 chars, spans a sentence break (`/[.!?]\s/`), or has no `\w`. Gates the menu. |
| `hashTerm(term) → u32` | FNV-1a, deterministic (no `Math.random` — placement must be reproducible). |
| `childPosition(parent, term) → {e1,e2,e3}` | parent position nudged by a term-derived angle at `CHILD_RADIUS = 0.09` on the e1–e2 plane + a tiny e3 wobble. Deterministic; **stays Grade-1**. |
| `starterBody(term, parentName) → md` | offline stub: names the lineage, an **honest** "no definition yet" — never a fabricated gloss. |
| `draftPlateauPrompt(term, parentName) → str` | model prompt for a ≤150-word Markdown explainer, **no title heading** (the child body gets its own `# term`). |
| `inlinePrompt(term, parentName, mode) → str` | `mode ∈ {define, example}` — the quick gloss prompt (no plateau created). |

### 2.2 The selection seam in `main.js` (SHIPPED — desktop)

A single floating `#rhizome-menu` (built once, appended to `body`). On `mouseup` inside
`#detail-body`: read `window.getSelection()`; if `isGrowable(term)`, position the menu at the
selection rect and show **Define · Example · 🌱 Grow a plateau**. Hidden on outside `mousedown` and
on panel `scroll`. Buttons `mousedown`-preventDefault to keep the selection alive through the click.

- **Define / Example** → `askInline(term, mode)`: routes `inlinePrompt` through the **same
  plateau-scoped companion turn** as the study actions (`buildPlateauStudyContext` + `assembleMessages`
  + `sendTurn`). Offline ⇒ an honest "connect a model or grow it" message. No graph change.

### 2.3 `growPlateau(term)` — the rhizome move (SHIPPED)

```
domain   = DOMAIN_OF.get(parent.id) ?? parent.domain_id ?? activePersona.orient[0]?.domain
pos      = childPosition(parent.position, term)          // rhizome.js
body     = model connected ? `# ${term}\n\n${await sendTurn(draftPlateauPrompt(...))}`
                           : starterBody(term, parent.name)
childId  = doc.add_plateau(term, domain, pos.e1, pos.e2, pos.e3, body)   // existing R-0011 path
           DOMAIN_OF.set(childId, domain)
           doc.add_bridge(parent.id, childId, term)       // the TERM is the bridge concept (R-0013)
           sync.pump(); pumpPeer(); persist(); draw()     // identical to the authoring forms
openPlateau(child)                                        // drill straight in
```

> **Reuses the wasm CRDT methods directly, on purpose.** Grow calls `doc.add_plateau` /
> `doc.add_bridge` (which return the new UUID) — **not** the JS `buildPlateau`/`buildBridge`
> factories the authoring *forms* use. `buildPlateau`'s domain guard is `DOMAINS.find(...)` (the
> built-in three only), which would **reject** a child grown into an authored/custom domain — the
> exact fallback grow relies on. Slice 3's "Create" (§2.5) must route the confirmed create through
> these same wasm methods, not `buildPlateau`, or growing from an authored-domain plateau silently breaks.

### 2.4 Slice 2 — touch / long-press trigger (issue #57)

Mobile parity for §2.2. Add a debounced `selectionchange` (or `touchend`) handler on `#detail-body`
that **reuses** `isGrowable` + `showRhizMenu(term, rect)` — **no new decision logic**. Clamp the menu
to the viewport; do not fight the OS selection handles or regress the R-0037 pinch/pan (`touch-action`).

### 2.5 Slice 3 — preview-before-create (issue #58)

Refactor `growPlateau` into **compute → draft → preview → confirm**: show a small preview (editable
name + editable body — the companion draft, or the offline stub) with **Create / Cancel**. Create
runs the §2.3 wasm add-path (`add_plateau`/`add_bridge`, **not** `buildPlateau`) with the (possibly
edited) name/body then opens the child; Cancel creates nothing. With a model connected, the draft
loads (a "growing…" state) before the preview. `childPosition` / `starterBody` / `draftPlateauPrompt`
stay untouched in `rhizome.js`.

The preview is a **separate floating element** (its own id, appended to `body`) — **not** inside
`#rhizome-menu`, whose buttons `mousedown`-preventDefault to preserve the text selection, which would
fight an editable `<input>`/`<textarea>`.

### 2.6 Slice 4 — "Add resource" action + de-dup (issue #59)

- **Pure `existingChild(parent, term, plateaus, bridges) → id | null`** (in `rhizome.js`, + tests):
  finds a bridge `parent → child` whose `concept === term`, returns the child id. Verified against the
  real DTO — `BridgeDto` is `{ id, from, to, concept }` (`convert.rs`), and `main.js` already reads
  `b.from`/`b.to`/`b.concept`.
- **Check dedup FIRST — before drafting.** `growPlateau` calls `existingChild` up front; on a hit it
  `openPlateau(existing)`s with **zero** model turn (cheap + idempotent), skipping `add_plateau`
  entirely. Dedup key = `(parent.id, normalize(term))` — **normalize the term (trim/collapse
  whitespace) the SAME way on both the dedup lookup and the stored bridge `concept`**, or two
  near-identical terms land a second child *exactly on top of* the first (`childPosition` is
  deterministic per `(parent, term)`).
- **"Add resource"** menu button: opens the existing add-resource form (`#detail-add-form`)
  **prefilled**, pinned to the current plateau via the **R-0014 / R-0015** audited path
  (`add_resource`) — no new resource path, no suggestion-prompt/parse logic. (Companion-suggested
  links are a later slice.)

## 3. Code outline (the one new pure helper)

```js
// rhizome.js — Slice 4
export function existingChild(parent, term, plateaus = [], bridges = []) {
  const has = new Set(plateaus.map((p) => p.id));
  for (const b of bridges) {
    if (b.from === parent.id && b.concept === term && has.has(b.to)) return b.to;
  }
  return null;
}
```

## 4. Non-goals

- The **map right-click study menu** is a *different* surface (already shipped) — this is the
  in-body text-selection menu.
- No auto-handwriting/LaTeX; no cross-domain grow (a child inherits the parent's domain); no growing
  from bridge labels; no OS-native context menu.

## 5. Open questions (settle before → Accepted)

1. **Instant vs preview default.** Slice 1 grows on click then opens. Does Slice 3 make preview the
   default, or an opt-in (e.g. a modifier)? Recommend: preview becomes the default once #58 lands.
2. **Dedup scope.** `(parent, term)` only, or also warn when the term already exists elsewhere in the
   graph? Recommend `(parent, term)` for Slice 4; a global "similar topic exists" hint is later.

## 6. Acceptance mapping (→ R-0044)

| R-0044 AC | Where |
|-----------|-------|
| AC1 select-to-act | §2.2 (desktop, shipped) + §2.4 (touch, #57) |
| AC2 inline gloss, no graph change | §2.2 `askInline` |
| AC3 bridged child via the existing path | §2.3 |
| AC4 companion-drafted / honest stub | §2.3 + `starterBody`/`draftPlateauPrompt` |
| AC5 drill in, unbounded | §2.3 `openPlateau(child)` |
| AC6 additive, web-only, pure core, tested | `rhizome.js` + tests; no core change |
| AC7 smoother reading | shipped in #64 (smooth scroll) |

**Testing:** `rhizome.test.mjs` (pure, shipped) + a new `existingChild` case for #59; a §7-style
manual browser smoke for the DOM/touch paths (select → menu → grow → drill).

## Changelog

- 2026-07-04 created (Draft) — formalizes R-0044: pure `rhizome.js` + the `main.js` selection seam
  (Slice 1 shipped on `main`), and specifies Slice 2 (touch #57), Slice 3 (preview #58), Slice 4
  (add-resource + dedup #59). Pending architect review.
