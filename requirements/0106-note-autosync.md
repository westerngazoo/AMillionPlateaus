# R-0106 — Notepads sync themselves, without ever losing writing

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0075](0075-notes-sync.md) (the markdown notes channel), [R-0105](0105-notes-baton.md) (the hand-off that lands you in the notepad)

## Why

[R-0105](0105-notes-baton.md) closed the first half of the laptop→Boox loop: one tap
hands a topic over, and the Boox opens that topic with the notepad focused. Then you
write with the stylus — and **the writing was stranded.**

The world snapshot (R-0081) and the profile (R-0101) auto-push on every change. A
notepad did not: it moved only on an explicit **Push ↑**, and the laptop only saw it
on an explicit **Pull ↓**. Miss either tap and the note simply isn't on the other
device — which is precisely the failure the whole sync effort was meant to end. The
hand-off made it *worse*, because it invites you to write on a device you then have
to remember to push from.

## What

Notepads reconcile themselves:

- **After you stop typing (~4 s)** the open note is backed up to your repo.
- **When you open a topic**, its note reconciles with the repo in the background —
  silent on a clean fast-forward, so the Boox's writing is simply *there* when you
  return to the laptop.
- The manual **Push ↑ / Pull ↓** buttons stay exactly as they were, for when you want
  to force either direction.

## The hard part: a background pull must never destroy writing

Auto-syncing notes is **not** the same problem as auto-syncing the graph. The graph
is a CRDT, so a merge is always safe. A notepad is free-form text, and the existing
manual Pull is honest about what it does — *"replaced the local note"*. A human chose
that. Code running in the background must never make that choice, because the cost of
being wrong is destroyed writing.

So every sync is a **three-way merge** against a per-device **baseline** (the text
this device last agreed with the repo on):

| local vs baseline | remote vs baseline | outcome |
|---|---|---|
| unchanged | moved | **fast-forward** — adopt the remote (safe, silent) |
| moved | unchanged | **push** — send ours; the text you're typing is never rewritten |
| moved | moved | **conflict** — keep **BOTH**, under headings, and say so |

A conflict never picks a winner. It writes your version, then a
`## ⚠️ Also written on <device>` heading, then theirs — plain Markdown you resolve by
reading and deleting. Absence is distinguished from deletion: a note this device has
never synced fast-forwards freely, but a note you *deliberately cleared* counts as a
local edit and is pushed, not silently restored.

The baseline (`mp.noteBase`) is deliberately **local-only** and absent from
`PROFILE_KEYS`: it records *this* device's agreement with the repo, so syncing it
would let one device's agreement manufacture false fast-forwards on another.

## Acceptance criteria

1. **AC1 — the loop closes.** Writing on device A reaches device B without either
   device tapping Push or Pull.
2. **AC2 — a clean fast-forward is silent.** When only the repo moved, the note
   updates with a brief status line and no prompt.
3. **AC3 — writing is never lost.** When both sides moved, both versions survive in
   the note, the human is told, and neither is chosen automatically.
4. **AC4 — typing is never rewritten.** A push in flight does not replace the text
   currently in the textarea.
5. **AC5 — no false conflicts.** Trailing whitespace / line-ending differences are
   not edits.
6. **AC6 — clearing is an edit.** Emptying a synced note pushes the emptiness rather
   than being fast-forwarded back from the repo.
7. **AC7 — no regression when off.** With 📓 Sync unconfigured, notes behave exactly
   as before (local save only, no network, no baseline written).
8. **AC8 — offline is harmless.** A failed sync leaves the local note intact and says
   the manual buttons still work.

## Notes

- Pure module `apps/web/src/note-merge.js` (text in, text out — no DOM, storage,
  network or clock); 12 unit tests including the both-moved and cleared-note cases.
- The conflict text obeys the `markdown.js` subset (heading in its own block, one
  line per paragraph, no blockquote) — pinned by a test.
- Baseline state is declared with the rest of the notepad state so no code path can
  open a plateau before it initialises (a latent temporal-dead-zone trap otherwise).
- Live-verified: main.js parses in-browser; fast-forward / push / conflict /
  trailing-newline all behave correctly over the deployed module; with sync off a
  typed note still saves locally with an unchanged status and a clean console.
