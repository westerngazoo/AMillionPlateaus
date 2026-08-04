# R-0109 — One tap from a topic to its notes folder in Drive

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0052](0052-private-shelf.md) (the private shelf), [R-0101](0101-profile-sync.md) (the shelf syncs)

## Why

A lot of the notes that matter aren't in this app: they're Google Docs written out
of a study chat, a PDF of worked problems, a photo of a whiteboard. The private
shelf (R-0052) could already pin such a link per topic — but pinning one URL by hand
does not scale to a 49-course degree, and the actual pain is the **Boox**: finding
the right folder by scrolling Drive on a slow monochrome screen is the worst part of
studying on e-ink.

The owner's ask was concrete: *"link just notes from a folder, plateaus-introcalculo
etc for each topic … cause when i go to the boox black and white its hard to find."*

## What

Every topic gets a **📁 folder row** above its private shelf, sized as a large tap
target because it exists for e-ink:

- **A folder pinned on the shelf wins.** Paste a Drive folder URL onto a topic once
  and the button opens *exactly* that folder — "📁 Open my notes folder ↗".
- **Otherwise it derives one, with zero setup.** The button becomes "📁 Find my
  notes in Drive ↗" and opens Drive **already searching** for the conventional
  folder name — `plateaus-introduccion-al-calculo` — with the name shown and a
  **Copy name** button so the folder you create is the one the button finds.

## Why a deep link and not the Drive API

Reading Drive from the app would need OAuth, a verified origin, a client id, and a
token living in the browser. That is a large dependency and a new secret for a
feature whose whole job is "get me to the right folder faster". A **deterministic
deep link** needs none of it: no OAuth, no API key, no token, no new dependency, it
behaves identically on every device, and its worst failure mode is landing on
Drive's own search page — which is still better than scrolling.

It also keeps the architecture honest: nothing about your Drive is stored in the
graph, and the app gains no new credential.

## Acceptance criteria

1. **AC1 — always available.** Every topic shows the folder row, whether or not
   anything is pinned.
2. **AC2 — pinned wins.** A Drive *folder* URL on the topic's shelf opens directly;
   its title is shown.
3. **AC3 — folders only.** A Drive *file* or Google *Doc* link does not count as the
   folder (it stays an ordinary shelf row).
4. **AC4 — the convention is stable.** The derived name is the same on every device
   and independent of accents/case, so one folder serves all of them.
5. **AC5 — the name is discoverable.** The derived folder name is displayed and
   copyable, so a folder created by hand matches what the button searches for.
6. **AC6 — no new credential.** No OAuth, API key or token is introduced, and
   nothing about Drive enters the graph.
7. **AC7 — e-ink first.** The control is a single large tap target, not an icon.

## Notes

- Pure module `apps/web/src/drive-folder.js` (`slugifyTopic`, `driveFolderName`,
  `driveSearchUrl`, `isDriveFolderUrl`, `topicFolder`, `describeFolder`) + 10 tests
  covering the Spanish course names, folder-vs-file discrimination, and
  pinned-beats-derived.
- Because the shelf is in `PROFILE_KEYS` (R-0101), a folder you pin on the laptop is
  already there on the Boox.
- Suite 704/704. Live-verified on *Introducción al cálculo*: derived →
  `plateaus-introduccion-al-calculo` search link with Copy name; after pinning a
  real Drive folder the button switched to opening that exact folder.
