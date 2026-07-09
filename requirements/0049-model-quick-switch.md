# R-0049 — Local ⇄ hosted model quick-switch

- **Status:** Accepted
- **Milestone:** POC — Reach
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-08
- **Depends on:** R-0007 (bring-your-own model — the config, presets and trust boundary this
  extends), R-0026 (offline digest — the zero-config floor beneath both sides).
- **Realized by:** direct implementation (pure slot logic in `model.js` + one button; no new
  architecture)
- **Source:** the owner: "can i have a switch in the app to switch from local to not local" +
  "do anything we need to keep it out of cost since this is a proto".

## 1. Statement

The toolbar gains a **⇄ quick-switch** that flips the companion between the last saved **local**
config (Ollama / LM Studio on this machine — free) and the last saved **hosted** config (a pasted
key — potentially metered), with no re-typing and no re-pasting. The app remembers one config per
class in local storage; saving a config in Model setup files it into its slot automatically.

## 2. Rationale

The prototype must run at zero cost by default. Hosting is already free (static PWA) and the
companion has free tiers (local runtimes, Groq/Gemini free keys, the offline digest) — the one
place money can leak is a paid key left active out of convenience because switching away means
re-typing an endpoint. Making "go local/free" one click removes that friction in both directions.

## 3. Acceptance criteria

- **AC1 — One-click flip.** With both a local and a hosted config saved, a toolbar button
  labelled with the TARGET side ("⇄ Local model" / "⇄ Hosted model") switches the active config
  and persists the choice; the companion status reflects it immediately.
- **AC2 — No re-pasting.** Flipping restores the saved config whole (endpoint, model, key) —
  the visitor never re-enters a key to come back.
- **AC3 — Honest visibility.** The button is hidden until a config exists on the other side;
  it never offers a corrupt or unusable slot. From offline it prefers the free (local) slot.
- **AC4 — Same trust boundary.** Slots live only in this browser's storage, are never synced,
  never in the CRDT, and keys still only ride the request the active config builds (R-0007 AC5).
- **AC5 — Pure + tested.** Classification (`isLocalConfig`), slot filing (`rememberSlot`) and
  flip selection (`flipTarget`) are pure functions in `model.js` with unit tests (including the
  localhost-look-alike host and corrupt-slot cases); main.js only wires storage + the button.

## 4. Constraints & non-goals

Non-goals (follow-ups): more than two slots (per-provider key memory); auto-flip on
network loss (the offline digest already catches that); surfacing per-request cost estimates.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-08 | Two slots (local/hosted), not per-provider memory | The owner's ask is the local⇄paid axis; two slots keep storage and UI trivially auditable |
| 2026-07-08 | "Local" = endpoint host on this machine (localhost/127.0.0.1/[::1]/0.0.0.0) | Exact-host classification, mirroring the exact-host rule the Anthropic CORS header uses — no substring look-alikes |
| 2026-07-08 | Offline flips to the LOCAL slot first | Cost posture: from $0 the switch should land on the side that stays $0 |

## Changelog

- 2026-07-08 created (Accepted) + implemented — slots + toolbar flip; pre-existing configs are
  adopted into their slot on first boot so the switch works retroactively.
