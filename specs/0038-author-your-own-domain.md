# SPEC-0038 — Author your own domain (custom lenses)

- **Status:** Implemented
- **Realizes:** R-0038
- **Depends on:** SPEC-0006/SPEC-0009 (the creator + `authorPersona`/`DOMAINS`/`AXES` in
  `persona.js`), SPEC-0012 (`localStorage` durability pattern, mirrors `mp.authoredPersona`),
  SPEC-0010 (`canonicalAxis`/`labelForDomain`/traversal scoring consume a domain's canonical)

## 1. Approach

A domain is already `{ id, label, canonical: {e1,e2,e3} }` — a named grade-1 direction —
and the fog/reputation engine projects onto **any** canonical, not only a basis axis. So
"more lenses" needs **zero core/garust change**: a pure `authorDomain` factory (mirrors
`authorPersona`), a tiny `localStorage` store (mirrors `mp.authoredPersona`), one runtime
`allDomains()` merge so a custom domain is surfaced **everywhere the built-in three are**,
and an "Add a lens" sub-form in the existing creator. Direction-only (never a magnitude).

**Key idea — the id is derived from the name.** `domainIdFor(name)` is a *deterministic*
UUID-format string from the normalized name. This buys three properties at once: (a)
re-authoring the same name **dedups** to the same domain; (b) a signed **traversal** in
the domain validates, because Rust parses `domain: Uuid` and the id is a valid UUID; (c)
the same name → the same id **across users**, so when domains are later shared/published
two people's "AI" line up — no separate hardcoded preset-UUID table needed. "Presets"
(AC5) are therefore just **suggested names + blend directions** offered in the add-lens
UI; choosing one authors it through the same name-derived path.

## 2. Design

### 2.1 `apps/web/src/persona.js` — pure additions + a label-resolver hook

```js
// Deterministic uuid-format id from a domain name. Pure (no crypto/random), so the
// same name → the same domain across sessions AND users (dedup + future cross-user
// alignment), and Rust's Uuid::parse_str accepts the 8-4-4-4-12 hex it produces — which
// is what lets a signed traversal in an authored domain validate. Not a real v5; it only
// needs to be stable + parseable, not namespaced-per-RFC.
export function domainIdFor(name) {
  const s = String(name ?? "").trim().toLowerCase();
  // Four INDEPENDENT 32-bit lanes → ~128-bit spread. Each lane uses a distinct golden-
  // ratio seed and a post-mix avalanche, so short/near-identical names don't collide on
  // the high bits (architect finding #2: a salt that only flips the low 2 bits gives ~32
  // effective bits, not 128).
  const lane = (salt) => {
    let h = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; // avalanche
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const x = lane(0) + lane(1) + lane(2) + lane(3);
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`;
}

const clamp01 = (n) => { const v = Number(n); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; };

