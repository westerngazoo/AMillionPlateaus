# R-0102 — Move your whole setup in one paste

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0101](0101-profile-sync.md) (profile sync + move-my-identity), [R-0075](0075-notes-sync.md) (sync config), [R-0086](0086-byo-forge.md) (forge server)

## Why

R-0101 made your *data* travel — the graph, notes, and `profile/state.json` all
sync through your repo. But the things that **can never live in git** — your wizard
secret key, your GitHub/Gitea sync token, your model API keys, your relay URLs —
still had to be re-entered by hand on every device. Setting up a second Boox e-ink
tablet meant typing a repo, pasting a token, pasting a key, re-picking a model. On
a tablet that is slow and error-prone, and it was the last real friction in
"sync everything under my user."

The owner asked: *"would it be possible to have all configs in a file also
synced?"* The honest answer is that the two **secrets** must not ride in the
git-synced file — writing your repo's write-token *into that very repo* would leak
account access to anyone you ever share or follow the repo from. So instead of
syncing them through git, we move them **device-to-device, by hand, in one shot**.

## What

A single **"Move your whole setup"** transfer in the 📓 Sync panel, below the
move-my-identity block:

- **Export** produces one opaque, paste-safe blob (`MPSETUP1.<base64>`) carrying
  exactly the keys that must never be git-synced: `mp.wizardSecret`,
  `mp.notesSync` (repo + token + server), `mp.modelConfig`, `mp.modelSlots`,
  `mp.relayUrl`, `mp.pairRelayUrl`, `mp.peers`. It is shown only in a textarea for
  copy, never sent to a server, never logged, and cleared from the DOM on **Hide**.
- **Import** on the other device pastes the blob, **validates the embedded wizard
  key** by constructing an identity from it (a junk blob changes nothing), shows a
  plain-language summary of what will cross over, confirms, applies, and reloads
  fully configured — one paste instead of four fields.

This is the exact **complement** of `profile.js`: profile syncs your *data* through
git with secrets *excluded by construction*; setup-transfer moves your *secrets and
device config* by hand with git *never involved*. Together they are your whole self,
and the two key-lists are deliberately mirror images (`SETUP_KEYS` = profile's
`NEVER_SYNC` minus trivial UI state).

## Acceptance criteria

1. **AC1 — one blob carries the setup.** Export builds a single whitespace-free
   `MPSETUP1.` blob from exactly `SETUP_KEYS`; profile/data keys (e.g.
   `mp.eventLog`) never appear in it.
2. **AC2 — round-trips exactly.** Decode + apply on a clean device restores every
   carried key byte-identically; a second apply reports no change (idempotent).
3. **AC3 — secrets move, but only device-to-device.** The blob contains the wizard
   secret and token (that is its job) and is never pushed to a repo, sent to a
   server, or logged; it exists only in a textarea the user copies and then hides.
4. **AC4 — a bad blob is inert.** A non-`MPSETUP1.` string, corrupt base64, a
   newer-schema blob, or a blob whose wizard key is invalid changes nothing on the
   device and reports a clear error.
5. **AC5 — no smuggling.** Only recognised `SETUP_KEYS` are ever written back; a
   hand-edited blob carrying an arbitrary localStorage key is ignored.
6. **AC6 — import completes the device.** After import + reload, the device has the
   moved identity, sync repo, token, model and relays, and boot pulls the world +
   profile under the new identity (no further manual entry).

## Notes

- Pure module `apps/web/src/setup-transfer.js` (no wasm, no DOM); UI wiring in
  `main.js` reuses the existing `copyToClipboard` and the wasm identity validator.
- 10 unit tests in `setup-transfer.test.mjs`; live-verified in a browser (module
  round-trip + every DOM handler; the secret + token cross over, profile data does
  not).
- The identity-only move (R-0101) stays for the "same you, different sync" case;
  this is the "carry everything" path.
