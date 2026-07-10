# R-0051 — Personal library: pin your own PDFs (device-local) + Drive links readable in-pane

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-10
- **Depends on:** R-0014 (resources — the row a PDF becomes), R-0045 (the IndexedDB media store
  and `resource://local/` convention this reuses), the #81 split-view reader (the pane Drive
  links open in), R-0028 (multi-pin — unchanged, URL resources only).
- **Realized by:** direct implementation (`library.js` pure helpers + pin-form/row glue; no new
  storage, no new architecture)
- **Source:** the owner: "can we add connection for my drive or personal pdf list?"

## 1. Statement

Two ways to study YOUR OWN material on a plateau:

1. **📄 Add a PDF (this device).** The pin-a-resource form gains a file picker: a chosen PDF's
   bytes go into this browser's IndexedDB media store (the R-0045 store), and the plateau gains a
   "Paper" resource at `resource://local/<id>` that opens in the **browser's own PDF viewer** —
   fully offline, no account, no upload, $0. On the Boox this IS the library: the PDFs already
   live on the device.
2. **Drive links read in-pane.** A pinned Google Drive share link, clicked in **split view**, is
   rewritten to Drive's embeddable `/preview` form so the PDF renders beside the topic instead of
   being refused by Drive's frame-blocking.

## 2. Rationale

The "connect Drive" ask splits into what needs an account and what doesn't. In-app Drive browsing
needs OAuth (a user-created Google client id) and drags a cloud dependency into a local-first app;
meanwhile the actual study loop — "my PDF, on this topic, readable next to my notes" — needs
neither: the file is on the device and the browser ships a PDF viewer. Local pinning + the
`/preview` rewrite deliver the loop at $0. (NotebookLM-style auto-slurping of Drive remains a
non-goal per R-0050's decision.)

## 3. Acceptance criteria

- **AC1 — Pick → pinned.** With a plateau open, "📄 Add a PDF" pins the picked file as a "Paper"
  resource titled from the filename (the form's title field, when filled, wins); the row appears
  in the ranked list immediately and survives reload (IndexedDB + CRDT snapshot).
- **AC2 — Opens offline.** Clicking the row's "📄 … open PDF" opens the stored bytes in the
  browser's PDF viewer via an object URL — no network, no renderer dependency.
- **AC3 — Honest validation.** Non-PDFs, empty files and files over the 25 MB cap are refused
  with a message naming the file and the cap (quota honesty); a blank/generic MIME type with a
  `.pdf` name is accepted (Boox/Android file managers).
- **AC4 — Honest sync story.** The CRDT syncs only the resource row; on a device without the
  bytes the row renders as "— stored on another device", never a broken image or dead link.
- **AC5 — Drive in-pane.** In split view, `drive.google.com/file/d/<id>/view` (and `open?id=` /
  `uc?id=` forms) load as `/file/d/<id>/preview` in the reader pane; non-Drive links unchanged.
- **AC6 — Pure + tested.** Validation (`pdfCheck`) and the rewrite (`frameableURL`) are pure
  functions in `library.js` with unit tests; glue only wires the picker, the store and the row.

## 4. Constraints & non-goals

- **Bytes never sync** (v1): a 25 MB blob doesn't belong in the CRDT and isn't sent over the P2P
  media channel (that channel remains the QR photo path). Follow-up if wanted: size-gated P2P
  transfer of small PDFs.
- **Non-goals:** in-app Drive browsing (OAuth client id — revisit if the friction earns it);
  PDF text extraction for companion grounding (needs a PDF parser dependency; the notes remain
  the grounding); annotations; folders/collections beyond the per-plateau pin.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-10 | Device-local blobs over Drive OAuth | The study loop needs the file readable next to the topic, not an account; local-first, $0, Boox-native |
| 2026-07-10 | Browser's own PDF viewer via object URL | Zero dependency (no pdf.js vendor); every target browser ships one |
| 2026-07-10 | 25 MB cap with an honest message | Papers/chapters fit; a stray 800 MB scan can't eat the origin's storage quota |
| 2026-07-10 | Accept `.pdf` by extension when MIME is blank/generic | Boox/Android file managers hand over PDFs with empty or octet-stream types |

## Changelog

- 2026-07-10 created (Accepted) + implemented — 📄 Add a PDF (media-store blob → "Paper" row →
  browser viewer), other-device honesty row, Drive `/preview` rewrite in split view. Also fixed
  in passing: the R-0045 "Read it" OCR button read a never-written config key (`mp-model`) and
  silently never reached the connected model; it now uses the active config.
