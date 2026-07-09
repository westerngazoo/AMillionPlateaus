# SPEC-0045 — Rich note capture: external search, QR-paired mobile photo, model OCR

- **Status:** Accepted
- **Realizes:** R-0045
- **Author:** Claude (Opus 4.8)
- **Created:** 2026-07-04
- **Depends on:** R-0014/SPEC-0014 (resources / `add_resource`), R-0018/SPEC-0018 (WebRTC P2P
  transport), R-0012 (IndexedDB persistence), R-0007 (model client — now multimodal via the
  Gemini/Claude presets). Composes existing primitives — **no core/Rust/wasm/DTO change**.
- **Module(s):** `apps/web/src/main.js`, `apps/web/index.html`, new `apps/web/capture.html`, new pure
  `apps/web/src/rich-notes.js` (+ `.test.mjs`), a **vendored** encoder under `apps/web/vendor/qr/`
  (per the `vendor/katex` convention) with a thin `src/` wrapper, `apps/web/src/webrtc.js` (extended
  with a second `mp-media` channel), `apps/web/src/model.js` (a `visionMessages` helper).

## 1. Approach

Make adding knowledge **more physical than typing a URL**: (0) one-tap external lookups; (1)
photograph a handwritten note on your phone and get it onto the plateau you're studying via a **QR
hand-off over the existing P2P channel** — no third-party service; (2) attach it as a bounded image
resource; (3) **digitalize** it with the already-connected **multimodal companion** — OCR is the
user's own model, so **no new dependency** (no `tesseract.js`). **Slice 0 (search links) is shipped
on `main`;** this spec specifies slices 1–3 (issues #60 / #61 / #62).

## 2. Design

### 2.0 External search deep-links (SHIPPED — AC0)

`main.js`: `SEARCH_ENGINES` (Google / Gemini AI Mode / Wikipedia / Scholar) + `renderSearchLinks(p)` — a
`#detail-search` row of `<a target="_blank" rel="noopener">` prefilled with the URL-encoded plateau
name. The learner chooses to click; nothing is auto-sent.

### 2.1 Slice 1 — QR pairing + mobile capture page (issue #60, AC1/AC2)

**Pairing — the QR carries a room id, NOT the offer.** R-0018's handshake is *manual, non-trickle,
two-way* (`createOffer` → phone `acceptOffer` returns an **answer** → desktop `acceptAnswer`). A QR
is one-directional, and an SDP blob (1.5–4 KB) does not fit a scannably-dense QR — so the QR must not
carry the offer. Instead:

- The desktop mints a short **room id** and renders a QR of `…/capture.html#<roomId>` (tiny → scans
  reliably). A minimal **same-origin signaling shim** exchanges the SDP **both ways** by room id —
  desktop posts the offer, phone posts the answer, desktop `acceptAnswer`s. Same-profile-on-LAN can
  use a `BroadcastChannel`; otherwise a short-lived same-origin rendezvous. **No third-party service.**
- **`capture.html`** reads `location.hash` (room id), pulls the offer from the shim, opens the camera
  (`<input type="file" accept="image/*" capture="environment">` first; `getUserMedia` as an
  enhancement), and completes the handshake via **`webrtc.js`**.

**Media rides a SECOND channel, not the sync channel.** The existing `mp-sync` `RTCDataChannel` is
fully owned by CRDT sync — `onMessage` feeds every inbound `Uint8Array` straight to
`doc.receive_message`, so raw image bytes there would corrupt the Automerge decoder. The image rides
a **second, labeled `RTCDataChannel` (`mp-media`)** on the same peer connection — an isolated
extension of the R-0018 transport that leaves the sync framing untouched. (A tag-byte demux on one
channel is the alternative; the second channel is preferred — zero change to the CRDT message path.)

- **`vendor/qr/`** — a **vendored, zero-dependency** QR encoder (pure `qrMatrix(text) → bool[][]`),
  under `apps/web/vendor/` per the `vendor/katex` convention (with LICENSE + provenance); a thin
  first-party `src/` wrapper draws it to a canvas. Unit-tested against known text→matrix vectors.

### 2.2 Slice 2 — attach a bounded photo as a resource (issue #61, AC3)

**Store the blob in IndexedDB + a reference in the CRDT — NOT a `data:` URI.** Two facts force this:
(a) the study view gates every resource uri through `safeHref`, whose allowlist is `^(https?:|mailto:)`
(`markdown.js`) — a `data:` uri is rejected and renders as inert text, no `<img>`; and (b) a `data:`
image in `Resource.uri` (a plain Automerge `String`) syncs to every peer and rewrites IndexedDB on
every save — the CRDT bloat R-0045 forbids.

- Pure **`boundImage(w, h, maxEdge) → {w, h}`** (`rich-notes.js`, + tests): downscale ratio so the long
  edge ≤ `maxEdge` (e.g. 1400); never upscales. **Then a hard ENCODED-byte cap** `MEDIA_BYTE_CAP`
  (e.g. 256 KB): re-encode at decreasing JPEG quality until under cap; still over ⇒ reject with an
  honest message. (`boundImage` bounds *pixels*; the cap bounds *bytes* — both are needed.)
- Store the capped JPEG **blob in IndexedDB** (its own object store, generated id); attach a resource
  whose **uri is a local reference** `resource://local/<id>` via the R-0014 `add_resource` path. The
  CRDT carries only the short reference; the bytes never sync.
- **Render branch:** the study view resolves `resource://local/<id>` → load the blob from IndexedDB →
  `URL.createObjectURL` → an `<img>`. Gate it with a **new `safeImageSrc(uri)`** that accepts ONLY
  `resource://local/<id>` (and `data:image/(png|jpeg|webp);base64,` if a remote-image kind is later
  added). **Do NOT widen `safeHref`** — it guards body links against `javascript:`; image sources get
  their own, separately-constrained checker.

### 2.3 Slice 3 — "Read it": digitalize via the multimodal model (issue #62, AC4)

- Pure **`visionMessages(imageDataUri, prompt) → messages[]`** (`model.js`, + test): the OpenAI-
  compatible content array `[{role:"user", content:[{type:"text",text:prompt},{type:"image_url",
  image_url:{url:<dataUri>}}]}]` — the shape Gemini's and Claude's OpenAI-compat surfaces accept (a
  `data:image/jpeg;base64,…` url is valid there). **Reuse, don't duplicate:** url + headers (incl. the
  Anthropic browser-access header) come from the **existing `buildRequest(cfg, messages)`** —
  `visionMessages` builds *only* the messages, so the key-boundary logic stays in one place.
