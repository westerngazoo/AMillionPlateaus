# SPEC-0019 — Onboarding & wayfinding: career-lens copy, travel, first-run tutorial

- **Status:** Implemented
- **Realizes:** R-0019
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** SPEC-0005 (render/projection), SPEC-0006/0009 (persona/lens), SPEC-0011 (plateaus)
- **Module(s):** `apps/web/src/wayfinding.js` + `wayfinding.test.mjs` (new), `apps/web/src/tutorial.js` + `tutorial.test.mjs` (new), `apps/web/src/render.js`, `apps/web/src/main.js`, `apps/web/index.html`. **No Rust, no new deps.**

## 1. Motivation

R-0019: make first contact legible — rename "persona" → "career lens" (copy
only), add a Travel control to focus the camera on a topic, and a remembered
first-run tutorial. All JS/copy; the centering math + the tutorial seen-gate are
pure and unit-tested; no GA/CRDT/Rust change.

## 2. Design

### 2.1 Module layout

```
apps/web/src/wayfinding.js     ← NEW  pure centerOn(position, {width,height}, scale) → {cx,cy}
apps/web/src/wayfinding.test.mjs ← NEW
apps/web/src/tutorial.js       ← NEW  TUTORIAL_STEPS + shouldShowTutorial/markTutorialSeen(storage)
apps/web/src/tutorial.test.mjs ← NEW
apps/web/src/render.js         ← EDIT optional focusedId → a focus ring
apps/web/src/main.js           ← EDIT VIEW let; travel wiring; tutorial wiring; copy renames
apps/web/index.html            ← EDIT Travel control + tutorial overlay + CSS + copy renames
```

### 2.2 `wayfinding.js` — pure camera centering

Inverts the projection (`project.js`: `x = cx + scale·(e1−½e2)`, `y = cy +
scale·(e3−½e2)`) to find the view origin that lands `position` at canvas center:

```js
// wayfinding.js — pure. Camera math for "travel to a topic" (SPEC-0019/R-0019).
// Returns the view origin {cx,cy} that places `position` at the canvas centre
// under project.js's fixed isometric projection. No GA, no graph state.
export function centerOn({ e1 = 0, e2 = 0, e3 = 0 }, { width, height }, scale) {
  return {
    cx: width / 2 - scale * (e1 - 0.5 * e2),
    cy: height / 2 - scale * (e3 - 0.5 * e2),
  };
}
```

Test (against the real `project`): `project(pos, { ...centerOn(pos, c, s), scale: s })`
equals `{ x: width/2, y: height/2 }` for several positions; deterministic.

### 2.3 `tutorial.js` — content + remembered seen-gate

```js
// tutorial.js — first-run welcome content + a local-only seen-gate (SPEC-0019).
// Pure data + injected storage (mirrors events.js); never synced, never in the CRDT.
export const TUTORIAL_KEY = "mp.tutorialSeen";

export const TUTORIAL_STEPS = [
  { title: "Welcome to the world", body: "Every island is a topic; bridges connect related ideas. You fly through a map of knowledge, not a course." },
  { title: "Your career lens", body: "Pick a career lens — it orients you and lights where you start. A geometer wakes facing maths; a composer, music. Change it anytime." },
  { title: "The fog is earned", body: "Topics you haven't earned sit in fog. Reach lights up as you explore adjacent topics — depth, not shortcuts." },
  { title: "Grow & travel", body: "Draft your own topics and bridges, drop markers, vote them into bedrock — and Travel to focus the map on any island." },
  { title: "Off you go", body: "That's it. Choose your career lens and start exploring." },
];

export function shouldShowTutorial(storage) {
  try { return !storage.getItem(TUTORIAL_KEY); } catch { return false; }
}
export function markTutorialSeen(storage) {
  try { storage.setItem(TUTORIAL_KEY, "1"); } catch { /* private mode — show each visit, harmless */ }
}
```

Test: fresh storage ⇒ `shouldShowTutorial` true; after `markTutorialSeen` ⇒ false;
a throwing storage ⇒ false (no crash). Replay is a UI action (open regardless of
the flag), so it isn't gated by these.

