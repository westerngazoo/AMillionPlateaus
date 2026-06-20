# R-0019 — Onboarding & wayfinding: career lens, travel, first-run tutorial

- **Status:** Met
- **Milestone:** POC — UX clarity
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** R-0005 (fog-world + render/projection), R-0006/R-0009 (persona/lens), R-0011 (plateaus to travel to)
- **Realized by:** SPEC-0019 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The world is powerful but opaque to a newcomer: the word "persona" is jargon, a
visitor lands in a fogged map with no explanation, and there's no way to focus on
a specific topic. This requirement makes first contact **legible** with three
plain-language UX changes:

1. **Rename "persona" → "career lens"** in everything the visitor reads — it
   frames the choice as *"which way does my career/curiosity face?"* The internal
   code keeps its accurate `persona` vocabulary; only user-facing copy changes.
2. **A "Travel" control** to focus the map on a specific topic (a plateau /
   island): pick a topic by name and the camera centers on it, briefly
   highlighting it — pure wayfinding, it changes nothing about reach or the graph.
3. **A first-run tutorial** that, the first time anyone enters, walks them through
   what the world is (topics, bridges, the career lens, the fog, exploring,
   drafting, travelling) and is then remembered so returning visitors skip it,
   with a way to replay it.

## 2. Rationale

Three of the four things a newcomer needs are missing: a word they understand
("career lens" not "persona"), an orientation to the world (the tutorial), and a
way to get somewhere specific (travel). None require new GA/CRDT machinery — they
are copy, a pure centering calculation over the existing projection, and a small
remembered overlay. This is the cheapest, highest-leverage step toward the thing
the owner asked for: *"how could I start interacting … see a path."* It turns the
existing depth into something a physics student (or anyone) can walk into.

## 3. Acceptance criteria

- **AC1 — "Career lens" everywhere the visitor reads.** All user-facing copy that
  said "persona" reads **"career lens"** (or "lens" where brevity helps): the
  picker title/subtitle, the "Change lens" toolbar button, the author-your-own
  flow, the identity note, and the companion's framing. **Internal identifiers
  are unchanged** (`persona.js`, `activePersona`, `authorPersona`, the CRDT root
  keys) — this is a copy change with **no behavior change** and no test churn.

- **AC2 — Travel focuses the map on a chosen topic.** A **"Travel"** control lists
  **every** topic by name (rebuilt from the current graph when opened) and, on
  choosing one, re-centers the map so that topic sits at the canvas center. It
  works for **lit or fogged** topics — travel is camera focus, not reachability.

- **AC3 — Travel highlights, and changes nothing else.** The travelled-to topic is
  briefly **highlighted** (a focus ring) so the eye finds it. Travel mutates only
  the camera (the view origin); it does **not** change reachability/fog, the
  graph, reputation, or anything synced/persisted.

- **AC4 — First-run tutorial.** On a visitor's **first** entry (no prior
  "seen" flag), a short, stepped **welcome** explains the world — topics/islands,
  bridges, the career lens, the fog (reach is earned), exploring by clicking lit
  topics, drafting your own, and Travel. A **"Got it"** dismisses it and
  **remembers** (local only), so returning visitors go straight in. A **"Tour"**
  (or "?") affordance **replays** it on demand.

- **AC5 — Pure, tested units.** The travel-centering math is a **pure** function —
  `centerOn(position, { width, height }, scale) → { cx, cy }` — **unit-tested**:
  centering a position lands it at the canvas center under the existing
  projection; deterministic. The tutorial's seen-gate is a **pure** function over
  injected storage — first run shows, after "seen" it hides, replay forces show —
  **unit-tested** without a browser.

- **AC6 — Additive, JS-only, no regressions.** No Rust/wasm change; the rename is
  copy-only (no renamed identifiers, no CRDT/root-key change); the fog/reachability
  math, authoring, sync, persistence, and presence are untouched. All existing
  tests stay green.

