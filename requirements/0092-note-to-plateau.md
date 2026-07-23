# R-0092 — ➕ Plateau from note: promote a private note into its own topic

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-23
- **Depends on:** R-0056 (private notepad), R-0079 (capture), R-0090 (openCaptureWith).
- **Source:** the owner: "on a topic how do I create a plateau from a private note, and those
  private notes shall stack up and I can create infinite."

## 1. Statement

The private notepad (R-0056) is a per-topic scratchpad. A **➕ Plateau from note** button now
turns whatever you've jotted into its **own plateau** (a new topic on the map): it opens ⚡
Capture prefilled with a **title from the note's first meaningful line** and the **note as the new
plateau's body**, with neighbour suggestions so you can wire it. It's **non-destructive** — the
note stays on the original topic — so you can keep jotting and spin off **as many plateaus as you
like** (each promotion is independent; there is no limit). Reuses the capture flow, so a promoted
note also auto-backs-up (R-0088) and lands in Review (R-0078) like any capture.

## 2. Acceptance criteria

- **AC1** — pure `titleFromNote`: the first non-empty line, stripped of leading heading/bullet
  marks + inline emphasis/backticks/image syntax, collapsed, capped at 60 chars; "" for a
  blank/whitespace/image-only note. Unit-tested. `openCaptureWith(name, note)` prefills the note.
- **AC2** — ➕ Plateau from note on the notepad: empty note → a hint (no-op); otherwise **search
  first** — if a plateau with the derived title already exists (exact-name match), just OPEN it
  (fly + open, no duplicate); otherwise open Capture prefilled with the title + note body +
  neighbour suggestions (the create-new flow).
- **AC3** — non-destructive (the source note remains) and repeatable without limit.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-23 created (Accepted) + implemented. Suite 579/579 (1 new titleFromNote test).
  Live-verified: a note "Bivector intuition\n\n…" promoted → Capture prefilled (name "Bivector
  intuition", note carried) → created a plateau with the note in its body; the original topic's
  note stayed intact; a second note "Reciprocal frames" promoted into a second plateau —
  non-destructive and repeatable.
- 2026-07-23 amended: **search-first-link** — a note whose first line names an EXISTING topic
  ("Bivectors: Oriented Planes") opened it directly (no duplicate); a new name ("Zorn's lemma
  detour") fell into the Capture create flow prefilled. Suite 579/579.
