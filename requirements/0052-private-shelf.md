# R-0052 — Private shelf: per-plateau resources that are yours alone

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-10
- **Depends on:** R-0014 (resources — the row shape), R-0051 (device-local PDFs + the media
  store the shelf's PDF rows reuse), R-0036 (the private-until-published pattern this mirrors),
  R-0023/R-0026 (the grounding + digest the shelf rows feed).
- **Realized by:** direct implementation (`private-shelf.js` pure map transforms + drawer glue)
- **Source:** the owner: "maybe a private resources link to each plateau might be the answer?
  that way i can link my boox notes and my private book collection"

## 1. Statement

Every plateau gains a **Private shelf**: resources (links, notes, device-local PDFs) stored ONLY
in this browser's localStorage — never in the CRDT, never synced, never visible to peers. The
pin form gains a **"Private"** checkbox that routes a pin (URL or 📄 PDF) to the shelf instead of
the shared graph. Shelf rows still **ground the learner's own companion** (they ride only to the
model the learner configured), can be **deleted** (private data CAN be deleted — grow-only guards
the shared log, not your shelf), and can be **published** — an explicit one-way promotion into
the shared world, mirroring the R-0036 proof pattern.

## 2. Rationale

Before this, every pin entered the shared CRDT: peers who sync could read the learner's whole
library by its titles. A personal book collection and Boox reading notes are exactly the material
someone wants ON the topic (for the companion, for split-view reading) but not IN the commons.
Private-by-choice with explicit publish is the app's existing trust posture (proofs, model keys,
persona) extended to resources.

## 3. Acceptance criteria

- **AC1 — Private pin.** With "Private" ticked, pinning a URL or a 📄 PDF adds a row to the
  plateau's Private shelf and NOTHING to the CRDT (the shared Resources list is unchanged);
  also-pin checkboxes shelve privately per checked topic. Untucked behaves exactly as before.
- **AC2 — Private rendering.** The shelf renders in its own drawer section ("this browser only"),
  with the same link/PDF affordances as public rows but NO stones/votes (there is no community in
  private), plus per-row ✕ (delete) and Publish.
- **AC3 — Publish is explicit and one-way.** Publish adds the row to the shared graph via the
  normal R-0014 path (grow-only from that moment) and removes it from the shelf.
- **AC4 — Grounds your companion only.** Shelf rows are appended to the plateau-scoped grounding
  (study verbs, offline digest, podcast) — they ride solely to the learner's own configured
  endpoint, never to peers or the relay.
- **AC5 — Survives reload; same trust boundary.** The shelf persists in localStorage
  (`mp.privateShelf`), local only — like the model config, never on the wire. Corrupt storage
  degrades to an empty shelf, never a crash.
- **AC6 — Pure + tested.** Shelf load/save/add/remove/read are pure functions over a plain map
  (`private-shelf.js`) with unit tests (corrupt-safe load, immutability, empty-shelf cleanup);
  glue only wires the checkbox, the section and the buttons.

## 4. Constraints & non-goals

Non-goals: cross-device private sync (would need an encryption story — the honest v1 is
"private = this browser"); bulk import of a folder of books (follow-up: multi-select in the PDF
picker); private plateaus/bridges (resources only); auto-expiring shares.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-10 | localStorage map, not a CRDT field | Private means NOT in the shared document — the trust boundary is structural, not a filter |
| 2026-07-10 | Checkbox on the existing pin form | One pin flow, one decision (share or not) — no parallel "private form" to maintain |
| 2026-07-10 | Shelf rows DO ground the companion | The learner's own model, the learner's own rows — that's the whole point of shelving study material |
| 2026-07-10 | Publish = R-0036's proof pattern | Private-until-published is already how the app treats personal work |

## Changelog

- 2026-07-10 created (Accepted) + implemented — private checkbox on the pin form (URLs + PDFs),
  per-plateau shelf section with delete/publish, grounding inclusion, corrupt-safe localStorage
  persistence.
