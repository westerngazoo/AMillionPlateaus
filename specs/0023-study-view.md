# SPEC-0023 — Study view: ranked resources, inline add/stone, plateau companion

- **Status:** Implemented
- **Realizes:** R-0023
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-10
- **Depends on:** SPEC-0020 (read view + safe renderer), SPEC-0014 (resources), SPEC-0015 (votes/crystallize), SPEC-0007 (companion)
- **Module(s):** `apps/web/src/study.js` + `study.test.mjs` (NEW, pure), `apps/web/src/main.js` (grow `openPlateau`; study actions), `apps/web/index.html` (add-form + study buttons + CSS). **No Rust, no new deps, no wasm change.**

## 1. Motivation

R-0023: make the opened plateau a place to *study*. Everything needed is already
exposed by the wasm core — `doc.vote`, `doc.add_resource`, resources carrying
`vote_count` + `state` — and the companion path (`assembleMessages`/`sendTurn`)
already exists. This spec composes them on the plateau panel and adds one pure
module: a **plateau-scoped grounding builder** so the tutor is about *this* topic.

## 2. Design

### 2.1 `study.js` — pure (ranking + grounding + actions)

```js
// study.js — pure helpers for the plateau Study view (R-0023). No DOM, no GA.
const BODY_CAP = 2000; // bound the body we send to the model (token safety)

/** Resources best-first: weighted votes desc, deterministic id tiebreak. */
export function rankResources(resources = []) {
  return [...resources].sort(
    (a, b) => (b.vote_count - a.vote_count) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Plateau-scoped grounding for the tutor: name + capped body + top resources.
 *  Pure + deterministic; sent to the model as TEXT (never innerHTML). */
export function buildPlateauStudyContext({ plateau, resources = [] }) {
  const body = (plateau?.description ?? "").slice(0, BODY_CAP);
  const top = rankResources(resources).slice(0, 8).map(
    (r) => `- ${r.kind}: ${r.title}${r.uri ? ` (${r.uri})` : ""}${r.state === "Crystallized" ? " [vouched]" : ""}`,
  );
  return [
    `The learner is studying the plateau "${plateau?.name ?? "Untitled"}".`,
    body ? `Its notes:\n${body}` : "It has no notes yet.",
    top.length ? `Resources pinned here (best first):\n${top.join("\n")}` : "No resources pinned yet.",
    "Help them learn THIS topic, grounded ONLY in the notes and resources above. " +
      "If the notes are thin, say so and suggest what to add — do not invent facts or resources.",
  ].join("\n\n");
}

export const STUDY_ACTIONS = [
  { key: "summary", label: "Summarize",        prompt: "Summarize this topic in a few clear sentences, using only its notes." },
  { key: "model",   label: "Mental model",     prompt: "Give me the core mental model for this topic — the 2–3 ideas everything else hangs on." },
  { key: "first",   label: "What to read first", prompt: "Of the resources pinned here, what should I read or watch first, and in what order? If there are none, suggest what kind would help most." },
  { key: "quiz",    label: "Quiz me",          prompt: "Ask me three short questions, one at a time, to check my understanding of this topic." },
];
```

`study.test.mjs` (node, no DOM): `rankResources` orders by `vote_count` desc with
an id tiebreak and doesn't mutate its input; `buildPlateauStudyContext` names the
plateau, **caps the body at 2000 chars**, lists resources best-first with
kind/title/uri, marks `[vouched]` for Crystallized, handles empty body/resources,
and is deterministic.

### 2.2 `main.js` — grow `openPlateau` into the Study view

- `openPlateau(p)` keeps the R-0020 body render (unchanged), records
  `studyPlateau = p`, and calls `renderStudyResources()`.
- **`renderStudyResources()` REPLACES the old `renderResourceList`** (architect
  finding 5): the old flat renderer's only caller is `openPlateau`, so it is
  **removed** to avoid a dead duplicate (CLAUDE.md §2). `renderStudyResources`
  reads the live resources for `studyPlateau` and renders them **ranked**
  (`rankResources`). Each row:
  - kind badge + title (as a `safeHref` link, else inert text — unchanged chokepoint),
  - a **stone count** `● {Math.round(vote_count)}` and, when
    `state === "Crystallized"`, a **bedrock** badge,
  - a **＋ stone** button → `doc.vote(r.id, myVoterId, STONE_WEIGHT)` (the audited
    R-0015 path; `STONE_WEIGHT = 10`, the existing form default) → `sync.pump()` +
    `pumpPeer()` + `persist()` + `draw()` + `renderStudyResources()`.
- **Add-a-resource form** (in the panel): title + kind (`RESOURCE_KINDS`) + uri →
  `buildResource({ plateau: studyPlateau.id, title, kind, uri })`; on `error`
  show it inline, else `doc.add_resource(...)` → pump/peer/persist/draw +
  `renderStudyResources()`; clear the fields. Re-uses the exact R-0014 factory.
