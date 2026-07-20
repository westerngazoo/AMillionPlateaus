# R-0072 — 🔎 Find a topic (keyword search across every lens)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-20
- **Depends on:** R-0065–R-0068 (the seeded multi-lens curricula being searched), R-0020 (bodies as
  Markdown — snippets are md-stripped), R-0024 (`flyTo`), R-0019 (Travel — which stays camera-only).
- **Realized by:** direct implementation — a pure `topic-search.js` (ranked keyword search + lens
  grouping) + a "Find a topic" panel in the ☰ Navigate group, driven by main.js.
- **Source:** the owner: "if I am reading a book and it's about system config and degrees of freedom,
  can I look for that topic and choose one from all available lenses?"

## 1. Statement

**🔎 Find a topic** (☰ menu → Navigate): type a phrase from whatever you're reading — *"degrees of
freedom"* — and every topic whose **name or body** matches appears, **grouped by lens**, each with an
md-stripped snippet showing *why* it matched. One concept, several doors: the Physics treatment next
to the Geometric-Algebra one next to the Classical-Foundations one — tap the lens you want to enter
through and the map flies there and opens it. Offline, no model — plain text search over the seeded +
authored world.

## 2. Rationale

Travel (R-0019) navigates by exact name in a `<select>` — fine when you know the topic, useless when
you know only the *concept* from a book. The curricula gave every lens deep bodies (R-0066–R-0068),
which makes body-text search genuinely informative: "degrees of freedom" isn't in any topic *name*,
but it's in the Classical Mechanics and Mathematical Methods bodies. Grouping by lens is the point —
the same idea taught three ways is this app's core thesis, and the search is where a reader standing
outside the map finds their door in.

## 3. Acceptance criteria

- **AC1 — Name + body search, AND semantics.** Every query word (≥3 chars) must appear in the topic's
  name+body combined; word matching is plural-forgiving ("degrees" finds "degree of freedom").
  Sub-3-char noise words ("of") are ignored.
- **AC2 — Ranking + snippets.** Whole-phrase-in-name ranks highest, then per-word name hits, then body
  hits; each body match carries an md-stripped snippet (±context around the first hit) so the learner
  sees why it matched; name-only hits carry none. Results are capped and deterministic.
- **AC3 — Grouped by lens, choose a door.** Results render grouped by lens label (strongest lens
  first, rank preserved within); tapping a result flies to and opens that plateau and closes the
  panel. Authored/custom-domain topics group under their own label.
- **AC4 — Live + graceful.** Results update as you type (debounced); a no-match query says so and
  points at 🎓 Build a course; queries under 3 characters show nothing; the panel starts hidden
  (`[hidden]` guard) and is re-openable.
- **AC5 — Pure + additive + tested + offline.** `topic-search.js` (`searchTopics` + `groupByLens`) is
  pure/deterministic with `node --test`; `apps/web` only; no core/Rust/wasm change; no new
  dependency; no model, no network — Travel is untouched.

## 4. Constraints & non-goals

- **Text match, not semantics** — "system config" finds topics that *say* configuration; it won't
  infer that "configuration space" is Lagrangian mechanics unless the body says so. The hand-off
  (R-0056/R-0069) remains the tool for semantic routing.
- **Non-goals (follow-ups):** fuzzy/typo tolerance; searching resource titles and notepad content;
  keyboard navigation of results; merging Travel into this panel.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-20 | Search bodies, not just names, with plural-forgiving words | The concept a reader brings ("degrees of freedom") lives in bodies, phrased singular; name-only search would return nothing. |
| 2026-07-20 | Group results by lens, strongest lens first | "Choose one from all available lenses" IS the feature — the same idea's doors, side by side. |
| 2026-07-20 | Keep Travel as-is | Travel is camera-focus by known name (works for fogged topics); Find-a-topic is discovery + open. Different jobs, no regression risk. |

## Changelog

- 2026-07-20 created (Accepted) + implemented — 🔎 Find a topic: debounced keyword search over every
  topic's name + body (AND semantics, plural-forgiving, md-stripped snippets), grouped by lens,
  tap-to-fly-and-open. Pure `topic-search.js` with 5 `node --test` cases (full suite 524/524).
  Live-verified: "degrees of freedom" (plural) found Classical Mechanics + Mathematical Methods
  (singular bodies) under Physics with the δS=0 snippet; "rotations" grouped hits across Physics /
  Classical Foundations / Geometric Algebra; tapping a result flew to and opened it. (Verification
  detour: a missing gitignored `pkg/` in the fresh worktree 404'd the wasm and wedged boot — an
  environment artifact, fixed by re-copying pkg; noted in memory.)
