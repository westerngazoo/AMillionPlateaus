# R-0085 — private-repo follow + shared-repo push hardening

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Depends on:** R-0082 (follow a wizard), R-0081 (world sync), R-0084 (auto-push).
- **Source:** slice 3 of the owner's "the 3 in order" (R-0082's parked follow-ups: private-repo
  follow and the two-way shared repo).

## 1. Statement

Two extensions to repo-based peering. **(a) Private follow:** the 👣 Follow panel gains an
optional token field — a wizard can share a private world by granting you read access; you paste
a token that can read it, and the follow works exactly like a public one. The token is stored on
that peer's entry in `mp.peers` (this browser only), sent only to api.github.com — the same
security envelope as the sync token, pasted by the owner, never handled by anyone else. GitHub
hides private repos as 404, so the no-token failure message now says so and points at the token
field; re-following without retyping the token keeps the stored one; the field clears after use.

**(b) Shared-repo hardening:** co-studying = both wizards point 📓 Sync at ONE shared repo (the
panel copy now says so). Two devices pushing concurrently (easier than ever with R-0084's
auto-push) can lose the GET→PUT race — GitHub answers **409** on a stale sha. `pushWorld` now
retries once: re-fetch, CRDT-merge the newer remote, write the union back. One retry settles any
two-writer race, and the merge-before-write means nothing is ever lost either way.

## 2. Acceptance criteria

- **AC1** — pure `peers.js`: `addPeer` carries an optional `token` (public follows store no token
  key at all; re-follow without a token keeps the stored one; a new token replaces it — rotation).
  Unit-tested.
- **AC2** — `ghGetWorldFrom` sends `Authorization: Bearer` only when the peer has a token; a
  tokenless follow of a private repo fails with a message naming the token field; a correct token
  merges the private world; the token persists on the peer, and the input clears after use.
- **AC3** — `ghPutWorld` throws with `.status`; `pushWorld` retries exactly once on 409
  (re-fetch → merge → put); other statuses and a second 409 still surface as errors.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 566/566 (1 new peers token test).
  Live-verified vs a stubbed GitHub API: a private world (seeded via R-0084's auto-push — 1
  automatic PUT) was 404 to a tokenless follow (helpful message, nothing stored), merged with the
  right token ("1 new topic merged", topic found in search, token persisted, field cleared); a
  first-PUT-409 push retried transparently — exactly 2 PUTs and "World ✓".
