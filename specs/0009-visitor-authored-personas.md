# SPEC-0009 — Visitor-authored personas: craft your own lens

- **Status:** Implemented
- **Realizes:** R-0009
- **Author:** Claude
- **Created:** 2026-06-01
- **Depends on:** SPEC-0006 (persona creator), SPEC-0007 (companion)

## 1. Goal & shape

Let a visitor **author their own persona** — a name, an orientation in the
knowledge geometry, and (optionally) a companion tone — and carry it into the
world exactly as a preset archetype does: it seeds the **local** reputation,
lights a starting map, and **embodies the companion** (R-0007). This is a
**client-only** extension of already-audited code.

The decisive fact about the existing design is that it was built for this:

- `persona.js`'s `seedReputation(archetype)` **already accepts any `{ orient }`
  shape** — it iterates `archetype.orient ?? []`, normalizes each `dir` to a unit
  grade-1 vector and scales by the fixed `SEED` (0.16). It does not know or care
  whether the orientation came from a preset card or a visitor. So the
  orientation→reputation mapping (R-0009 AC2/AC6) needs **no new logic**: an
  authored persona is just an archetype-shaped object.
- `companion-voice.js`'s `voiceFor(persona)` **already falls back gracefully**
  (`VOICES[persona.id] || "Speak as a helpful, grounded guide."`), so an authored
  persona with no built-in voice cannot crash (R-0009 AC3).
- `companion-context.js`'s `buildGroundingContext` reads only `persona.name` /
  `persona.domainLabel` and the orientation-derived `reachableIds`/`nearest`, so an
  authored persona grounds the companion with no change (R-0009 AC3).

Therefore SPEC-0009 adds **one pure factory** (`authorPersona`), **one tiny,
fallback-preserving change** to `voiceFor`, and the **authoring UI** that collects
`{ name, orient, tone }`. No Rust change, no new JS GA/graph/CRDT logic, no new
math library, no CRDT field (R-0009 §4).

## 2. Architecture

### 2.1 The data shape an authored persona must produce (unchanged contract)

`choosePersona(archetype)` (main.js) already does everything once it holds an
archetype-shaped object:

```js
{ id, name, domainLabel, blurb, orient: [{ domain: <uuid>, dir: { e1, e2, e3 } }, …] }
```

`seedReputation` turns `orient` into `{ domain_reps: { <uuid>: [8 floats] } }` —
the exact JSON `mp-wasm`'s `reachable_plateaus` / `nearest_plateaus` already
consume. An authored persona is **the same object with a visitor-chosen `name` and
`orient`** (plus an optional voice). Nothing downstream changes.

### 2.2 `persona.js` — pure additions

Add the authoring vocabulary and a pure factory. No change to `seedReputation`,
`ARCHETYPES`, `SEED`, or the domain constants.

```js
// The domains a visitor may orient toward this phase (the seeded clusters).
export const DOMAINS = [
  { id: MATH_DOMAIN,  label: "Mathematics", canonical: { e1: 1, e2: 0, e3: 0 } },
  { id: MUSIC_DOMAIN, label: "Music",       canonical: { e1: 0, e2: 0, e3: 1 } },
];

// The three GA axes under HUMAN labels — the UI renders these, never "e1/e2/e3"
// (R-0009 AC1: no raw blade indices leak to the visitor). e1=Formal, e2=Empirical,
// e3=Creative are the axis semantics from ga.rs / GARUST_INTEGRATION.md.
export const AXES = [
  { key: "e1", label: "Formal" },
  { key: "e2", label: "Empirical" },
  { key: "e3", label: "Creative" },
];

// Pure: { name, orient, tone } → an archetype-shaped persona. Drops any domain
// whose direction is all-zero (so it neither lights nor mislabels), derives a
// domainLabel from the faced domains, and composes an optional companion voice
// from the visitor's tone. Deterministic. Exposes ONLY direction — there is no
// magnitude/score/rank input anywhere in the shape (CLAUDE.md §4, R-0009 AC1/AC5).
export function authorPersona({ name, orient, tone } = {}) {
  const faced = (orient ?? []).filter(
    ({ dir }) => Math.hypot(dir?.e1 ?? 0, dir?.e2 ?? 0, dir?.e3 ?? 0) > 0,
  );
  const labels = faced.map(({ domain }) => labelForDomain(domain));
  return {
    id: "authored",                              // not a key in VOICES → voice falls back
    name: (name ?? "").trim() || "Your persona",
    domainLabel: labels.join(" × ") || "Uncharted",
    blurb: describeOrientation(faced),
    orient: faced,
    voice: tone?.trim() ? `Speak as ${tone.trim()}.` : undefined,
  };
}
```