- **Study actions:** render `STUDY_ACTIONS` as buttons; clicking one calls
  `studyAction(prompt)`:
  ```js
  function studyAction(prompt) {
    if (!studyPlateau || !activePersona) return;
    const rs = doc.to_graph().resources().filter((r) => r.plateau_id === studyPlateau.id);
    const grounding = buildPlateauStudyContext({ plateau: studyPlateau, resources: rs });
    companion.hidden = false;
    appendMessage("user", prompt);
    const messages = assembleMessages(voiceFor(activePersona), grounding, history, prompt);
    sendTurn(modelConfig, messages)
      .then((reply) => { appendMessage("bot", reply); history.push({ role: "user", content: prompt }, { role: "assistant", content: reply }); })
      .catch((err) => appendMessage("error", `⚠ ${err.message}`)); // graceful (R-0007 AC4)
  }
  ```
  This is the existing companion turn (`appendMessage` is `textContent` — no new
  injection surface) with the **grounding swapped** from the global
  `buildContextForTurn()` to the plateau-scoped `buildPlateauStudyContext`. With
  the offline `fake` provider it still returns gracefully.

  Three one-line code comments to carry (architect findings 3, 4, 6):
  - at the sort / stone pill: `vote_count` is the **weighted sum** (R-0015),
    `Math.round`ed for display only — not an integer tally;
  - at `studyAction`: it shares the **global `history`** by design (one
    companion, one transcript) — a plateau answer can context a later global
    turn and vice-versa;
  - at `studyAction`: the plateau body (possibly imported/synced peer content) is
    sent to the configured model endpoint — the **same trust boundary as R-0007**
    (the visitor's own endpoint, key in-browser, never synced).

### 2.3 `index.html` — panel additions

Inside `#plateau-detail`, after `#detail-resources`:
- a **Study with your companion** button row `#detail-study` (filled by JS from
  `STUDY_ACTIONS`);
- an **add-a-resource** form `#detail-add` (`#detail-add-title` text,
  `#detail-add-kind` select, `#detail-add-uri` text, a **Pin** button) + an
  inline `#detail-add-error`.

CSS: stone-count pill, bedrock badge, `＋` button, the study-action button row,
and the compact add-form — mirroring the existing `.dp-*` / detail styles. No
z-index change.

## 3. Code outline

`study.js` ~35 lines pure + its test; `main.js` ~55 lines (renderStudyResources,
the stone + add handlers, studyAction, populate the kind select + study buttons);
`index.html` ~18 lines markup + CSS. No Rust.

## 4. Non-goals

Per R-0023 §4: no fetch/scrape of external resource *content* (ground in body +
metadata only); no per-plateau persistent transcript; no embeddings/RAG; no
edit/delete of resources; the global companion stays. No GA/CRDT/Rust change.

## 5. Open questions (resolved here)

- Extend `#plateau-detail` (not a new modal). §2.3.
- Reuse the one global companion panel, swapping grounding for these actions. §2.2.
- Four study actions as above. §2.1.

## 6. Acceptance criteria

Maps to R-0023 AC:

- [x] AC1 — resources best-first by votes (id tiebreak) with stone count +
      crystallized marker; body read view unchanged. *(Browser: Article ●10 above
      Video ●0; the real note's 26 KaTeX body rendered above.)*
- [x] AC2 — ＋ stone casts `doc.vote`, updates live, syncs + persists. *(0→10;
      grow-only — repeat clicks idempotent per voter, by design.)*
- [x] AC3 — add-a-resource form anchors a marker to this plateau via
      `buildResource`/`add_resource`, validated, appears in the list, syncs.
      *(Added a YouTube Video + a Wikipedia Article inline; markers 60→62.)*
- [x] AC4 — study actions send a plateau-scoped grounding through the BYO model
      path; reply in the companion; offline `fake` degrades gracefully.
      *(Summarize → user+bot turns appended; offline canned reply, no crash.)*
- [x] AC5 — `rankResources` + `buildPlateauStudyContext` pure + unit-tested
      (body capped at 2000, best-first, deterministic); no raw-HTML injection.
      *(`study.test.mjs`, 8 cases.)*
- [x] AC6 — JS-only, additive; no Rust/wasm/CRDT change; context not stored;
      existing tests green. *(164 JS pass; fmt clean; `renderResourceList`
      retired into `renderStudyResources`.)*
- [x] AC7 — browser on the imported vault: opened a real plateau, added a YouTube
      link, stoned it, summarized via the companion; console error-clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | One pure module (`study.js`) for ranking + grounding + action prompts | Keeps the testable logic out of the DOM; mirrors companion-context.js |
| 2026-06-10 | Swap the companion's grounding to the plateau context for study actions | Reuses the audited turn path; makes the tutor about THIS topic |
| 2026-06-10 | Stone weight 10 (the existing place-stone default); grow-only | No new vote semantics; consistent with R-0015 |

## Changelog

- 2026-06-10 created (Draft) — pending architect review, then Accepted.
- 2026-06-10 architect design review: **APPROVE-WITH-NITS, no blocking issues**
  (reuse fidelity confirmed against every binding; no new injection surface;
  `Crystallized` binary check confirmed exhaustive vs the projection). Folded:
  `renderStudyResources` **replaces/retires** `renderResourceList` (finding 5);
  three code-comment notes — `vote_count` is a weighted sum rounded for display,
  shared-`history` by design, body→endpoint same trust as R-0007 (findings 3/4/6).
  **Status → Accepted.**
- 2026-06-10 implemented + browser-verified (`study.js` + `study.test.mjs` 8;
  `openPlateau`/`renderStudyResources` + stone/add/study wiring; `index.html`
  study buttons + add-form + CSS; `renderResourceList` retired). 164 JS tests,
  fmt clean. Browser on the imported IGoose vault: opened "Combinaciones
  lineales…" (26 KaTeX body), added a YouTube video + Wikipedia article inline,
  stoned the article above the video, Summarize sent the plateau-scoped grounding
  to the companion (offline-graceful), console clean. **Status → Implemented.**
