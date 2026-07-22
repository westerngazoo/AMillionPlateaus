# R-0082 — follow a wizard's world through their GitHub repo (read-only)

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0081 (world snapshot format), R-0012 (CRDT merge), R-0075 (repo parsing).
- **Source:** the owner: "the connect with peer could be done not directly, maybe through a repo"
  → chose read-only "follow a peer's repo".

## 1. Statement

"Connect a peer" used to mean a live WebRTC handshake — copy-paste SDP blobs, same LAN, both
devices online at once — which is unusable across real machines. **Follow a wizard** replaces it
with an async, repo-based path: paste another wizard's **public** repo (the one they sync their
world to, R-0081), and the app pulls their `world/graph.mpworld` snapshot and **CRDT-merges** their
islands onto your map. It is **read-only** — you pull their topics in; you never write to their
repo, and nothing of yours is sent to them. The merge is a union, so it only ever **adds** their
topics and never disturbs yours. Public repos are read **unauthenticated** — no token needed, so you
can follow a wizard even without setting up your own sync. Followed repos persist in `mp.peers`
(this browser only); each has **Re-pull ↓** (catch up) and **Unfollow** (their already-merged
topics stay). The existing WebRTC P2P remains for live same-room sync.

## 2. Acceptance criteria

- **AC1** — pure `peers.js`: `peerKey` ("owner/repo", lowercased), `addPeer` (append with
  defaults, dedup by key refreshing branch/label, ignores junk), `removePeer` (by key,
  case-insensitive). Unit-tested.
- **AC2** — `ghGetWorldFrom(owner, repo, branch)` reads a world snapshot from ANY repo
  unauthenticated; `followPull(peer)` merges it (`merge_bytes`), registers imported domains,
  persists + redraws, returns the count of new plateaus (null if the repo has no world file).
- **AC3** — 👣 Follow a wizard panel: accepts owner/repo or a GitHub URL (`parseRepo`), Follow +
  pull ↓ adds the peer and pulls, a persisted list shows each with Re-pull ↓ / Unfollow, and
  clear status for "N new topics merged", "up to date", "no world found", and unreachable repos.
- **AC4** — read-only (never PUT to a peer repo); additive, no new dependency, `apps/web` only;
  suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 559/559 (3 new peers tests). Live-verified a
  two-wizard simulation vs a stubbed GitHub API: produced a peer world containing "PEERTOPIC Ada
  spinor networks" (capture + Back up ↑), then on a **fresh follower device** (deleted IndexedDB,
  a different lens, PEERTOPIC absent) followed `https://github.com/ada/plateaus-world` →
  "Following ✓ — 1 new topic merged onto your map", the topic appeared in search, and the follow
  persisted in `mp.peers`.