`labelForDomain` / `describeOrientation` are tiny pure helpers (domain→label
lookup; a one-line human blurb). `authorPersona` is **the only new mapping** and
is unit-tested (AC6). Because it routes through the unchanged `seedReputation`,
the seed magnitude is provably the fixed `SEED` for authored and preset personas
alike — authoring sets *direction only* (AC1/AC5, CLAUDE.md §4).

### 2.3 `companion-voice.js` — fallback-preserving change

Prefer an explicit per-persona `voice` (what `authorPersona` composes from the
visitor's tone), then the built-in archetype voice, then the existing generic
fallback. This is purely additive — presets (no `.voice`) behave exactly as today,
and an authored persona with no tone still gets the generic line (no crash, AC3):

```js
export function voiceFor(persona) {
  if (persona?.voice && persona.voice.trim()) return persona.voice.trim();
  return (persona && VOICES[persona.id]) || "Speak as a helpful, grounded guide.";
}
```

### 2.4 Authoring UI (main.js + index.html) — AC1/AC4

Extend the existing creator overlay (`buildCreator`) with a **"Create your own"**
affordance that reveals an authoring form. The form collects:

- **Name** — a text field.
- **Orientation** — for each domain in `DOMAINS`, an **enable toggle** and the
  three `AXES` sliders (Formal / Empirical / Creative). Each enabled domain's
  three-slider vector is its grade-1 `dir`; the sliders default to the domain's
  `canonical` axis so the simplest path ("just enable Mathematics and Music")
  reproduces the Polymath, while re-aiming a slider authors a novel map. Sliders
  range `0..1` and express **direction only** — `seedReputation` normalizes the
  vector, so slider scale is discarded and there is deliberately **no strength /
  magnitude / rank control** (AC1/AC5).
- **Companion tone** — an optional short text field → `persona.voice` (AC3).
- **Enter the world** — builds `authorPersona({ name, orient, tone })` and calls
  the existing `choosePersona(...)`, which re-seeds the local reputation, hides
  the creator, embodies the companion, and re-lights the world **with no reload**
  (AC4, reusing the R-0006 path verbatim).

The active persona is already shown in the HUD (`activePersona.name · …`) and the
companion header; "Change persona" already re-opens the creator, from which the
visitor can pick another preset **or author a new one** (AC4). A domain left
disabled (or all-zero) is omitted; an orientation facing nothing seeds an empty
reputation and is **safe** — the world stays fogged, never crashes (AC6).

**Empty-orientation guard (architect must-fix).** Three existing handlers in
`main.js` assume a non-empty orientation and read `activePersona.orient[0].domain`:
the canvas click (line ~329, as the `DOMAIN_OF` fallback), **"Add a plateau"** (line
~341), and the click-to-grow path. With an authored persona that faces nothing,
`orient` is `[]`, so `orient[0]` is `undefined` and `.domain` would throw — an
uncaught error that violates AC6. The click path is in practice shielded (an empty
orientation reaches no plateau, so the `if (hit)` branch never runs) and `reset-fog`
routes through the empty-safe `seedReputation`, but **"Add a plateau" fires on any
click regardless of reachability and is a genuine throw.** Implementation MUST guard
these sites: when `orient` is empty, derive the domain defensively (e.g.
`activePersona.orient[0]?.domain ?? FALLBACK_DOMAIN`, or no-op the add) so an
authored empty persona keeps the world fully interactive and console-clean. A test
extends the AC6 fog property to these UI handlers (an empty-orient persona can click
the canvas, "Add", and "Reset my fog" with no uncaught error).

### 2.5 Persistence — AC4 (decided)

Persist the **most-recently authored persona** to `localStorage` under
`mp.authoredPersona`, mirroring the existing `mp.modelConfig` pattern (main.js
`loadConfig`/`saveConfig`). On load, if a stored authored persona is present, the
creator surfaces it as an extra selectable entry ("Your persona") so it survives a
reload. It stores only `{ name, orient, tone }` and is **local-only — never synced,
never in the CRDT** (AC5). Authoring a new persona overwrites it. A corrupt/missing
entry is ignored (try/catch → no entry), exactly like `loadConfig`.

`buildCreator` currently renders cards from `ARCHETYPES` only and hands the raw
object to `choosePersona`. To avoid a second seeding path, the surfaced stored entry
is passed through **`authorPersona({ name, orient, tone })` first** (i.e. the stored
`{ name, orient, tone }` is rebuilt into the canonical archetype-shaped object), then
given to the unchanged `choosePersona` — so a restored authored persona seeds via the
identical mapping as a freshly authored one.

## 3. Implementation plan (page stays usable at every step)

1. **`persona.js`:** add `DOMAINS`, `AXES`, `authorPersona`, and the
   `labelForDomain`/`describeOrientation` helpers. Pure; unit-tested first (TDD).
2. **`companion-voice.js`:** add the `persona.voice` preference (one line); keep
   the fallback. Extend/keep the voice tests.
3. **`index.html`:** add the authoring-form markup + styles inside the creator
   overlay (a "Create your own" toggle revealing the name / sliders / tone form),
   reusing the existing overlay/card styling.
4. **`main.js`:** wire the "Create your own" affordance → form → `authorPersona` →
   `choosePersona`; add `loadAuthored`/`saveAuthored` (localStorage) and surface a
   stored authored persona in `buildCreator` (rebuilt via `authorPersona`, §2.5);
   **guard the empty-orientation case** in the click / "Add a plateau" / reset
   handlers (§2.4) so an authored persona facing nothing stays console-clean.
5. **Rebuild** the wasm bundle is **not** required (no Rust change); just reload
   the static page. Browser smoke per §4.

Each step keeps the page loading and the presets working.

## 4. Test plan (R-0009 AC6)

- **Pure unit (node `--test`, no wasm)** — extend `persona.test.mjs` (or a new
  `authored.test.mjs`):
  - `authorPersona` facing Mathematics (Formal) → `seedReputation` yields
    `domain_reps[MATH] = [0, 0.16, 0, 0, 0, 0, 0, 0]` (identical to the Geometer —
    proves authored routes through the same pure mapping, AC2/AC6).
  - **Two different authored orientations → different `domain_reps`** (the
    "visibly different lit sets" property at the data layer, AC2).
  - **All-zero / no faced domain → empty `domain_reps`** (Sybil/fog preserved,
    AC6); `authorPersona` drops the all-zero domain and labels it "Uncharted".
  - Determinism: same input → deep-equal output (AC6).
  - Direction-only: scaling every slider by a constant leaves `domain_reps`
    unchanged (normalization discards magnitude — AC1/AC5).
  - `domainLabel` derivation (one domain → its label; two → "A × B").
- **Voice (new `companion-voice.test.mjs`):** `voiceFor` returns the authored
  `voice` when present; an authored persona **without** a voice falls back to the
  generic line (no crash, AC3); presets still resolve their built-in voice.
- **Empty-orientation UI safety (architect must-fix, AC6):** an authored persona
  with `orient: []` keeps the world interactive — clicking the canvas, "Add a
  plateau", and "Reset my fog" produce **no uncaught error** (covers the guarded
  `orient[0]` sites of §2.4). Asserted in the browser smoke; the pure layer already
  proves empty `orient` → empty `domain_reps`.