### 2.4 `render.js` — a focus ring

`render({ …, focusedId = null })` — after the plateau discs, if `focusedId` has a
screen point, stroke a distinct ring around it (camera highlight only):

```js
if (focusedId) {
  const pt = points.get(focusedId);
  if (pt) {
    ctx.save();
    ctx.strokeStyle = "#9fd0ff"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, RADIUS + 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
```

### 2.5 `main.js` — travel + tutorial + renames

- **VIEW** becomes `let VIEW = {...}` so travel can re-origin it; `draw()` passes
  `focusedId` (a module `let focusedId = null`) to `render`.
- **Travel:** a toolbar **"Travel"** button toggles a `#travel` panel with a
  `#travel-topic` select rebuilt on open from `doc.to_graph().plateaus()` (by
  name, like the bridge form). On submit:
  ```js
  const p = doc.to_graph().plateaus().find((x) => x.id === travelSel.value);
  if (p) {
    const { cx, cy } = centerOn(p.position, { width: canvas.width, height: canvas.height }, VIEW.scale);
    VIEW.cx = cx; VIEW.cy = cy; focusedId = p.id; draw();
    setTimeout(() => { focusedId = null; draw(); }, 1800); // transient ring
  }
  ```
  No reachability/CRDT/persistence touched.
- **Tutorial:** on load, `if (shouldShowTutorial(localStorage)) showTutorial(0)` —
  the `#tutorial` overlay (z-index above `#creator`) renders `TUTORIAL_STEPS[i]`
  with Back / Next / Got-it + step dots. **Got it** → `markTutorialSeen(localStorage)`
  + hide (revealing the lens picker beneath). A toolbar **"Tour"** button calls
  `showTutorial(0)` unconditionally (replay).
- **Copy renames (AC1, user-facing only):**
  - `index.html`: `Change persona` → **`Change lens`**; identity note "Your
    persona only orients you" → "Your **career lens** only orients you".
  - `main.js` creator: title `Choose your persona` → **`Choose your career lens`**;
    subtitle → "Your **career lens** orients you in the knowledge world and lights
    where you start."; `Create your own` → **`Build your own`**; `Author your
    persona` → **`Author your career lens`**; the author-form name **placeholder**
    `"Your persona"` (main.js ~639) → **`"Your career lens"`** (architect finding 1).
  - The companion greeting ("I am {name}, your guide through {domain}") already
    avoids the word; left as is.
  - **No internal identifier renamed** — `persona.js`, `activePersona`,
    `authorPersona`, `choosePersona`, CRDT keys all unchanged. In particular the
    `authorPersona` **default name** `"Your persona"` (persona.js) is **kept** —
    it is a value asserted by `authored.test.mjs`, so changing it is forbidden
    test churn (only the input *placeholder* changes).

### 2.6 `index.html` — Travel control + tutorial overlay

A `#travel-toggle` + `#tour` button in `.bar`; a `#travel` `<details>` panel
(`#travel-topic` select + Go); a `#tutorial` overlay (title, body, dots,
Back/Next/Got-it) styled like the existing overlays. The tutorial is a
**`position: fixed; inset: 0`** modal (mirrors `#setup`) with **`z-index: 30`**
— above both `#creator` (10) and `#setup` (20), so it fully covers and
intercepts input over the lens picker; dismissing it reveals the picker beneath
(architect findings 2 & 3).

## 3. Code outline

See §2 — two ~15-line pure modules + tests, ~10 lines of render, ~40 lines of
`main.js` wiring, ~20 lines of markup + a handful of copy edits. No Rust.

## 4. Non-goals

- No internal rename; no CRDT/root-key change; no GA/reachability change.
- No animated panning (snap-to-center); no coach-mark spotlight engine.
- No new domains, no learning-path/route feature (separate requirements).

## 5. Open questions (resolved here)

- Wording: "career lens" in the picker/button/author flow; the 5 tutorial steps
  above (§2.3).
