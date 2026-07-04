# R-0044 — Rhizome drill-down: grow a nested plateau from any term

- **Status:** Draft
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-03
- **Depends on:** R-0011 (plateau authoring), R-0013 (bridge authoring), R-0020 (plateau content
  + read view), R-0023 (plateau-scoped companion), R-0007 (companion), R-0004/R-0012 (CRDT sync +
  durability). Composes existing primitives — no new core capability.
- **Realized by:** SPEC-0044 (pending) — **Slice 1 already implemented** (`rhizome.js` + wiring)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

While reading a plateau, a learner can **select an unfamiliar term and grow it into a new
plateau** — a durable, bridged, further-drillable node — rather than getting only a throwaway
dictionary gloss. Selecting a term offers: a quick inline **Define / Example** (through the
plateau-scoped companion, no graph change), and the rhizome move — **Grow a plateau**: a new
plateau named by the term, positioned next to its parent (same domain, small deterministic
offset), **bridged parent→child with the term as the bridge concept**, its body drafted by the
companion (or an honest starter stub when offline), then **opened so the learner can drill in and
grow again** — without end. Depth is unbounded: every grown plateau is itself a plateau you can
select-and-grow from.

## 2. Rationale

This is the project's namesake made literal. Deleuze & Guattari's rhizome is *connection and
multiplicity*: any point connects to any other, there is no fixed root/leaf hierarchy, and one may
enter and deepen anywhere. A dictionary popup is a dead-end leaf; a **new bridged plateau** is a
living node — it persists, syncs, can hold resources and be mastered, and can spawn its own
children. It answers the learner's real complaint ("there are words I don't know; I want to go as
deep as I want, not read a fixed page"): the world grows *under the reader's own hand*, exactly
where their curiosity catches, and the graph records the lineage as bridges.

## 3. Acceptance criteria

- **AC1 — Select-to-act.** Selecting text inside a plateau's rendered body surfaces an actionable
  menu at the selection with **Define**, **Example**, and **🌱 Grow a plateau**. A non-term
  selection (empty, a single char, a whole sentence, or > ~80 chars) surfaces nothing.

- **AC2 — Inline gloss (no graph change).** Define/Example route the term + parent context through
  the **same plateau-scoped companion turn** as the study actions (R-0023 trust boundary — the
  visitor's own endpoint, key in-browser). No plateau/bridge/event is created. Offline (no model),
  the learner is told to connect a model or grow the term instead.

- **AC3 — Grow creates a bridged child.** "Grow a plateau" creates a **new plateau** named by the
  selected term, in the **parent's domain**, positioned **near the parent** (small deterministic,
  term-derived offset; Grade-1 preserved), and a **bridge parent→child whose concept is the term**.
  Both are added via the existing `add_plateau`/`add_bridge` path (CRDT), then **broadcast +
  persisted** (pump/peer/persist) exactly like the authoring forms.

- **AC4 — Companion-drafted body, honest offline.** With a model connected, the child's body is a
  short companion-drafted explainer (definition + core idea + example + why-it-matters-here),
  grounded in the parent. Offline, the body is an **honest starter stub** naming the lineage — never
  a fabricated definition.

- **AC5 — Drill in, unbounded.** After growing, the child's read view **opens**, so the learner can
  read it, grow further terms from *it*, pin resources (R-0014), or master it (R-0030). Depth is
  unbounded; a grown plateau is indistinguishable from any other.

- **AC6 — Additive, web-only, pure core.** `apps/web/src` only — the placement/stub/prompt logic is
  a **pure, unit-tested** module (`rhizome.js`); no core/Rust/wasm/DTO change, garust untouched, no
  new runtime dependency. Existing suites stay green.

- **AC7 — Smoother reading.** The plateau read view (and companion log) scroll smoothly
  (`scroll-behavior`, momentum, contained overscroll) — the reading surface the drill-down lives in.

## 4. Constraints & non-goals

- **Reuses authoring primitives** — no new create path; a grown plateau/bridge is an ordinary
  plateau/bridge, so sync, durability, mastery, and rendering all apply for free.
- **Non-goals (follow-ups):** a touch/long-press trigger (Slice 1 is the desktop pointer path);
  a **preview-before-create** confirm step (Slice 1 creates immediately, then opens); a "**add
  resources**" selection action that pins companion-suggested links to the child; de-duplication
  when the same term is grown twice; a right-click OS context-menu variant.

## 5. Open questions

- **Create immediately vs preview.** Slice 1 grows on click then opens (fast, rhizomatic). A
  preview/confirm (editable name + drafted body) would curb accidental spawns — SPEC-0044 decides.
- **Placement vs the force-layout.** Children cluster near parents by construction; once the
  RFC-0003 `forceLayout` lands, verify grown clusters read well and don't overlap the parent.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-03 | Grow a **bridged plateau**, not a tooltip | The rhizome move — durable, drillable, masterable; the term becomes the bridge concept so the graph records the lineage |
| 2026-07-03 | Child inherits parent domain + small deterministic offset | Lands on the same island next to its parent; deterministic so re-growing is idempotent (no RNG in pure code) |
| 2026-07-03 | Offline body is an honest stub, never a fake definition | Trust: the app must not fabricate knowledge; a model drafts, or the learner writes |
| 2026-07-03 | Ship Slice 1 (create-then-open) ahead of the full spec | The vision is clear and composes from existing primitives; a working slice validates the interaction |

## Changelog

- 2026-07-03 created (Draft) — select-a-term → grow a nested, bridged, drillable plateau (rhizome
  learning); inline Define/Example; companion-drafted or honest-stub body; smoother read-view scroll.
  Slice 1 implemented (`rhizome.js` + `main.js`/`index.html` wiring, `rhizome.test.mjs`); pending
  SPEC-0044 + architect review for the preview/touch/add-resources follow-ups.
