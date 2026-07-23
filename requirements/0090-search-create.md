# R-0090 — didn't find it? create it: search → Capture hand-off

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-23
- **Depends on:** R-0072 (🔎 Find a topic), R-0079 (⚡ Capture a topic).
- **Source:** the owner: "if I don't find a topic, choose create it and create it."

## 1. Statement

When 🔎 Find a topic returns nothing, the empty-results state now offers a **➕ Create "<query>"**
button. Clicking it closes the search panel and opens **⚡ Capture** with the exact query
prefilled as the topic name, running the neighbour suggestions so it can be wired and created in
one screen. No dead end: a search that misses becomes the fastest path to making the topic.

## 2. Acceptance criteria

- **AC1** — a no-match search shows a **➕ Create "<query>"** button (query display-capped) beside
  the "No topic matches" line.
- **AC2** — clicking it hands off to Capture via `openCaptureWith(name)`: closes search, opens
  Capture, prefills the name, clears url/note, runs neighbour suggestions, focuses the note.
- **AC3** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-23 created (Accepted) + implemented. Suite 578/578 (UI wiring; pure logic unchanged).
  Live-verified: searching a nonexistent topic showed **➕ Create "…"**; clicking it closed search
  and opened Capture prefilled with the query; adding a note and hitting Capture created the
  plateau and opened it with the note in its body.
