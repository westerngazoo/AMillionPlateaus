# R-0075 — Notes sync wizard: your own GitHub repo, readable on your Boox

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-20
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0056 (the private notepad being synced), R-0007 AC5 (the paste-your-own-key
  pattern the token follows).
- **Source:** the owner: "the preview note I cannot save it… what if I wanna save a private note but
  also be available in my Boox tablets, I have 2 — can I set up a GitHub repo?" and "can we have a
  wizard to set up the GitHub private notes repo?"

## 1. Statement

A **setup wizard** (☰ → 📓 Notes sync) walks through: **1)** create a private repo (deep-link to
`github.com/new` prefilled `plateaus-notes`/private) and enter `owner/repo` (or paste the URL);
**2)** create a **fine-grained token** (deep-link to the exact settings page, with the two switches
spelled out: *Only select repositories* → the notes repo; *Contents: Read and write*) and paste it —
**stored in this browser's localStorage only, sent only to api.github.com** (the model-key pattern;
never handled by anyone else); **3) Test & save** — specific verdicts (Connected ✓ private / ⚠️
public-repo warning / 401 token / 404 access / offline); **4) Push all notes ↑**. Once connected,
every notepad gains **Save now** (+ a loud "Saved ✓ (this browser)"), **Push ↑**, and **Pull ↓** —
one Markdown file per topic (`notes/<name-slug>--<id8>.md`), readable raw in any Boox reader; the
second tablet connects with the same repo + its own pasted token.

## 2. Acceptance criteria

- **AC1** — the wizard's two deep-links open the prefilled repo-create page and the fine-grained
  token page; repo input accepts `owner/repo` or a full URL (`parseRepo`).
- **AC2** — the token is persisted ONLY in `mp.notesSync` (localStorage); the input clears after
  save; every request goes to `api.github.com` and nowhere else (cross-origin → SW bypass).
- **AC3** — Test & save yields specific outcomes: private ✓ / PUBLIC ⚠️ / 401 / 404 / network-fail.
- **AC4** — per-topic Push/Pull use the contents API with sha-aware updates (`ghGetNote` →
  `ghPutNote`), UTF-8-safe base64 (accents + math survive); Pull replaces the local note and says so;
  Push-all iterates every non-empty note, reporting pushed/failed counts.
- **AC5** — the notepad gains an explicit **Save now** + "Saved ✓ (this browser)" status (fixing
  "I cannot save it" — autosave was invisible and Preview hid the textarea).
- **AC6** — pure + additive + tested: `notes-sync.js` (parseRepo/noteFilePath/base64/headers) under
  `node --test`; `apps/web` only; sync buttons hidden until connected; nothing enters the CRDT.

## 3. Non-goals (follow-ups)

Auto-sync on save (manual push/pull = predictable conflicts story: last write wins, sha-guarded);
merge/conflict UI; syncing marks/progress; the pedagogy trio (spaced queue → pretest → fading) next
per the approved roadmap.

## Changelog

- 2026-07-20 created (Accepted) + implemented — wizard + per-notepad Save/Push/Pull + Push-all.
  Suite 533/533 (4 new). Live-verified against the real GitHub API: deep-links correct; bad-repo
  message; fake token → exact 401 verdict; with a saved config the notepad showed Push/Pull,
  "Save now" persisted with "Saved ✓", and Push failed honestly with the 401 guidance (the same
  path writes `notes/motion--00000000.md` with a real token).