- **Seam:** `sendTurn` calls `buildRequest` internally, so add a thin **`sendVisionTurn(cfg, messages,
  deps)`** (or inject a prebuilt request into `sendTurn`) — one small orchestration edge, tested with
  a fake `fetch` like the existing companion tests. The reply is a normal chat completion, so
  `parseResponse` is unchanged. The image is re-read from its IndexedDB blob and inlined as a
  **transient** `data:` url for the request only (never stored as `data:`).
- A **"Read it"** button on an attached image → `sendVisionTurn` → transcribed **Markdown**, which the
  learner can **accept** into the plateau body or a note (existing content path).
- **Offline / non-multimodal** → the image still attaches; "Read it" is disabled with an honest
  message — **no fabricated OCR**.

## 3. Code outline (representative — the pure edges)

```js
// rich-notes.js — bound PIXELS (a byte cap is enforced separately, §2.2)
export function boundImage(w, h, maxEdge = 1400) {
  const s = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

// model.js — build ONLY the multimodal messages; DELEGATE url/headers to buildRequest,
// so the Anthropic browser-access header + key boundary stay in exactly one place.
export function visionMessages(imageDataUri, prompt) {
  return [{ role: "user", content: [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageDataUri } },
  ] }];
}
// usage: buildRequest(cfg, visionMessages(dataUri, prompt))  →  sendVisionTurn(cfg, msgs)

// image sources get their OWN checker — do NOT touch safeHref (it guards body links).
export function safeImageSrc(uri) {
  return /^resource:\/\/local\/[\w-]+$/.test(uri) ||
    /^data:image\/(png|jpeg|webp);base64,/.test(uri)
    ? uri : null;
}
```

## 4. Non-goals

- No native mobile app (`capture.html` is a web page); no multi-page scan / PDF assembly; no Google
  NotebookLM query (it has no query-URL — a plain link at most); no auto-handwriting→LaTeX beyond
  what the model returns; **no third-party capture/OCR/relay service** (P2P + same-origin only).

## 5. Open questions (settle before → Accepted)

_The two blockers the first review found — the manual-handshake answer-return leg + SDP-vs-QR size
(§2.1), and the `data:`-can't-render + CRDT-bloat problem (§2.2) — are RESOLVED in the design above
(room-id-in-QR + signaling shim; IndexedDB blob + `resource://local/` reference). What remains:_

1. **Off-LAN phones.** Slice 1 pairs same-origin / same-LAN via the signaling shim (§2.1). A phone on
   a *different* network needs a hosted rendezvous for the SDP exchange — a genuine follow-up, out of
   scope for #60.
2. **`MEDIA_BYTE_CAP` value + over-cap behavior.** §2.2 fixes the mechanism; pin the number (256 KB
   proposed) and confirm reject-vs-further-downscale on a stubborn image.
3. **QR encoder provenance.** Pin the exact vendored source + license under `apps/web/vendor/qr/`.

## 6. Acceptance mapping (→ R-0045)

| R-0045 AC | Where |
|-----------|-------|
| AC0 external search (done) | §2.0 |
| AC1 QR pairing | §2.1 |
| AC2 mobile capture → desktop | §2.1 (`capture.html` + room-id shim + the `mp-media` channel) |
| AC3 attach as bounded resource | §2.2 (`boundImage` + byte cap → IndexedDB blob + `resource://local/` ref + `safeImageSrc`) |
| AC4 digitalize (opt-in, multimodal) | §2.3 (`visionMessages` → `buildRequest`; `sendVisionTurn`) |
| AC5 additive, web-only, no new dep, pure+tested | pure helpers + tests; OCR = the connected model; QR vendored |

**Testing:** pure `boundImage`, `buildVisionRequest`, and `qrMatrix` unit-tested (`node --test`, the
last with a fake `fetch`); a manual browser smoke for the camera/QR/pairing path (which can't run
headless).

## Changelog

- 2026-07-04 created (Draft) — formalizes R-0045: Slice 0 search links (shipped on `main`) + QR
  pairing/mobile capture (#60), bounded-image attach (#61), and model-OCR "Read it" (#62).
- 2026-07-04 revised (architect REQUEST-CHANGES → resolved): (1) `data:` resource can't render —
  `safeHref` rejects it — so store the image as an **IndexedDB blob + a `resource://local/` reference**
  with a new `safeImageSrc` (never widen `safeHref`); (2) the QR can't carry an SDP offer (two-way
  handshake + blob size) — carry a **room id + a same-origin signaling shim**; (3) image bytes would
  corrupt the CRDT sync channel — ride a **second `mp-media` `RTCDataChannel`**; (4) add a hard
  **encoded-byte cap**, not just a pixel bound; (5) `visionMessages` **delegates to `buildRequest`**
  (key boundary in one place) via a `sendVisionTurn` seam; (6) vendor the QR encoder under
  `apps/web/vendor/qr/`.
