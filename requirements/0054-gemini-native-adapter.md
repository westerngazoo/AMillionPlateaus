# R-0054 — Native Gemini adapter: make Google's new "AQ." keys work

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-12
- **Depends on:** R-0007 (bring-your-own model — the provider abstraction, presets and trust
  boundary this extends), R-0049 (the local⇄hosted slots the new preset files into).
- **Realized by:** direct implementation (a second provider adapter in `model.js` + one preset +
  carry the preset's `kind` through save in `main.js`; no new architecture).
- **Source:** the owner: "my google api free tier does not work … review it carefully it does not
  work!!!" with a working `curl` that used the **native** `:generateContent` endpoint and an
  `X-goog-api-key` header.

## 1. Statement

Add a **native Google Gemini** provider adapter (`kind: "gemini-native"`) and a preset for it, so a
key pasted from Google AI Studio in 2026 — the new **`AQ.`-prefixed** format — actually connects.
The adapter targets Gemini's own REST surface (`…/models/<model>:generateContent`), authenticates
with the **`x-goog-api-key` header** (not `Authorization: Bearer`), and translates the app's
OpenAI-style messages to Gemini's `contents` + `systemInstruction` shape and the response back.

## 2. Rationale

The existing `gemini-free` preset speaks Google's **OpenAI-compatibility** endpoint
(`/v1beta/openai/chat/completions` + Bearer). That path works for legacy `AIza…` keys but **rejects
the new `AQ.` keys** — the ones AI Studio now issues by default — with an auth error ("Invalid Auth
key" / "multiple authentication credentials"), a Google-side rollout gap. The owner's key is an
`AQ.` key and the owner's own working `curl` proves the request succeeds on the **native** endpoint
with a header key. So the fix is not a different key or model id — it's a second adapter that speaks
Gemini natively. This keeps the app's zero-cost free-tier promise (R-0007) real for today's keys.

## 3. Acceptance criteria

- **AC1 — Native endpoint + header auth.** `buildRequest` for `gemini-native` POSTs to
  `<endpoint>/models/<model>:generateContent`, carries the key in an `x-goog-api-key` header, and
  emits **no** `Authorization` header. A trailing slash on the endpoint is normalized.
- **AC2 — Message translation.** OpenAI-style messages become Gemini `contents`: role `assistant`
  → `model`, `user` stays `user`, and every `system` message is lifted into a single
  `systemInstruction` (omitted entirely when there is no system message). Response text is read
  from `candidates[0].content.parts[].text`, joined; a missing/empty shape yields `""`.
- **AC3 — Vision.** A base64 `data:` image part (the R-0045/R-0007 vision shape) becomes a Gemini
  `inline_data` part (`mime_type` + base64 `data`); a non-data image URL degrades to a text mention
  (the native endpoint cannot fetch a remote image inline). Vision turns route through the same
  adapter as text (companion `sendVisionTurn` is provider-agnostic).
- **AC4 — Selectable, without breaking the old path.** Model setup offers a **"Google Gemini (NEW
  AQ. key)"** preset; saving it persists `kind: "gemini-native"` (the save carries the chosen
  preset's kind rather than assuming `openai-compatible`). The legacy `gemini-free` (relabelled for
  OLD `AIza` keys) is unchanged and still works.
- **AC5 — Same trust boundary.** The key is pasted by the visitor into Model setup, lives only in
  this browser's storage, is never synced and never in the CRDT, and only ever rides the
  `x-goog-api-key` header of the request the active config builds (R-0007 AC5). The app ships no key
  and never handles the owner's key.
- **AC6 — Pure + tested.** The adapter and the `geminiParts` helper are pure functions in
  `model.js` with `node --test` unit tests (URL/header shape, role mapping, system→systemInstruction,
  systemInstruction omission, vision `inline_data`, response parsing, the degraded-URL case, and the
  preset wiring). `main.js` only wires the preset's kind through save.

## 4. Constraints & non-goals

- **No streaming.** The adapter uses `:generateContent` (single response), matching the app's
  existing non-streamed companion. `:streamGenerateContent` is a non-goal.
- **No key handling by the assistant.** Diagnosis used dummy keys only; the owner pastes the real
  key into the UI themselves.
- **Non-goals:** OAuth / service-account auth; Gemini function-calling or safety-setting knobs;
  auto-detecting `AQ.` vs `AIza` to pick the adapter (the labelled preset is the explicit choice);
  changing the OpenAI-compat adapter (legacy keys keep working there).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-12 | Add a native adapter rather than patch the OpenAI-compat one | The compat endpoint itself rejects `AQ.` keys; only the native surface accepts them — proven by the owner's working `curl` |
| 2026-07-12 | Key in `x-goog-api-key` header, never Bearer | Sending both a Bearer and a header key triggers "multiple credentials"; the native surface wants the header alone |
| 2026-07-12 | Default model `gemini-flash-latest` on `/v1beta` | An always-current free Flash alias — dodges the retired-id 429 trap the `gemini-free` preset already learned (R-0079/#78) |
| 2026-07-12 | Keep `gemini-free`, relabel it "OLD AIza key" | Legacy keys still work on the compat path; the two presets name which key format each is for |

## Changelog

- 2026-07-12 created (Accepted) + implemented — native Gemini adapter (`:generateContent` +
  `x-goog-api-key`), OpenAI↔Gemini message/response translation incl. vision `inline_data`, a
  labelled preset, and preset-kind carried through save. Fixes the owner's `AQ.` free-tier key.
