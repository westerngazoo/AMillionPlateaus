# R-0059 — Declutter the top toolbar into a hamburger menu

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-15
- **Depends on:** everything that put a button in the top bar (R-0011/R-0013 authoring, R-0007 model
  setup, R-0010 relay, R-0019 tour, R-0024 legend, R-0049 local⇄hosted flip, …).
- **Realized by:** direct implementation (index.html restructure + CSS + a small toggle in main.js).
- **Source:** the owner: "re arrange menus to take less space … the top menu shall be like a
  hamburger menu or something less chaotic."

## 1. Statement

Collapse the top of the app — a **15-button toolbar** plus a **second identity/relay row** — into
**one compact bar**: a **☰ Menu** hamburger, the world HUD (persona · counts), and the identity +
relay status. The actions move into a **grouped dropdown** (Navigate / Create / Companion / World &
peers / Relay / Help & reset) that floats over the canvas and closes on action, outside-click, or
Escape.

## 2. Rationale

Two dense rows of buttons is the first thing a learner sees and the least legible part of the app —
it reads as a control panel, not a place to study. On a phone/Boox it wraps into a wall. One tidy
line + a discoverable menu gives the map back its space and groups actions by intent, and it clears
room for the study/course features to come (R-0060+).

## 3. Acceptance criteria

- **AC1 — One compact bar.** The top bar shows only: **☰ Menu**, `#hud`, and the identity/relay
  status chips. The old 15 action buttons and the relay URL input no longer sit on the bar.
- **AC2 — Grouped dropdown.** ☰ opens a panel grouping every prior action under labelled headings;
  it floats (absolute) over the canvas and never reflows the map.
- **AC3 — Behaviour preserved.** Every action button keeps its **id**, so its existing `main.js`
  listener fires unchanged. Clicking an action both runs it AND closes the menu. `model-flip`
  (R-0049) still shows/hides by the same id.
- **AC4 — Dismissal.** The menu closes on outside-click and Escape; the toggle carries
  `aria-expanded`/`aria-controls`. Typing in the relay input does NOT close the menu.
- **AC5 — Additive, web-only.** `apps/web` only; no core/Rust/wasm change; no new dependency; the
  dangling-import guard stays green.

## 4. Constraints & non-goals

- **No behaviour change to the actions themselves** — this is packaging only (ids, listeners, panels
  are untouched).
- **Non-goals:** a full nav redesign, a persistent sidebar, per-action keyboard shortcuts, reordering
  the study drawer (a separate pass), or moving the zoom controls.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-15 | One hamburger with grouped sections, not several dropdown menus | Owner asked for "a hamburger or something less chaotic"; one entry point is the least busy and the most phone-friendly. |
| 2026-07-15 | Keep the identity + relay STATUS on the bar; move the relay URL input into the menu | The status chips are glanceable; the URL input is a rare, setup-time action that belongs behind the menu. |
| 2026-07-15 | Keep every button id; move the elements, not the wiring | Zero-risk: no listener re-registration, no behaviour drift — pure repackaging. |

## Changelog

- 2026-07-15 created (Accepted) + implemented — hamburger + grouped dropdown; two bars → one.
  Live-verified: open/close, `aria-expanded`, action-fires-and-closes, outside-click/Escape, no
  console errors.