- **AC7 — Green + browser-verified.** `node --test apps/web/src/*.test.mjs`,
  `cargo test --workspace`, `wasm-pack test --node`, clippy `-D warnings`
  (host + `wasm32`), and `cargo fmt --all --check` all green; on the page, the
  tutorial shows on first run (and not after), the copy reads "career lens", and
  Travel centers a chosen topic — with **no uncaught console errors**.

## 4. Constraints & non-goals

- **Copy-only rename.** Do not rename internal modules/symbols (`persona.js`,
  `authorPersona`, `activePersona`) or CRDT keys — only visible strings. This
  keeps the audited code + tests intact.
- **Travel is camera-only.** It sets the view origin and highlights; it must not
  touch reachability, the event log, the CRDT, or persistence.
- **Tutorial is content, not a coach-mark engine.** A simple stepped overlay with
  remembered dismissal — no DOM-anchored spotlight tour, no analytics.
- **Local-only memory.** The "tutorial seen" flag is `localStorage`, never synced
  or in the CRDT.
- **Non-goals:** smooth animated panning/zoom (a snap-to-center is sufficient;
  easing is a nice-to-have, not required); adding new domains (the separate
  Physics-domain work); the learning-path/route feature (separate); restyling the
  whole UI.

## 5. Open questions

- **Exact wording.** "Career lens" vs. "lens" per spot; the tutorial's 4–5 step
  copy. Spec drafts it; cosmetic.
- **Tutorial timing.** Show the tutorial **before** the lens picker (welcome →
  then choose), vs. layered over it. Leans before.
- **Travel affordance.** A toolbar button opening a topic `<select>` vs. a
  type-ahead. Leans select (consistent with the bridge/marker forms).
- **Focus-ring lifetime.** Transient (fades after ~1.5 s) vs. sticky until the
  next travel. Spec decides; cosmetic.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Rename is user-facing copy only; internal `persona` vocabulary stays | "Career lens" is clearer to a visitor; renaming audited code/keys is churn + risk for zero behavior gain |
| 2026-06-04 | Travel = re-center the camera via a pure `centerOn` over the existing projection | Wayfinding without touching reachability; the centering math is unit-testable like project.js |
| 2026-06-04 | Tutorial is a remembered stepped overlay (localStorage), replayable | Cheapest legible onboarding; local-only memory keeps it off the CRDT |

## Changelog

- 2026-06-04 created (Draft) — pending SPEC-0019 + architect design review, then acceptance.
- 2026-06-04 SPEC-0019 drafted + architect-reviewed (APPROVE-WITH-NITS, no blocking;
  centerOn verified, copy-only rename confirmed test-safe; nits folded). **Status → Accepted.**
- 2026-06-07 QA sign-off **PASS** (qa agent). All 7 AC verified against code + tests.
  Gates: `node --test apps/web/src/*.test.mjs` 135 pass / 0 fail (126 prior + 9 new
  across wayfinding/tutorial); `cargo test --workspace` 88 pass / 0 fail (unchanged);
  `cargo fmt --all --check` clean; host clippy `-D warnings` clean (exit 0); wasm32
  clippy `-D warnings` clean (exit 0, rustup stable toolchain); `wasm-pack test --node`
  8 pass / 0 fail. AC1 copy-only rename confirmed (user-facing "career lens"/"lens"
  everywhere; internal `persona.js`/`activePersona`/`authorPersona`/`choosePersona`/
  `id="change-persona"` + the `authorPersona` default name "Your persona" + CRDT root
  keys `[bridges, plateaus, resources, votes]` all unchanged). AC2/AC3: `centerOn`
  unit-tested against the REAL `project`; travel-submit mutates only `VIEW.cx/cy` +
  transient `focusedId` (setTimeout-cleared) + `draw()` — no sync/persist/reputation
  touch. AC4/AC5: tutorial seen-gate pure + unit-tested (fresh→show, seen→hide,
  throwing-storage→no-crash); shown on `shouldShowTutorial` at load, "Got it"→
  `markTutorialSeen`, "Tour" replays unconditionally. AC6: zero Rust/lock/wasm/pkg
  delta (diff = index.html + main.js + render.js + 4 new JS files). AC7: all suites
  green; manual browser portion taken from accepted-spec §6 evidence. **Status → Met.**