- **Regression:** the existing `persona`, `model`, `project`, `companion-context`
  node suites stay green; nothing about the change touches the Rust/wasm layer.
- **Gates:** `cargo test --workspace`, `wasm-pack test --node`, clippy `-D
  warnings` (host + `wasm32`), `cargo fmt --check`, `node --test
  apps/web/src/*.test.mjs`, and a **fog-world browser smoke**: author a persona,
  confirm a *different* set of plateaus lights than a preset, the companion header
  shows the authored name, and there are **no uncaught console errors**. Also
  re-assert the HUD's existing `root_keys` check still prints
  `{bridges, plateaus, resources, votes} ✓` (AC5).

## 5. CLAUDE.md compliance

- **§1 garust-only math / no GA in JS:** `authorPersona` only assembles floats into
  the `{ domain_reps }` shape; every projection/grade computation stays in the wasm
  core via the unchanged `reachable_plateaus`/`nearest_plateaus`. No new math lib.
- **§4 reputation never a scalar / orientation not magnitude:** the authoring UI
  exposes only direction; `seedReputation` normalizes and applies the fixed `SEED`,
  so an authored persona's reputation is a grade-1 multivector of the same fixed
  magnitude as every preset. No score/rank/magnitude field exists in the shape.
- **§7 reputation/config/chat never in the CRDT:** the authored persona, its name,
  tone and reputation live only in page state + `localStorage`; the
  `BroadcastChannel`/synced doc are untouched, root keys stay
  `{bridges, plateaus, resources, votes}` (asserted in the HUD and AC5 test).
