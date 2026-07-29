# R-0105 — Write it on my other device (no camera, no typing)

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0101](0101-profile-sync.md) (profile sync — the channel), [R-0075](0075-notes-sync.md) (the notes themselves)
**Supersedes for e-ink:** the camera half of [R-0058](0058-cross-device-capture-relay.md) / [R-0077](0077-note-images.md)

## Why

The owner reads on a laptop but wants to **write** on a Boox e-ink tablet — stylus,
no glare, no distractions. The existing cross-device path can't serve that:

> *"for the add note if i am studying on the laptop and wanna take notes on the boox
> i dont think the qr works cause i have no camera"*

They're right, and it's worse than a missing camera. **Scan Note (R-0058) is
camera-first in both directions**: the laptop renders a QR, the *phone* scans it,
and the payload flowing back is a **photo**. A Boox has no camera, so it can neither
scan the code nor produce the payload — and the design points the wrong way anyway,
treating the tablet as a capture device when it is the best *authoring* device.

The remaining option was to find the topic by hand on the Boox — typing a search on
e-ink, which is exactly the friction R-0102 was built to kill.

## What

A **baton**: a tiny "I'm on this topic" pointer that rides the profile already
synced by R-0101. No camera, no code, no typing.

- **Laptop** — a `✍️ Write on my other device` button in the notepad row hands the
  open topic over and pushes the profile immediately (rather than waiting for the
  45s cadence).
- **Boox** — a banner at the top: *"✍️ Laptop is on “Rotors” — write your notes
  here?"* with **Open its notes →**. Taking it flies to that plateau, opens it, and
  **focuses the notepad**, then consumes the pointer so it never re-prompts.
- The banner is checked at boot (a pure local read, so it works even before sync
  answers) and on a 30 s profile poll while the tab is visible. A baton older than
  6 hours is stale and stays silent — it never nags about yesterday.

Only the *pointer* travels here (a few bytes). The notes themselves keep flowing
over the existing markdown channel (R-0075), unchanged.

## The load-bearing design detail

`profile.js` merges with `deepMergeUnion`, where **scalars are local-wins**. A plain
`{ topicId }` object would therefore be *swallowed by the receiving device's own
stale value* and the hand-off would silently never arrive. So the baton is an
**array**, one entry per device, deduped by `id` — arrays union, so both devices'
pointers survive the merge and the reader picks the freshest entry that isn't its
own. `baton.test.mjs` pins this with a regression test that asserts the array
arrives *and* that the object form does not.

## Acceptance criteria

1. **AC1 — no camera, no typing.** Handing over and receiving involve one tap each;
   nothing is scanned, photographed, or typed.
2. **AC2 — it arrives.** A baton written on device A is offered on device B after a
   profile pull, resolved to the real plateau, opening its notepad focused.
3. **AC3 — it survives the merge.** The pointer is an array so `deepMergeUnion` cannot
   drop it in favour of the receiver's stale value (regression-tested).
4. **AC4 — one live pointer per device.** Handing over twice replaces your own
   previous pointer; another device's pointer is untouched; the list is capped.
5. **AC5 — quiet when it should be.** No banner for your own baton, for a stale one
   (>6 h), for a clock-skewed future one, or for a topic that isn't in this graph.
6. **AC6 — consumed on use.** Opening the handed-off topic clears the pointer, so it
   doesn't bounce back or re-prompt on the next boot.
7. **AC7 — honest when unconfigured.** With 📓 Sync off, the button says so and writes
   nothing (the hand-off travels through the repo).

## Notes

- Pure module `apps/web/src/baton.js` (no DOM, no storage, no clock — `now` is
  passed in); 8 unit tests; `mp.baton` added to `PROFILE_KEYS`.
- The device name (`mp.deviceName`) is deliberately **local-only** — each device is
  itself, so it must not sync and fight. Defaulted from the user-agent
  (`Boox`/`Tablet`/`Phone`/`Laptop`) and renameable.
- Live-verified as a two-device simulation in one browser: wrote a `Laptop` baton,
  became `Boox`, reloaded → banner offered the laptop's topic → Open landed in the
  focused notepad → pointer consumed.
- The QR path is untouched — it still serves a phone with a camera.
