# R-0073 — Hand-offs that carry context + 🎯 walk me through the deliverable

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Created:** 2026-07-20
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0056 (the hand-off targets this upgrades), and every hand-off consumer —
  R-0060 (lesson steps), R-0061 (course syllabus), R-0069 (where-fits), R-0070 (prereq plan),
  R-0071 (rabbit holes) — which all gain the context-carrying open.
- **Realized by:** direct implementation — `handoffOpenUrl` + a Gemini `prefill` in `handoff.js`,
  applied at all six hand-off click sites; a pure `deliverable.js` (extract + tutor prompt) + a
  🎯 row in the detail panel.
- **Source:** the owner, using the app: "the Gemini or NotebookLM links on show-me-slowly do not
  give context — it just opens the link, not the topic on that platform" and "shows a deliverable
  but does not help me if I don't know how to do it."

## 1. Statement

Two fixes to make the hand-off loop actually land:

1. **The prompt rides the URL when the platform allows it.** `gemini.google.com` accepts no prompt
   parameter — so every "Gemini ↗" click opened a blank tab and relied on a clipboard paste the
   learner never saw. The Gemini target now carries the prompt **in the URL** via Google AI Mode
   (`google.com/search?udm=50&q=<prompt>`): the tab opens **with the question already asked**.
   Prompts too long for a URL (> `PREFILL_MAX` = 1800 chars, e.g. the full-topic-list prompts) and
   targets with no parameter (NotebookLM, AI Studio) fall back to the clipboard — with a **loud,
   explicit** status: "Copied ✓ — click the chat box and press Cmd/Ctrl+V."
2. **🎯 Walk me through the deliverable.** Every curriculum body ends in a **Deliverable:** — a task,
   not a lesson. When a topic has one, a 🎯 row hands it to the model **as a tutor**: restate the
   goal, break it into the smallest steps, hint before answer on each, full worked solution only at
   the end, then one similar practice problem. The coach prompt fits the Gemini prefill, so that tab
   opens mid-conversation, waiting for the learner's first attempt.

## 2. Rationale

The hand-off pattern ($0, no key, no API flakiness) is the app's chosen delivery for model help —
but its weakest link was the invisible clipboard step: the learner clicked "Gemini ↗", saw a blank
chat, and concluded the feature was broken. Carrying the prompt in the URL removes the step entirely
where possible, and where impossible the message now says exactly what to press. And the Deliverable
line — the pedagogical closer of every topic — was an unsupported cliff for anyone who didn't
already know how to do it; the tutor hand-off turns it from a statement of the gap into a guided
climb across it.

## 3. Acceptance criteria

- **AC1 — Prefilled Gemini.** For prompts ≤ 1800 chars, every hand-off's Gemini button opens Google
  AI Mode with the full prompt URL-encoded in `q=` — sentence rabbit holes (R-0071), lesson steps
  (R-0060), the prereq plan (R-0070), the course syllabus request (R-0061), the per-topic hand-off
  (R-0056), and the 🎯 coach all included.
- **AC2 — Honest fallback.** Longer prompts and non-prefill targets open the base URL with the
  prompt on the clipboard, and the status says explicitly to press Cmd/Ctrl+V; a blocked clipboard is
  reported, never silent. Truncating a prompt to force it into a URL is never done.
- **AC3 — 🎯 Deliverable coach.** A topic whose body carries `**Deliverable:**` shows the 🎯 row;
  clicking a target hands over a tutor-style prompt (smallest steps, hints first, worked solution
  last, one practice problem); topics without a deliverable show no row; hidden in the bridge view.
- **AC4 — Pure + additive + tested.** `handoffOpenUrl`/`PREFILL_MAX` (handoff.js) and
  `extractDeliverable`/`deliverableCoachPrompt` (deliverable.js) are pure with `node --test`;
  `apps/web` only; no core/Rust/wasm change; no new dependency.

## 4. Constraints & non-goals

- **No truncated prefill** — a cut-off instruction is worse than a paste; the length gate is a hard
  fallback, not a trim.
- **NotebookLM stays paste-based** — no prompt-URL parameter exists; the pack flow (R-0056) is
  unchanged beyond the clearer message.
- **Non-goals (follow-ups):** an in-panel "preview the prompt" expander; AI Studio prefill (no
  stable parameter today); auto-detecting a failed paste.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-20 | Gemini prefill via Google AI Mode (`udm=50&q=`) rather than gemini.google.com | The chat app has no prompt parameter; AI Mode is the same Gemini answering WITH the query carried — the only true context-carrying open available. |
| 2026-07-20 | Fall back (never truncate) past 1800 chars | URL limits are real; cutting the topic-list or instructions mid-sentence corrupts the ask. Clipboard already works for big prompts — the fix there is the explicit Cmd/Ctrl+V message. |
| 2026-07-20 | One shared `handoffOpenUrl` applied at every click site | Six features share the hand-off; fixing the pattern once fixes them all, and future targets that gain parameters only need a `prefill` field. |

## Changelog

- 2026-07-20 created (Accepted) + implemented — Gemini hand-offs now open with the question already
  asked (AI-Mode prefill ≤1800 chars; loud Cmd/Ctrl+V fallback otherwise) across all six hand-off
  features, and topics with a **Deliverable:** gained the 🎯 tutor walkthrough row. Pure
  `handoffOpenUrl` + `deliverable.js` with 4 `node --test` cases (full suite 528/528).
  Live-verified on *The Geometric Product*: the 🎯 row rendered; its Gemini click and a 🐇
  explain-slowly Gemini click both opened `google.com/search?udm=50&q=I'm studying "The Geometric
  Product"…` (prompt in the URL); NotebookLM opened its base URL with the explicit fallback note.
