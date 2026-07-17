# R-0069 — "Where does this fit?" (route a resource to its topics)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0056 (the NotebookLM/Gemini hand-off it rides), R-0061 (the paste-back-and-parse
  pattern it mirrors), R-0023 (`doc.add_resource` — per-topic resource pinning), R-0028 (cross-cutting
  resources threaded by URL — a resource pinned to several topics shows "Also covers …" for free).
- **Realized by:** direct implementation — a pure `where-fits.js` (prompt builder + name→id matcher)
  + a "Where does this fit?" panel in the ☰ menu, driven by main.js.
- **Source:** the owner: "there might be diff approaches to learning the same topic … I'm following a
  YouTube channel and might be missing some info … paste a YouTube video and get related topics and
  pin it to a topic." Confirmed via AskUserQuestion: **matching by hand-off to NotebookLM/Gemini**,
  scoped across **all topics**.

## 1. Statement

**📌 Where does this fit?** — paste a resource you're studying from (a YouTube video, an article),
**hand it to NotebookLM/Gemini together with your full topic list**, paste back the topic names it
lists, and **pin the resource to the matched topics** with one tap. A single video can land on
several topics at once (e.g. a GA lecture on *Rotors* AND *Spinors* AND *Maxwell*); pinning to more
than one automatically makes it a cross-cutting resource (R-0028).

Four steps in the panel: (1) enter the URL/title/kind and open the hand-off; (2) paste the topic
names the model returned; (3) the app resolves them to real topics and shows a checklist; (4) pin to
the ones you keep ticked.

## 2. Rationale

The app's curricula are one spine, but a learner brings their own sources — a favourite channel, a
paper — and wants to hang that material on the right topic, sometimes across several. Pinning a
resource to ONE topic already worked (R-0023), but you had to know which topic, and a resource that
spans three meant three manual visits. The routing — "which of MY topics does this resource cover?" —
is the missing move, and the model is the right tool to read a dense video and answer it. Doing it
through the hand-off keeps it $0 / no-key (the owner's standing preference) and reuses the exact
copy-prompt-then-paste-back loop the course builder already established.

## 3. Acceptance criteria

- **AC1 — Hand-off with the topic list.** Given a resource (URL + optional title + kind), the panel
  offers NotebookLM / Gemini / AI Studio buttons; each copies a prompt that includes the resource and
  the **full topic list grouped by lens**, asking which topics it covers with EXACT names, and opens
  the tool (nothing sent automatically).
- **AC2 — Resolve the answer.** Pasting the model's reply (topic names, one per line) resolves them to
  real topics — tolerant of list markers/quotes and punctuation drift, matching on a normalized name
  (exact, then a UNIQUE substring); names that don't resolve are reported back, never silently
  dropped, and never invented.
- **AC3 — Pin to the chosen topics.** Matched topics show as a checklist (all ticked); "Pin" adds the
  resource (title/URL/kind) to each ticked topic via `doc.add_resource`. Pinning to ≥2 topics yields a
  cross-cutting resource (R-0028) — the same URL shows "Also covers …" on each.
- **AC4 — Re-openable + graceful.** The panel is in the ☰ Create group, toggles open/closed, starts
  hidden (a `[hidden]` guard so its flex layout can't leak), needs a URL before pinning, and a
  no-match paste degrades to a clear message.
- **AC5 — Pure + additive + tested + model-free at the edge.** `where-fits.js` (prompt + matcher) is
  pure/deterministic with `node --test`; `apps/web` only; no core/Rust/wasm change; no new dependency;
  the model work is the hand-off (no in-app model dependency).

## 4. Constraints & non-goals

- **The model reads the resource, not the app** — no transcript fetch / oEmbed; the video goes into
  NotebookLM/Gemini as a source and the app only routes the answer. Consistent with offline-first.
- **Pins are shared resources** (grow-only, synced), like any R-0023 resource. For personal-only
  material the private shelf (R-0052) / notepad (R-0056) remain the local option.
- **Non-goals (follow-ups):** an offline relevance-match alternative (the "both" option not chosen);
  a "pin to private shelf" toggle from this panel; ranking/ordering the suggested topics; editing or
  un-pinning from here (open the topic to manage its resources).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Match via the hand-off, not an offline keyword heuristic | Owner's choice; a model can actually read a dense video and pick the right topics, and it reuses the $0/no-key hand-off already shipped. |
| 2026-07-16 | Constrain the prompt to the EXACT topic names + resolve by normalized match | Makes the pasted answer resolve cleanly to real plateaus; unmatched names are surfaced, not guessed. |
| 2026-07-16 | Pin as normal (shared) resources; multi-pin ⇒ cross-cutting | Reuses `doc.add_resource` + R-0028 threading with no new machinery; a spanning video correctly appears on every topic it covers. |

## Changelog

- 2026-07-16 created (Accepted) + implemented — 📌 Where does this fit?: paste a resource → hand-off
  to NotebookLM/Gemini with the full topic list → paste the topic names back → matched to real
  topics (checklist) → pinned to the selected ones (`doc.add_resource`), multi-pin threading into a
  cross-cutting resource. Pure `where-fits.js` with 5 `node --test` cases (full suite 508/508).
  Live-verified: pasted a mock answer (Rotors + Spinors + a bogus name) → matched the two real GA
  topics, reported the bogus one unmatched → pinned to both → the video appears under *Rotors* with
  "Also covers: Pauli Algebra & Spinors"; no console errors.
