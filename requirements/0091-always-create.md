# R-0091 — always offer ➕ Create in search (fix R-0090)

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-23
- **Depends on:** R-0090 (search → create), R-0072 (search), R-0079 (capture).
- **Source:** the owner: "it's none of these, can't find create" — the search returned partial
  matches (so the zero-results branch never ran) and none was the wanted topic, leaving no create
  path.

## 1. Statement

R-0090 only showed the **➕ Create** button when a search returned **zero** results. But the
common case is a search that returns *partial* matches, none of which is the topic you mean —
and there the button never appeared, trapping you. Now the create affordance appears in **both**
states: below a "None of these?" line after real results, and in the no-match state as before.
A search is never a dead end regardless of how many things it half-matches.

## 2. Acceptance criteria

- **AC1** — a search that returns results shows, below them, a "None of these?" line and a
  **➕ Create "<query>"** button that hands off to ⚡ Capture (prefilled) via `openCaptureWith`.
- **AC2** — the no-match state is unchanged (still shows the message + Create button).
- **AC3** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-23 created (Accepted) + fixed. Suite 578/578. Live-verified: searching "product"
  returned **20 matches** AND showed **"None of these? ➕ Create "product""** below them; clicking
  it opened Capture prefilled with "product".
