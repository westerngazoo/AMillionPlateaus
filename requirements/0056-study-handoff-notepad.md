# R-0056 — Study without the API: hand off to NotebookLM/Gemini + a private notepad

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-13
- **Depends on:** R-0023 (study view), R-0048 (deep-study prompt patterns — same graph-grounding),
  R-0052 (private shelf — the same this-browser-only trust boundary), R-0020 (Markdown + KaTeX
  render). Composes existing primitives; no model API.
- **Realized by:** direct implementation (two pure modules `handoff.js` + `private-notes.js` +
  study-view wiring; no core/Rust/wasm change).
- **Source:** the owner: the bring-your-own model kept failing (404 retired id, 503 overload) —
  "i rather do a flow where i can just pwa the app and query gemini or notebooklm directly in a new
  tab and come back"; plus "put a small text md editor that i can locally store under my private
  notes"; plus the owner's own 9-step NotebookLM prompt strategy, to be saved and reused per topic.

## 1. Statement

Two additions to the study view that let a learner study a topic **without depending on the
in-app model endpoint** (which can 404/401/503 at any moment, none of it the learner's fault):

1. **Hand-off ↗** — per-topic buttons (NotebookLM, Gemini, AI Studio) that build a graph-grounded
   prompt, **copy it to the clipboard, and open the tool in a new tab**. The learner pastes, works
   there on the subscription they already have, and comes back. NotebookLM receives the owner's
   full **study pack** (a 9-step strategy: mental models → disagreements → deep comprehension →
   evaluate → hidden connections → gap map → executive report → slides → podcast, + applied
   practice + Feynman), topic-parameterized; Gemini/AI Studio receive a single-topic tutor prompt.
2. **Private notepad** — a per-topic **Markdown** scratch note, stored in **this browser only**
   (never synced, never in the CRDT), with live preview (Markdown + KaTeX) and autosave.

## 2. Rationale

The hosted-model path is the one fragile, cost-bearing, occasionally-broken link in an otherwise
$0/offline app. Rather than keep hardening an adapter against a moving Google endpoint, this gives
the learner a **reliable escape hatch**: the app does what it's uniquely good at — hold the
knowledge graph and compose a grounded prompt from it — then hands off to the mature tools the
learner already pays nothing extra for. NotebookLM has no query-URL API, so "copy the prompt, then
open the tab" is the honest pattern. The notepad closes the other half: somewhere private and local
to think in Markdown against a topic, next to the private shelf.

## 3. Acceptance criteria

- **AC1 — Hand-off opens the tool + copies a grounded prompt.** Each target button opens its tool
  in a new tab (`noopener`) and copies a prompt built from THIS plateau (name, domain, notes,
  bridged neighbors). NotebookLM gets the full pack; Gemini/AI Studio get the single-topic prompt.
  Nothing is sent automatically — the learner pastes.
- **AC2 — The pack is the owner's strategy, topic-general.** The NotebookLM pack reproduces the
  owner's 9 steps + 2 extras, parameterized by topic + domain, with the original finance/Spain
  specifics removed so it fits any plateau. It is one ordered, pasteable document with a how-to
  header.
- **AC3 — Honest degradation.** If the clipboard is blocked (permission/insecure context), the tool
  still opens and the UI says so (retype your question there) — never a silent failure.
- **AC4 — Private notepad, local only.** A Markdown textarea per topic, seeded from storage on open,
  autosaved (~400 ms debounce) to `localStorage` under `mp.privateNotes`, with a Preview toggle
  rendering Markdown + KaTeX. An emptied note deletes its key (no blank accumulation). Switching
  topics never writes one topic's text into another's (the pending save is keyed to the topic that
  was active when edited).
- **AC5 — Same trust boundary.** The notepad is never synced, never in the CRDT, never on any
  channel — same posture as the private shelf (R-0052) and model config. The hand-off sends nothing
  itself; the learner's data only leaves when they paste it into a tool they chose.
- **AC6 — Pure + additive + tested.** `handoff.js` (targets, `handoffPrompt`, `notebookLmPack`) and
  `private-notes.js` (load/save/get/set) are pure, deterministic exports with `node --test` unit
  tests. `apps/web/src` only; no core/Rust/wasm change; no new runtime dependency.

## 4. Constraints & non-goals

- **No query-URL injection.** NotebookLM/Gemini web have no prompt-in-URL param; copy-then-open is
  the only honest mechanism. Not a bug — stated in the UI.
- **Non-goals:** an in-app NotebookLM (no public API); auto-detecting when the pasted answer comes
  back (the learner brings it back manually, e.g. into the notepad or a resource); syncing the
  notepad; translating the pack (kept in the owner's working language, editable after paste).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-13 | Hand off to the tool instead of hardening the in-app API | The endpoint's 404/401/503 are outside our control; the learner already has NotebookLM/Gemini — compose the prompt, let them run it there |
| 2026-07-13 | NotebookLM gets the full pack; Gemini/AI Studio get one prompt | NotebookLM works on sources you add + a chat — the multi-step pack fits it; a plain chat wants one focused prompt |
| 2026-07-13 | Generalize the owner's finance/Spain pack to any topic | The 9-step STRUCTURE is universal; the finance/Spain specifics were examples — substitute topic + domain, drop the rest |
| 2026-07-13 | Notepad in localStorage, not the CRDT | It's a private desk, not shared world state — same boundary as the private shelf (R-0052) |

## Changelog

- 2026-07-13 created (Accepted) + implemented — per-topic hand-off (NotebookLM full pack / Gemini
  single prompt / AI Studio) that copies a graph-grounded prompt and opens the tool in a new tab,
  and a private per-topic Markdown notepad (localStorage, autosave, KaTeX preview). Sidesteps the
  flaky model API entirely. Web-only, no key, no new dependency.
