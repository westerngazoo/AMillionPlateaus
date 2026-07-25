# R-0101 — sync your whole self under one user

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-25
- **Depends on:** R-0081 (world sync), R-0075 (notes sync), R-0010 (wizard identity).
- **Source:** the owner: "this is a craze now, everything unsync or synqued… I wanna sync everything
  under my user even if I have to push to git everything — this was the whole idea."

## 1. Statement

The graph (R-0081) and notes (R-0075) synced, but everything else — progress, annotations, adopted
lenses, persona — sat in localStorage on one device. This closes the gap.

**Profile sync.** All the personal state bundles into one file, `profile/state.json`, alongside the
world snapshot: signed mastery/traversal events (your PROGRESS), lesson progress, pretests, faded
derivations, the review queue, confusion marks, added prerequisites (R-0100), authored/adopted
lenses, persona, proofs, the capture inbox. Merged additively across devices (a merge can only ADD —
two devices editing different topics both keep their work; signed-event logs union by id), pulled at
boot, backed up automatically (on any graph change, on a 45s cadence, and when you leave the app).

**Move-my-identity.** Your progress is signed under your wizard key, so being "you" on another device
needs that same key — but the secret key is your identity and is **never written to git**. So you
move it across yourself: 🪪 *Same you on every device* reveals the key to copy on one device and
imports it on the other. It only ever touches this browser's localStorage; the app never sends or
logs it.

## 2. Acceptance criteria

- **AC1** — pure `profile.js`: an explicit `PROFILE_KEYS` allow-list of personal state and a
  `NEVER_SYNC` deny-list (secret key, API keys, GitHub/follow tokens, device config); `collectProfile`
  reads only the allow-list; `mergeProfile`/`deepMergeUnion` merge additively (arrays union by
  id/JSON, objects union keys, scalars keep local); `applyProfile` writes back only allow-listed
  keys; `profileFingerprint`/`parseProfile`. Unit-tested, including a test asserting **no secret or
  token can ever appear in a collected profile**.
- **AC2** — profile pulls at boot (reloading once if it merged in new state, so the app re-reads it)
  and pushes automatically: bundled with the world auto-push, on a 45s cadence, and on
  page-hide/visibility-change. Push merges the remote first (R-0085) so a concurrent device is never
  clobbered. "Back up everything ↑" includes the profile.
- **AC3** — the profile file NEVER contains the wizard secret, API keys, the GitHub sync token, or
  follow tokens — enforced by construction (allow-list) and a test.
- **AC4** — 🪪 move-my-identity: reveal the wizard key (shown only on explicit tap, cleared on Hide,
  with a strong warning) + copy; import validates the key by constructing an identity from it
  (rejecting junk and detecting the current key), then reloads as that identity. The secret is only
  ever read from / written to this browser's localStorage.
- **AC5** — additive, no new dependency, `apps/web` only, no wasm change; suite stays green.

## Changelog

- 2026-07-25 created (Accepted) + implemented. Suite 643/643 (9 new profile tests, incl. the
  secret-never-leaks assertion and a two-device merge round-trip). Live-verified: main.js parses in
  the browser (R-0099 lesson); a profile collected from a localStorage seeded with a fake secret +
  GitHub token carried the confusion, added prereq and mastery event but **neither the secret nor the
  token**; the 🪪 section revealed the real minted key (matching storage), rejected an invalid import,
  detected the current key, and cleared the secret from the DOM on Hide.
