# R-0103 — Which lens does this fit?

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0079](0079-capture-topic.md) (⚡ Capture), [R-0069](0069-where-does-this-fit.md) (hand-off routing), [R-0073](0073-handoff-context.md) (prompt-carrying hand-off)

## Why

When you capture a topic that isn't on the map yet — the owner's example was
**"reflections"** — the honest answer to "where does it belong?" is often *several
lenses at once*: a reflection is a versor sandwich in **Geometric Algebra**, an
isometry in **Euclidean geometry**, and a projection in **vector geometry**. But
Capture (R-0079) silently filed every new topic under the single busiest island
(`dominantDomain`) and never told you which lenses it touched or why. So you
couldn't tell whether "reflections" related to GA, Euclidean, or vector geometry —
you just got one guess with no reasoning.

## What

A **🧭 "Which lens does it fit?"** panel inside Capture, above the neighbour
checkboxes, shown the moment the topic name is real:

1. **A ranked list of candidate lenses**, each with the matching topics as
   **evidence** (e.g. *Geometric Algebra — Rotors, GA view: Óptica…*), built by
   grouping the existing keyword-matched neighbours by lens.
2. **A plain-language verdict** that is honest about the cross-lens case:
   - *single* — one lens, nothing else of note;
   - *primary* — "Mostly Geometric Algebra — also touches Euclidean, vector geometry"
     (a clear leader, but the other lenses named);
   - *span* — "Spans GA, Euclidean, and vector geometry — a cross-lens idea. Home it
     in one; you can bridge it into the others." (comparable lenses);
   - *none* — "Nothing in your graph matches yet — ask your model, or pick a lens."
3. **A model hand-off** — *Which lens? Ask NotebookLM / Gemini / AI Studio* — that
   builds a prompt listing YOUR lenses and the nearby topics and asks the model
   which lens(es) it belongs to and which topics to connect. This is the conceptual
   call keyword-matching can't make (it knows a reflection is a GA versor even when
   no GA topic spells the word).

Offline heuristic (instant, from your own graph) + model hand-off (the deep call) —
the same two-tier pattern as R-0069/R-0070.

## Acceptance criteria

1. **AC1 — lenses ranked with evidence.** `rankLenses` sums neighbour score per
   lens and keeps the matching topic names; best lens first.
2. **AC2 — honest verdict.** `fitVerdict` returns `single` / `primary` / `span` /
   `none`; the cross-lens case (comparable lenses) reads as a cross-lens idea, and a
   clear leader still names the other touched lenses.
3. **AC3 — model hand-off carries context.** `lensFitPrompt` names your lenses, the
   nearby topics per lens, and asks the which-lens + which-connections question; the
   Capture buttons open each target with it prefilled (and copy it).
4. **AC4 — shown whenever the name is real.** The panel appears once the name is
   ≥3 chars, including when zero topics match (the `none` verdict points at the
   model); hidden otherwise.
5. **AC5 — no behaviour regression.** Capturing still works exactly as before; the
   final domain is still the ticked-neighbour `dominantDomain` — the panel informs
   the choice, it doesn't change the wiring.

## Notes

- Pure additions to `capture.js` (`rankLenses`, `fitVerdict`, `lensFitPrompt`);
  7 new unit tests in `capture.test.mjs`. UI wiring in `main.js` reuses
  `HANDOFF_TARGETS` / `handoffOpenUrl` / `copyToClipboard`.
- Full web suite 660/660; live-verified in a browser (main.js parses; typing
  "Reflections" surfaces the GA evidence rows + the three ask-model targets).
- **Follow-up (parked):** multi-home a genuinely cross-lens topic — create linked
  "alternative formulation of" twins across the chosen lenses in one step (the
  GA/SIA twin pattern), instead of homing in one and bridging manually.
