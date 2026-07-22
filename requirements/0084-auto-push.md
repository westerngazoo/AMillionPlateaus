# R-0084 — auto-push: a captured topic backs itself up

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Depends on:** R-0081 (world sync), R-0079 (capture).
- **Source:** the owner's parked follow-up after R-0081 ("auto-push after each capture so it's
  zero-thought"), approved as slice 2 of "the 3 in order".

## 1. Statement

R-0081 made the world cross devices, but only when you remembered **Back up everything ↑** — the
exact failure mode that stranded Law of Sines/Cosines on one PC. Now a **⚡ capture auto-pushes**:
when 📓 Sync is connected, creating a topic queues a **debounced (3 s)** world push — rapid
captures coalesce into one; pushes never overlap (in-flight guard, the re-queue waits it out);
`pushWorld` still merges the remote first, so auto-pushes from two devices can't clobber each
other. Success shows a brief top-bar chip ("🌍 world backed up to GitHub ✓", auto-hides in 6 s);
failure stays visible and points at the manual button. With sync unconnected it is a strict
no-op — nothing changes for an offline-only world.

## 2. Acceptance criteria

- **AC1** — capturing a topic with sync connected pushes the world snapshot automatically after
  a ~3 s debounce, with no manual button; rapid captures coalesce into one push.
- **AC2** — a success chip appears and auto-hides; a failure message stays and names the manual
  fallback. Pushes never overlap.
- **AC3** — with 📓 Sync not connected, capture behaves exactly as before (no requests, no chip).
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented (`queueWorldAutoPush` in main.js, called from the
  capture-create path). Suite 565/565. Live-verified vs a stubbed GitHub API counting PUTs:
  connect pulled only (0 PUTs), capture made 0 immediate PUTs (debounce), exactly 1 PUT after
  ~3 s with the "🌍 world backed up to GitHub ✓" chip shown, and the chip auto-hid after 6 s.
