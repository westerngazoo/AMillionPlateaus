# R-0023 — Study view: read, collect, and learn on a plateau

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-10
- **Depends on:** R-0020 (plateau body + read view), R-0014 (resources/markers), R-0015 (votes/stones → crystallize), R-0007 (bring-your-own companion), R-0021/R-0022 (a real, faceable vault to study)

- **Realized by:** SPEC-0023 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Today opening a plateau shows its Markdown body and a flat list of resource
links — you can read, but you can't *study*. This requirement turns the read
view into a **study surface** for one topic: its resources are **ranked by
stones** (best first, crystallized ones marked), you can **add a book / link /
video and stone it inline** without leaving the plateau, and a **plateau-scoped
companion** reads that topic's body + resources to help you learn — *summarize
this topic, build the mental model, what to read first, quiz me*. It is the
"travel there, read, grab resources, interact, summarize" loop the owner
described, scoped to a single island and grounded only in that island's
materials.

## 2. Rationale

Every primitive already exists — the plateau body (R-0020), markers (R-0014),
stones + crystallization (R-0015), and a graph-grounded bring-your-own companion
(R-0007) — but they live in three separate toolbar panels with no cohesion, so
"how do I actually study Calculus here?" has no answer. R-0023 composes them in
the one place it makes sense (on the plateau you opened), adding **no new GA,
CRDT, or Rust** — the wasm core already exposes `vote`, `add_resource`, and
resources carrying `vote_count` + `state`. The companion already assembles a
per-turn grounding block; this adds a **plateau-scoped** grounding (one topic's
body + its resources) so the tutor is about *this* island, not the whole map.

## 3. Acceptance criteria

- **AC1 — Resources ranked by stones.** Opening a plateau lists its resources
  **best-first** by weighted vote count (deterministic id tiebreak); each row
  shows its **stone count** and a **crystallized** marker when its state is
  Crystallized. The Markdown body read view (R-0020) is unchanged above it.

- **AC2 — Stone a resource inline.** Each resource has a **＋ stone** control that
  casts this wizard's vote (`doc.vote(resource, wizardId, weight)` — the audited
  grow-only R-0015 path), then the count + crystallization update live and the
  change **syncs + persists**. Re-stoning is the existing grow-only behaviour; no
  new vote semantics.

- **AC3 — Add a resource inline.** A small **add-a-resource** form on the panel
  (title, kind, uri) anchors a new marker to **this** plateau
  (`buildResource` → `doc.add_resource`), validated (known kind; an unsafe/empty
  uri is handled, never injected), then it appears in the ranked list and
  **syncs + persists**. The kinds are the existing set — Article, Video,
  Interactive, Paper, Note, Tool — so books, links, and YouTube videos all fit.

- **AC4 — Plateau companion (study actions).** The panel offers study actions —
  **Summarize**, **Mental model**, **What to read first**, **Quiz me** — that
  send a prompt grounded in a **plateau-scoped context** (this plateau's name +
  body + its top resources) through the existing **bring-your-own** model path
  (R-0007: local Ollama/LM-Studio or any OpenAI-compatible endpoint, key
  in-browser). The reply appears in the companion. With no model connected
  (offline `fake`), it degrades gracefully — a canned/empty reply, never a crash.

- **AC5 — Pure, grounded, tested.** The plateau study-context builder is a
  **pure** function — `buildPlateauStudyContext({ plateau, resources }) → string`
  — **unit-tested**: it names the plateau, includes the body **capped** to a
  bounded length (token safety), lists resources best-first with kind/title/uri,
  and is deterministic. Resource ranking is a pure, tested sort. No raw-HTML
  injection: the body/resources reach the model as **text** (not innerHTML), and
  any rendered link reuses the `safeHref` chokepoint / the R-0020 safe renderer.

- **AC6 — Additive, JS-only.** No Rust/wasm/CRDT/root-key change (vote +
  add_resource + the `vote_count`/`state` DTO fields already exist); no
  reputation/identity change; the study context is **assembled per-turn, never
  stored** (like R-0007's grounding). Existing tests stay green.

- **AC7 — Green + browser-verified.** All suites green; on the imported vault, a
  visitor opens a real plateau, sees its resources ranked, **adds a YouTube
  link**, **stones** it, and asks the companion to **summarize the topic** —
  with no uncaught console errors.

## 4. Constraints & non-goals

- **Compose, don't re-implement.** Reuse `doc.vote`, `doc.add_resource`,
  `buildResource`/`buildVote`, `assembleMessages`/`sendTurn`, `voiceFor`, and the
  existing model config. No new wasm bindings.
- **Ground in metadata + body, not fetched content.** "Summarize" means
  summarize **this plateau's body** (the visitor's own note text) and **triage
  its resources** (titles/kinds/links) — it does **not** fetch a YouTube
  transcript or scrape an external page. Fetch-and-digest of external resource
  *content* is a separate, carefully-scoped later feature (network/privacy).
- **Non-goals:** per-plateau persistent chat transcripts; embeddings/RAG over
  resources; replacing the global companion (it stays); editing an existing
  resource; deleting resources (votes are grow-only by design).

## 5. Open questions

- **Where the study UI lives.** Extend the existing `#plateau-detail` panel
  (one panel, scales with content) vs. a new modal. Leans: extend the panel.
- **Study-action wording / set.** The four above vs. fewer. Spec drafts them.
- **Companion target.** Reuse the one global companion panel (switch its
  grounding to the open plateau for these actions) vs. a mini-thread inside the
  detail panel. Leans: reuse the global panel (less surface, one transcript).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-10 | Compose existing primitives on the open plateau; no new Rust/wasm | vote/add_resource/DTO fields + the companion all exist; the gap is cohesion |
| 2026-06-10 | Plateau-scoped grounding = name + capped body + top resources | Makes the tutor about THIS topic; capping bounds tokens; pure + testable |
| 2026-06-10 | Ground in body + resource metadata, not fetched external content | Honest v1 boundary; fetching external pages is a network/privacy feature of its own |

## Changelog

- 2026-06-10 created (Accepted) — the "study a topic" layer the owner asked for; composes R-0020/R-0014/R-0015/R-0007. Pending SPEC-0023 + architect review.
- 2026-06-13 QA sign-off (**Status → Met**). All seven AC verified against `apps/web/src/study.js`, `study.test.mjs`, `main.js`, `index.html`. Gates: `node --test apps/web/src/*.test.mjs` 164 pass / 0 fail (156 prior + 8 study); `cargo test --workspace` green (157 Rust tests, 0 fail); `cargo fmt --all --check` clean; `cargo clippy --workspace --all-targets -- -D warnings` clean. Scope confirmed JS-only — no `crates/`/wasm/CRDT/Cargo/lockfile/root-key change (`git status --porcelain`). Adversarial notes: the `state === "Crystallized"` row check is exhaustive because `CrdtDoc::to_graph` (the path `doc.to_graph().resources()` reads) overwrites `state` to exactly `Crystallized` or `Floating`, derived from the weighted-vote tally — the other three `ResourceState` variants are never projected to JS. `＋ stone` binds `doc.vote(r.id, myVoterId, 10)` with the canonical `wizard_id_of` voter id; grow-only re-stoning is idempotent per voter (AC2 by design, not a defect). Model/peer replies render via `appendMessage` (`textContent`); the plateau body/resources reach the model as a STRING and rendered links reuse the `safeHref` chokepoint — no new untrusted-data `innerHTML`. `renderResourceList` is fully retired (no dead duplicate). AC7 browser evidence accepted as the manual portion per the spec's recorded run.