// Pure: a named lens + a Formal/Empirical/Creative direction → a domain. Direction only,
// never a magnitude (CLAUDE.md §4). Blank name → null (rejected). Deterministic id.
//
// DIRECTION-ONLY SAFETY (architect finding #4): the raw 0..1 `canonical` is never treated
// as a magnitude downstream. The LIVE fog/reach projection reads `domain_reps` recomputed
// from the signed-event log (normalized), NOT this canonical; the only live consumer of
// `canonical` is `canonicalAxis → vouchFor`, whose endpoints become a UNIT-normalized
// even-grade rotor (`ga::normalize`), and with equal from/to endpoints the scale divides
// out. So a blend like {.7,.6,.1} (|v|≈0.92) behaves identically to a unit built-in. If a
// future change feeds `canonical` into `ga::project()` directly, THAT breaks the invariant.
export function authorDomain({ name, e1, e2, e3 } = {}) {
  const label = String(name ?? "").trim();
  if (!label) return null;
  return { id: domainIdFor(label), label, canonical: { e1: clamp01(e1), e2: clamp01(e2), e3: clamp01(e3) } };
}
```

**Label-resolver hook (architect finding #1 — BLOCKING fix).** `authorPersona` derives
`domainLabel` + `blurb` via persona.js's *internal* `labelForDomain`, which searches only
the static `DOMAINS` — so a persona facing a custom domain renders **"Uncharted"** on the
persona card (`main.js:706`), the companion intro (`main.js:598`), and the companion
grounding block (`companion-context.js:32`), all of which read `persona.domainLabel`.
Fix: thread an **optional** label resolver through `labelForDomain`/`describeOrientation`/
`authorPersona`; with no resolver the behaviour is **byte-identical** to today.

```js
function labelForDomain(domain, resolve) {
  return (resolve && resolve(domain)) || DOMAINS.find((d) => d.id === domain)?.label || "Uncharted";
}
function describeOrientation(faced, resolve) {
  if (faced.length === 0) return "Faces nothing yet — orient toward a domain to set where you begin.";
  const labels = faced.map(({ domain }) => labelForDomain(domain, resolve));
  return `Wakes facing ${labels.join(" and ")} — your starting orientation.`;
}
export function authorPersona({ name, orient, tone } = {}, resolveLabel) {  // resolveLabel optional
  const faced = (orient ?? []).filter(({ dir }) => Math.hypot(dir?.e1 ?? 0, dir?.e2 ?? 0, dir?.e3 ?? 0) > 0);
  const labels = faced.map(({ domain }) => labelForDomain(domain, resolveLabel));
  return { id: "authored", name: (name ?? "").trim() || "Your persona",
           domainLabel: labels.join(" × ") || "Uncharted",
           blurb: describeOrientation(faced, resolveLabel),
           orient: faced, voice: tone?.trim() ? `Speak as ${tone.trim()}.` : undefined };
}
```

This **does** edit `persona.js` (the earlier "untouched" claim is dropped) — but only by
adding an optional parameter; `DOMAINS`/`seedReputation`/`AXES` and the no-resolver
behaviour are unchanged. main.js passes a resolver over `allDomains()` at **both**
`authorPersona` call sites (the build-your-own "Enter" handler ≈816 and the on-reload
restore), via a one-line wrapper `buildAuthored(seed) = authorPersona(seed, domainLabelOf)`.

// Suggested lenses for the add-lens datalist — grounded blends of the three axes (NOT new
// axes). Choosing one pre-fills the sliders; it is then authored via authorDomain (so its
// id is name-derived like any other). These are hints, not a separate registry.
export const SUGGESTED_DOMAINS = [
  { name: "Computation",      canonical: { e1: 0.85, e2: 0.45, e3: 0.0 } },
  { name: "Engineering",      canonical: { e1: 0.45, e2: 0.85, e3: 0.1 } },
  { name: "AI",               canonical: { e1: 0.70, e2: 0.60, e3: 0.1 } },
  { name: "Electromagnetism", canonical: { e1: 0.55, e2: 0.80, e3: 0.0 } },
  { name: "FPGA / Hardware",  canonical: { e1: 0.50, e2: 0.80, e3: 0.0 } },
];
```

`DOMAINS`, `authorPersona`, `seedReputation`, `AXES` are **unchanged** — so R-0009's
default author form (the original three blocks, face-all default) is byte-identical.

### 2.2 `apps/web/src/main.js` — merge + add-lens UI

- **Import** `authorDomain`, `SUGGESTED_DOMAINS` alongside `DOMAINS`, `AXES`, `authorPersona`.
- **Store** (mirrors `AUTHORED_KEY`/`saveAuthored`):
  ```js
  const DOMAINS_KEY = "mp.domains";
  let customDomains = loadCustomDomains();           // [{id,label,canonical}], validated
  const allDomains = () => [...DOMAINS, ...customDomains];
  function addCustomDomain(d) {                       // dedup by id (re-authoring a name)
    if (!d) return;
    if (DOMAINS.some((b) => b.id === d.id) || customDomains.some((c) => c.id === d.id)) {
      customDomains = customDomains.map((c) => (c.id === d.id ? d : c)); // re-aim updates
    } else customDomains = [...customDomains, d];
    saveCustomDomains();
  }
  ```
  `loadCustomDomains` is defensive (array; each entry must have a string `id` + `label`
  and a `canonical` whose `e1/e2/e3` are **finite numbers** — `Number.isFinite`; any entry
  failing this is dropped so a corrupt blob can't poison `canonicalAxis`), exactly like the
  authored-seed loader.
- **Surface everywhere** — replace the four `DOMAINS` reads with `allDomains()`:
  - `labelForDomain` (≈477) and `canonicalAxis` (≈480) → search `allDomains()` (so a custom
    domain resolves to its label in the HUD/discovery/map and contributes its canonical to
    vouch endpoints + traversal/discovery scoring — AC4).
  - `buildAuthorForm` (≈734) → iterate `allDomains()` so authored domains render as faceable
    blocks (default toggled-on, so a freshly-added lens is immediately faced).
  - the `#dp-domain` populate loop (≈1700) → iterate `allDomains()`; extract a
    `populateDomainSelect()` helper that **clears first** (`select.replaceChildren()`) then
    re-populates, called at init **and** after `addCustomDomain`, so a new lens is selectable
    when drafting a plateau (AC4) without a reload and built-ins aren't duplicated (finding #5).
- **Add-lens sub-form** inside `buildAuthorForm`, below the domain blocks and above the tone
  field: a text input (`list="domain-suggestions"`), three reused axis sliders, and an "Add
  lens" button. Selecting a suggested name pre-fills the sliders from its canonical (a
  small `input` handler). On click:
  ```js
  const d = authorDomain({ name: nameInput.value, e1: s.e1.value, e2: s.e2.value, e3: s.e3.value });
  if (!d) return;                                    // blank name: no-op
  addCustomDomain(d);
  rebuildAuthorForm();                                // re-render: new faceable block appears, inputs cleared
  ```
  Re-render preserves the in-progress name/tone/faced state by reading the live controls
  into `authoredSeed` first (same shape `buildAuthorForm` already restores from), so adding
  a lens doesn't lose the half-built persona.