- **No Rust change:** additive front-end only; the audited core is untouched.

## 6. Open questions (for architect review)

1. **Authoring controls.** Per-domain three-axis sliders (chosen — literal reading
   of AC1, "a grade-1 direction per domain", with canonical-axis defaults for an
   easy path) vs. a single shared direction + domain toggles (fewer controls but
   makes the per-domain `orient` a duplicate vector, weakening the "domain choice
   is scoped" story). Confirm the slider-per-axis-per-domain choice.
2. **Axis labels.** "Formal / Empirical / Creative" for e1/e2/e3 (from the ga.rs /
   GARUST_INTEGRATION axis semantics). Are these the right visitor-facing words, or
   should they be domain-flavored ("Structure / Evidence / Expression")?
3. **Voice composition.** `authorPersona` wraps the tone as ``Speak as ${tone}.``
   vs. storing the visitor's string verbatim as the system voice. (Wrapping keeps a
   consistent imperative voice and avoids an empty/garbled instruction.)
4. **Persistence.** Persist the most-recent authored persona to `localStorage`
   (chosen, §2.5) vs. ephemeral per-session. Confirm local-only persistence is
   wanted for the POC.
5. **Empty orientation.** Allow entering the world with nothing faced (safe, fully
   fogged) vs. requiring at least one enabled domain. (Chosen: allow + a gentle
   hint; AC6 only requires it be *safe*, not prevented.)

## 7. Designs considered (and why this one)

- **Chosen — pure `authorPersona` factory + UI, reusing `seedReputation` and the
  voice fallback.** The orientation→reputation mapping and the companion path are
  already generic; the only new pure code is `authorPersona` (+ a one-line voice
  preference). Smallest surface, no Rust/wasm/CRDT change, behaviour of presets
  unchanged.
- **Rejected — a new "authored reputation" path or a magnitude/strength control.**
  Would duplicate `seedReputation`, risk drift between authored and preset seeding,
  and (the magnitude control) violate CLAUDE.md §4 — rank is earned, not dialed in.
- **Rejected — persisting/syncing the authored persona through the CRDT or
  BroadcastChannel.** Violates CLAUDE.md §7 and R-0009 AC5; personas are a
  per-visitor local lens. Persistence, if any, is `localStorage` only.
- **Deferred — authoring new domains / plateau clusters, negative-direction axes,
  real identity.** R-0009 §4 non-goals (Phase 8 / a later content task). This phase
  orients within the existing Mathematics/Music seed clusters, non-negative axes.

