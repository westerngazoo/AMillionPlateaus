# R-0079 — ⚡ Capture a topic: quick-add a plateau and wire it into the graph

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-21
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0011 (plateau authoring), R-0013 (bridges), R-0023 (resources),
  R-0072 (topic matching), R-0078 (review queue, for reassess + enrol).
- **Source:** the owner: "sometimes I remember I need to reassess my trig, or I encounter an
  equation like the law of cosines I want to derive — I search YouTube and start studying. I may
  not know how it connects to other plateaus, but it's definitely something I want wired into my
  knowledge graph."

## 1. Statement

Study starts from a standing start — a YouTube video, "I should reassess my trig" — not inside a
curriculum. **⚡ Capture a topic** (a Create-menu entry) turns that into a plateau in ~30 seconds:
you name it, optionally paste the reference you're studying and a first note, and on **Capture →**
a real plateau is created — the reference pinned as its first resource, the note as its body,
enrolled in 📅 Review (due now, because you grabbed it to study it).

Capture proposes **where it belongs** without forcing it: as you type, it flags an **exact
duplicate** (open it, don't fork it) and suggests the closest existing topics. Matching is
deliberately **OR-semantic** (unlike 🔎 Find's AND): a captured topic's name rarely appears in its
neighbours ("law of cosines" shares no word with "Vectors"), so the connection lives in the words
you typed — a note about "the dot product of two vectors" surfaces the Vectors/Dot-Product
plateaus. You **tick** the neighbours that fit; each becomes a **bridge**, and the new plateau is
**placed near them** (centroid of their Grade-1 positions + a deterministic nudge), landing on the
right island instead of nowhere. Tick nothing and it goes to the **📥 Unwired inbox** (a
menu entry + count) so nothing you grabbed is ever lost — the inbox auto-clears an entry the
moment it gains any bridge, however wired. A **🔁 Also drop these into Review** button covers the
"reassess my trig" half: it forces the ticked (or all suggested) existing topics due now.

Offline, no model required. Placement/suggestion/dedup math is the pure `capture.js` module.

## 2. Acceptance criteria

- **AC1** — pure module (`capture.js`): `exactMatch` (normalised name equality), `suggestNeighbors`
  (OR-semantic, name×3/body×1, plural-forgiving, self + zero-score excluded, capped),
  `placeNear` (neighbour centroid + deterministic name-hash nudge ≤0.06/axis; no neighbours →
  fallback anchor; NaN positions dropped), `dominantDomain`, `resourceKindFor` (YouTube/Vimeo →
  Video, other http(s) → Article, else null), `captureBody`, `unwiredIds`. No `Date.now()`.
  Unit-tested. `review-queue.js` gains `enrollDue` (force a topic due now, keeping SM-2 stats,
  bypassing the daily-new cap).
- **AC2** — ⚡ Capture panel: name (≥3 chars) + optional reference URL + optional Markdown note;
  live dedup notice; live neighbour chips (tick to wire); **Capture →** creates the plateau,
  bridges each ticked neighbour, pins a link reference by kind, places near neighbours (else the
  domain anchor), files under the busiest ticked lens (else the active persona's), enrols it in
  Review, syncs/persists, and flies to it. A dedup click opens the existing topic instead.
- **AC3** — 📥 Unwired inbox lists captured topics with zero bridges (menu count included),
  auto-clears once wired, prunes deleted plateaus; **🔁 Also drop these into Review** forces the
  chosen/all suggested existing topics due now.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-21 created (Accepted) + implemented. Suite 553/553 (9 capture tests + 1 enrollDue test).
  Live-verified end-to-end: "Law of cosines (derivation)" + note "derive from the dot product of
  two vectors" surfaced Geometric Product / Vector Derivative / Newton's Laws etc. (OR match on
  the note); ticking two created the plateau bridged to both, YouTube link pinned as a Video,
  body carrying the note, enrolled in Review, flown to; an unrelated name went to 📥 Unwired — 1;
  the dedup path opened the existing Geometric Product; 🔁 reassess dropped 6 topics into Review
  (2 → 8 due). Found-and-fixed a CSS specificity clash (`.course-builder input { width:100% }`
  inflating the neighbour checkboxes).