- **Datalist** `#domain-suggestions` (options from `SUGGESTED_DOMAINS`) lives in index.html.

No other call sites change. `authoredSeed.orient` already stores `{domain,dir}` keyed by
id, so an authored persona that faces a custom domain round-trips through the existing
`saveAuthored`/`authorPersona` path; on reload the custom domain is restored from
`mp.domains` first, so `labelForDomain` resolves it (no "Uncharted").

### 2.3 `apps/web/index.html` — datalist + minimal CSS

- A `<datalist id="domain-suggestions">` with one `<option>` per `SUGGESTED_DOMAINS` name
  (rendered in JS at form build, or static — JS keeps it single-sourced).
- Reuse `.author-domain`/`.author-axes`/`.axis-row`/`.author-actions`; add only an
  `.add-lens` wrapper rule if spacing needs it. No new color/layout system.

## 3. Code outline / files touched

| File | Change |
|------|--------|
| `apps/web/src/persona.js` | + `domainIdFor`, `authorDomain`, `SUGGESTED_DOMAINS` (pure); `authorPersona`/`labelForDomain`/`describeOrientation` gain an **optional** `resolveLabel` (no-resolver behaviour byte-identical). `DOMAINS`/`seedReputation`/`AXES` untouched. |
| `apps/web/src/persona.test.mjs` | + `authorDomain`/`domainIdFor` cases (see §5). |
| `apps/web/src/main.js` | + `mp.domains` store, `allDomains()`, `addCustomDomain`, `populateDomainSelect()`; route `labelForDomain`/`canonicalAxis`/`buildAuthorForm`/`#dp-domain` through `allDomains()`; add-lens sub-form. |
| `apps/web/index.html` | + `#domain-suggestions` datalist; minor CSS reuse. |
| `requirements/0038-*.md`, `specs/0038-*.md`, the two READMEs | status/index. |

## 4. Non-goals (from R-0038 §4)

No new GA axis / no garust change; no magnitude/rank authoring; authored domains are
browser-local (cross-user reconciliation rides the later paths/publish work — the
name-derived id is the hook); no per-domain colors/archetypes; no trailhead-plateau
authoring (use Draft-a-plateau); no edit/delete UI beyond re-authoring a name (which
updates the canonical).

## 5. Test plan