## 8. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-01 | Authored persona is an archetype-shaped object built by a pure `authorPersona({name,orient,tone})`, routed through the unchanged `seedReputation` | The seeding mapping already accepts any `{orient}`; reuse keeps authored and preset seeding bit-identical and avoids new GA/CRDT logic in JS |
| 2026-06-01 | Per-domain three-axis sliders under human labels (Formal/Empirical/Creative), canonical-axis defaults | Literal reading of AC1 ("a grade-1 direction per domain"); defaults give a one-click easy path, re-aiming authors a novel map |
| 2026-06-01 | Direction only — no magnitude/strength control; sliders normalized away, `SEED` fixed and shared with presets | CLAUDE.md §4 / R-0009 AC1/AC5: rank is earned geometry, authoring sets only which way the lens faces |
| 2026-06-01 | Companion voice = optional visitor tone wrapped as ``Speak as ${tone}.``, preferred over the id-keyed `VOICES`, falling back to the generic line | Embodies the authored persona (AC3) while preserving the graceful no-crash fallback for a voiceless authored persona |
| 2026-06-01 | Persist the most-recent authored persona to `localStorage` (`mp.authoredPersona`), local-only | Mirrors the audited `mp.modelConfig` pattern; survives reload without ever entering the CRDT (AC4/AC5) |

## Changelog

- 2026-06-01 created (Draft) — pending architect design review, then R-0009 → Accepted.
- 2026-06-01 architect review → **APPROVE-WITH-NITS**; folded findings in and **Status → Accepted**.
  Verified the three reuse claims against the real code: `seedReputation` (persona.js)
  is shape-agnostic and applies the fixed `SEED = 0.16`; `voiceFor` falls back
  gracefully and `id:"authored"` is not a `VOICES` key (cannot crash); the proposed
  `voice` preference is purely additive and preset-safe; `buildGroundingContext` reads
  only `persona.name`/`domainLabel`. CLAUDE.md §1/§4/§7 confirmed clean (no GA in JS;
  direction-only, no magnitude field; nothing persona/reputation-related touches the
  CRDT — root keys stay `{bridges,plateaus,resources,votes}`). All of AC1–AC6 covered.
  Must-fix folded in: **guard the empty-orientation case** at the `activePersona.orient[0]`
  sites in `main.js` (notably "Add a plateau", which throws on any click for an empty
  authored persona) plus a UI-safety test (§2.4, §3, §4). Nit folded in: the surfaced
  stored authored persona is rebuilt via `authorPersona` before `choosePersona` to avoid
  a second seeding path (§2.5). Open nit left for the owner: e2 axis label
  ("Empirical" vs R-0009's "Physical") — cosmetic, tracked in §6 Q2.
- 2026-06-01 implemented + QA-signed-off → **Status → Implemented**. Pure additions
  `DOMAINS`/`AXES`/`authorPersona` in `persona.js`; one-line `voiceFor` preference in
  `companion-voice.js`; authoring UI (name + per-domain enable toggle + three
  human-labeled axis sliders Formal/Empirical/Creative + optional tone) and
  `loadAuthored`/`saveAuthored` (`localStorage mp.authoredPersona`) in `main.js`;
  authoring CSS in `index.html`. Architect must-fix landed: empty-orientation guards
  (`activePersona.orient[0]?.domain`) in the canvas-click and "Add a plateau"
  handlers, plus a `buildCreator()` rebuild on "Change persona". Gates green: JS
  `node --test` **43 pass** (+15 new across `authored.test.mjs` and
  `companion-voice.test.mjs`, +2 QA-added); `cargo test --workspace` **79 pass** (no
  Rust changed); clippy `-D warnings` host + `wasm32` clean; `cargo fmt --all --check`
  clean. Browser smoke (port 8137): a Math-authored persona lights **Arithmetic**, a
  Music-authored one lights **Rhythm** (visibly different sets, AC2), the companion
  header shows the authored name and the tone-derived voice resolves (AC3), an empty
  "Wanderer" persona is fully interactive with **no thrown error** and **0/8 lit**
  (AC6), the HUD re-asserts root keys `{bridges, plateaus, resources, votes} ✓` (AC5),
  and the console is error/warning-free.
