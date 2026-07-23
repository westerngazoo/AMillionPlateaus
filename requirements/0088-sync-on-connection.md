# R-0088 — sync-on-connection: the repo behaves like a live shared database

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Depends on:** R-0081 (world sync), R-0084 (auto-push), R-0086 (any forge).
- **Source:** the owner: "how could we create a p2p db or repo that syncs on connection or so."

## 1. Statement

The world already IS a P2P database (an Automerge CRDT — any two copies merge conflict-free); the
gap was the *automatic connection*. Two changes close it, turning the repo into a live shared DB
with zero new infrastructure:

1. **Pull on boot.** When 📓 Sync is configured, the app pulls the world once at startup — so
   opening it on any device catches up with what the others pushed. Fire-and-forget (never blocks
   boot), quiet unless it actually merges something in, silent when offline.
2. **Auto-push on ANY authored graph change**, not just captures. `persist()` (called after every
   graph mutation — a drafted plateau or bridge, a vote, a followed or imported world) now also
   queues the debounced world push. One `suppressAutoPush` guard skips the single wasteful case:
   pulling YOUR OWN repo must not immediately echo the same bytes back.

Together: change anything → it backs up ~3 s later; open the app anywhere → it catches up. Merge
is a CRDT union (never loses local work), the 409 retry (R-0085) settles two-writer races, and it
rides GitHub or your own Gitea (R-0086) identically. WebRTC P2P remains for live same-room sync.

## 2. Acceptance criteria

- **AC1** — with 📓 Sync connected, the app pulls the world once at boot; a merge that adds topics
  shows a brief chip; offline/unreachable is caught silently and the local world is intact.
- **AC2** — any authored graph change (draft plateau/bridge, vote, marker, import, follow — not
  only capture) queues the debounced auto-push; connecting and pulling your own repo do NOT echo
  a push (`suppressAutoPush` around the pull/pre-push merges).
- **AC3** — additive, no new dependency, `apps/web` only; no push↔pull loop; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 571/571. Live-verified vs a stubbed forge
  counting PUTs/GETs: connecting made **0** world PUTs (pull only); **drafting a plateau** (a
  non-capture authored change) auto-pushed exactly **1** PUT after the debounce; and after
  deleting the local graph, a fresh boot **pulled the drafted topic back** (a pre-module test
  stub caught the early boot request: **1 GET, topic restored, 0 PUTs** — the own-repo pull did
  not echo a push).
