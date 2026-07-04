# R-0045 — Rich note capture: handwritten photos (mobile→desktop via QR) + OCR + external search

- **Status:** Draft
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-03
- **Depends on:** R-0014 (trail markers / resources), R-0020 (plateau content), R-0018 (WebRTC P2P
  transport + QR-able signaling blob), R-0007 (companion / multimodal model), R-0044 (rhizome +
  the study surface). Composes existing primitives; the OCR reuses the connected multimodal model.
- **Realized by:** SPEC-0045 (pending). **Slice 0 (external search links) is already implemented.**
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Make adding knowledge to a plateau **richer and more physical than typing a URL**: (a) look a
topic up in one tap via **external search deep-links** (Perplexity / Wikipedia / Scholar,
prefilled with the plateau name); (b) **capture a handwritten note with your phone** and attach it
to the plateau you're studying — the desktop shows a **QR code**, the phone scans it to open a
lightweight capture page, takes a photo, and the image travels to the desktop; (c) optionally
**digitalize** the photo into text/Markdown via the already-connected **multimodal companion**
(Gemini/Claude read the image — no new OCR dependency), so a handwritten derivation becomes an
editable plateau body or a pinned resource.

## 2. Rationale

Real study is on paper — a scribbled proof, a margin diagram, a worked example. The world should
absorb that, not force it into a text box. A QR hand-off turns the phone (already in hand) into the
scanner the desktop lacks, and the multimodal model we just wired up (R-0007 + the Gemini/Claude
presets) can transcribe the image for free — no `tesseract.js`, no new runtime dep, honoring the
"vendored / zero-npm" constraint. And when a learner just wants a fast external lookup, a prefilled
Perplexity/Wikipedia/Scholar link beats retyping the topic into another tab.

## 3. Acceptance criteria

- **AC0 — External search (DONE).** A plateau's study view offers **"Look it up"** deep-links
  (Perplexity, Wikipedia, Scholar) prefilled with the URL-encoded plateau name, opening in a new
  tab (`rel="noopener"`). The learner chooses to click — nothing is sent automatically.

- **AC1 — QR pairing.** The desktop can display a **QR code** that a phone scans to open a minimal
  same-origin capture page. The QR encodes the pairing channel (reusing the R-0018 WebRTC signaling
  blob, or a short-lived room id) — **no third-party service**, offline-capable on a LAN.

- **AC2 — Mobile capture → desktop.** The capture page opens the phone camera (`<input capture>`
  or `getUserMedia`), the learner photographs the note, and the image is delivered to the desktop
  session (over the existing P2P data channel, downscaled/JPEG-capped for size).

- **AC3 — Attach as a resource.** The received image attaches to the **current plateau** as a
  resource (R-0014), stored as a bounded `data:` URI (size-capped), and renders in the study view.

- **AC4 — Digitalize (opt-in, multimodal).** With a multimodal model connected, a **"Read it"**
  action sends the image to the companion for transcription → editable Markdown, which the learner
  can accept into the plateau body or a note. Offline / non-multimodal → the image still attaches,
  transcription is simply unavailable (honest, no fake OCR).

- **AC5 — Additive, web-only, safe.** `apps/web/src` only; no core/Rust/wasm change; no new runtime
  dependency (QR render + camera + the connected model only). The key/secret boundary is unchanged;
  images ride the same user-owned channels as everything else. Pure helpers unit-tested.

## 4. Constraints & non-goals

- **No third-party capture/OCR service.** Pairing is P2P/same-origin; transcription is the user's
  own connected model. Nothing is uploaded to a service the app chose.
- **Bound image size** (downscale + JPEG quality cap) before it enters the CRDT/resource store —
  large blobs must not bloat sync or IndexedDB.
- **Non-goals:** a native mobile app (the capture page is a web page); multi-page scanning / PDF
  assembly; automatic handwriting-to-LaTeX beyond what the model returns; Google NotebookLM
  integration (no query-URL API — a plain link only, if at all).

## 5. Open questions

- **Transport for the image.** Reuse the R-0018 WebRTC data channel (already P2P) vs. a tiny
  same-origin relay for phones not on the same network — SPEC-0045 picks the lightest that works
  offline on a LAN first.
- **Storage.** `data:` URI in the resource (simple, syncs) vs. IndexedDB blob referenced by id
  (keeps the CRDT lean) — decide against the size cap.
- **QR rendering with zero deps.** A tiny vendored QR encoder vs. a pure-JS one inlined — must stay
  within the no-npm rule.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-03 | OCR = the connected multimodal model, not a bundled engine | Zero new dependency; Gemini/Claude already read images; honest "unavailable" offline instead of a weak local OCR |
| 2026-07-03 | Pair phone↔desktop with a QR over the existing P2P channel | No third-party service; works offline on a LAN; reuses R-0018 |
| 2026-07-03 | Ship Slice 0 (external search links) immediately | One-tap lookup is the user's stated acceptable minimum and composes trivially |

## Changelog

- 2026-07-03 created (Draft) — richer note capture: external search deep-links (Slice 0, done),
  QR-paired mobile photo capture over P2P, attach-as-resource, and opt-in digitalize via the
  connected multimodal companion. Web-only/additive, no new runtime dep. Pending SPEC-0045.