**Unit (`persona.test.mjs`, pure):**
- `authorDomain({name:"AI", e1:.7, e2:.6, e3:.1})` → `{label:"AI", canonical:{e1:.7,e2:.6,e3:.1}}`, id is a valid UUID-format string.
- **Stable + dedup:** `domainIdFor("AI") === domainIdFor("ai") === domainIdFor("  AI ")` (normalized); two `authorDomain` calls with the same name share an id.
- **Direction only:** out-of-range/NaN slider → clamped to [0,1]; no magnitude field exists on the result.
- **Rejects blank:** `authorDomain({name:"   "})` → `null`; `authorDomain({})` → `null`.
- **UUID-format:** id matches `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (so a Rust `Uuid::parse_str` would accept it).
- **Distinct names → distinct ids** (no collision for the suggested set + near-identical short names like `"a"`/`"b"`/`"ai"`/`"ia"`, since lanes are now independent — finding #2).
- **Label resolver (finding #1):** `authorPersona({orient:[{domain:<custom-id>, dir:{e1:1}}]}, (id)=> id===<custom-id> ? "AI" : undefined)` → `domainLabel` is `"AI"` and `blurb` contains `"AI"`, NOT "Uncharted"; and `authorPersona(seed)` with **no** resolver is byte-identical to the pre-0038 output (a known-orient snapshot).

**e2e / browser (R-0038 AC7):** author "AI" (Formal+Empirical lean) → it appears as a
faceable block + is selectable in Draft-a-plateau; build + enter a persona facing it (HUD
shows "AI", not "Uncharted"); reload → `mp.domains` restores it, still faceable +
label resolves; suites green; console clean.

## 6. Acceptance mapping

| AC | Evidence |
|----|----------|
| AC1 author a domain | add-lens sub-form → `authorDomain` → faceable block; browser |
| AC2 direction-only, grounded | sliders 0..1 → `canonical`, `clamp01`, no magnitude; `allDomains()` feeds the same `canonicalAxis` projection; no core change (diff) |
| AC3 durable + identified | `mp.domains` load/save (reload test); `domainIdFor` stable UUID-format (unit) → traversal validates |
| AC4 surfaced everywhere | `allDomains()` in `labelForDomain`/`canonicalAxis`/author form/`#dp-domain`; browser (HUD label + plateau select) |
| AC5 presets | `SUGGESTED_DOMAINS` datalist pre-fills sliders; authored via the same path (name-derived shared id) |
| AC6 pure + tested, additive | `authorDomain`/`domainIdFor` pure + unit tests; JS/CSS only (diff); existing suites green |
| AC7 green + browser | full `node --test`; browser author→reload→draft flow |

## Changelog

- 2026-06-22 implemented + QA **PASS** (AC1–AC7). `persona.js`: pure `domainIdFor`
  (4 independent FNV lanes + avalanche → stable uuid-format id), `authorDomain`
  (direction-only, clamped, blank→null), `SUGGESTED_DOMAINS`, + the optional `resolveLabel`
  hook (no-resolver byte-identical). `main.js`: `mp.domains` store (finite-validated),
  `allDomains()`, `addCustomDomain` (dedup, never shadow a built-in), `buildAuthored`
  resolver wired at both `authorPersona` sites; the four `DOMAINS` reads routed through
  `allDomains()`; `populateDomainSelect()` (clears first); the "Add a lens" sub-form
  (name + sliders + suggestion pre-fill → faced-by-default re-render). `index.html`:
  `#domain-suggestions` datalist + dashed `.add-lens` CSS. 7 new unit tests (16 in
  persona.test.mjs; 269 total green). Browser-verified: authored "AI" → faceable +
  selectable + persisted with a valid uuid id; entered facing it → companion says "AI",
  zero "Uncharted"; reload → `mp.domains` survives + both lenses still faceable; console
  clean. Additive (apps/web only, no Rust/core). **Status → Implemented.**
- 2026-06-22 architect design review: **REQUEST-CHANGES → resolved.** (#1, BLOCKING) the
  `persona.domainLabel`/`blurb` path resolved only static `DOMAINS` → "Uncharted" on the
  card/companion intro/grounding for a custom-domain persona → fixed by an optional
  `resolveLabel` threaded through `authorPersona`/`labelForDomain`/`describeOrientation`
  (no-resolver = byte-identical), with main.js passing a resolver over `allDomains()` at
  both call sites + a unit test. (#2) `domainIdFor` lanes were near-dependent (~32-bit) →
  re-seeded per-lane (golden-ratio) + avalanche for ~128-bit spread + a near-identical-name
  test. (#4) added the explicit direction-only safety argument (live fog reads recomputed
  log-reputation, not the canonical; vouch rotor is normalized). (#5) `populateDomainSelect`
  clears before re-populating. (#6) `loadCustomDomains` checks `e1/e2/e3` finiteness.
  Architect confirmed the central thesis (a domain is any named grade-1 direction; the core
  projects onto any canonical and parses any UUID-format id) holds in-codebase, and the
  feature is genuinely additive (no Rust/wasm/CRDT/garust change). **Status → Accepted.**
- 2026-06-22 drafted. Pending architect design review.