- Tutorial before the picker (overlay above `#creator`, dismiss reveals it). §2.5.
- Travel via a `<select>` (consistent with bridge/marker forms); transient
  ~1.8 s focus ring. §2.5.

## 6. Acceptance criteria

Maps 1-to-1 to R-0019 AC:

- [x] AC1 — user-facing copy reads "career lens"/"lens"; internal identifiers +
      CRDT keys unchanged. *(Browser: picker "Choose your career lens", subtitle,
      "Build your own", "Author your career lens", name placeholder "Your career
      lens", "Change lens" button, note reads "career lens"; `id="change-persona"`
      + `persona`/`authorPersona` identifiers + `authorPersona` default "Your
      persona" all unchanged.)*
- [x] AC2 — Travel select (rebuilt on open) re-centers the map on the chosen
      topic; works lit or fogged. *(Browser: 8 topics listed; travelling to the
      FOGGED "Melody" + "Calculus" re-centred the camera — focus ring measured at
      the canvas centre.)*
- [x] AC3 — travelled-to topic gets a transient focus ring; travel mutates only
      the view (no reach/graph/persist change). *(Browser: ring pixels 28 right
      after travel, 4 once idle (~1.8 s lifetime); HUD "1/8 plateaus lit"
      identical before/after.)*
- [x] AC4 — first-run tutorial (stepped, remembered via localStorage); "Got it"
      dismisses + persists; "Tour" replays. *(Browser: shows on first run only
      (5 steps, Back disabled on step 0, Next→only "Got it" on last), "Got it"
      sets `mp.tutorialSeen` + reveals picker, reload skips it, "Tour" replays.)*
- [x] AC5 — `centerOn` unit-tested (centers under `project`); tutorial seen-gate
      unit-tested (fresh→show, seen→hide, throwing storage→no crash).
      *(`wayfinding.test.mjs` + `tutorial.test.mjs`, 9 cases.)*
- [x] AC6 — JS-only, additive; no Rust/wasm change; existing tests stay green.
      *(git: zero Rust/lock/wasm/pkg delta; 135 JS tests green incl. the prior
      126.)*
- [x] AC7 — all suites green; browser: tutorial first-run-only, copy renamed,
      Travel centers a topic, no uncaught console errors. *(node --test 135,
      cargo test --workspace 88, clippy host + wasm32, wasm-pack --node 8, fmt
      clean; preview console error-clean.)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | `centerOn` inverts the fixed projection; pure + tested | Travel is camera-only; the math is verifiable against project.js without a browser |
| 2026-06-04 | Tutorial = pure content + injected-storage seen-gate, replayable | Mirrors events.js's injected storage; local-only, off the CRDT, node-testable |
| 2026-06-04 | Rename is copy-only; internal `persona` vocabulary kept | Clearer to visitors with zero behavior change / test churn |
| 2026-06-04 | `VIEW` becomes mutable (`let`) | Travel re-origins the camera; the only state travel touches |

## Changelog

- 2026-06-04 created (Draft) — pending architect review, then Accepted.
- 2026-06-04 architect design review: **APPROVE-WITH-NITS, no blocking issues**
  (`centerOn` inversion verified empirically; travel confirmed camera-only; rename
  confirmed copy-only + test-safe; seen-gate sound). Folded: the author-form name
  **placeholder** "Your persona" → "Your career lens" (the `authorPersona` default
  stays — `authored.test.mjs` contract); `#tutorial` is `position:fixed; inset:0`
  with `z-index:30` (above `#creator` 10 + `#setup` 20). **Status → Accepted.**
- 2026-06-07 implemented in `apps/web` (wayfinding.js + tutorial.js + tests,
  render.js focus ring, main.js travel/tutorial wiring + copy renames, index.html
  Travel control + tutorial overlay + renames). All gates green (135 JS, 88 Rust,
  host+wasm32 clippy, wasm-pack 8, fmt) and browser-verified on the preview
  (first-run tutorial + replay, fogged-topic travel re-centres with a transient
  ring, reach unchanged, copy reads "career lens", console error-clean).
  **Status → Implemented.**
