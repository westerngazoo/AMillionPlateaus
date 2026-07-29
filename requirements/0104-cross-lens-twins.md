# R-0104 — A cross-lens topic becomes linked twins

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0103](0103-which-lens.md) (which lens does this fit?), [R-0097](0097-parallel-view.md) (parallel view), [R-0079](0079-capture-topic.md) (⚡ Capture)

## Why

R-0103 answers *"does 'reflections' belong to GA, Euclidean, or vector geometry?"* —
and its honest answer is often **all of them**: the same idea seen through different
formalisms (a versor sandwich, an isometry, a projection). But the verdict was only
advice. You still had to home the topic in one lens, then hand-build a sibling in
each other lens and hand-draw the bridges between them.

The owner already has exactly this structure seeded — the GA/SIA twins over their
physics degree (R-0096/R-0098), joined by `alternative formulation of`, which is
what lets parallel view (R-0097) walk two formalisms side by side. Capture had no
way to *create* that structure. Confirming "yeah, spans three lenses" should be
one tap, not a manual afternoon.

## What

When the fit verdict names more than one lens, Capture offers each **other** lens as
a tickable **twin**:

- Each ticked lens mints its own plateau named by the seeded convention —
  `GA view: Reflections`, `Euclidean view: Reflections` — placed on **that lens's own
  anchor** (deterministically nudged from the twin's name, so twins never stack).
- Each twin is bridged to the primary with **`TWIN_CONCEPT` = "alternative
  formulation of"** — the same relation the seeded pairs use, so **parallel view
  immediately walks across them**.
- The twin's body states plainly that it is the same idea seen through that lens,
  and asks the question that makes the twin worth having: what object does this lens
  use, what operation acts, and what becomes obvious here that was hidden in the
  primary.
- Because twins are defined *relative to a home*, ticking any twin **homes the
  primary in the lens the verdict named** — otherwise the primary could land
  elsewhere (the persona fallback) and we'd mint a `"<that lens> view:"` twin sitting
  in the primary's own domain. The plan is re-derived against the resolved home, so a
  lens that turns out to *be* the home is dropped rather than twinned with itself.

## Acceptance criteria

1. **AC1 — offered only when it's really cross-lens.** Twin rows appear only for
   lenses the verdict named beyond the leader; a single-lens verdict offers none.
2. **AC2 — seeded naming.** A twin is `"<Short> view: <name>"`, using the
   established short forms (`GA`, `SIA`) and the label's first word otherwise
   (`Euclidean view: …`).
3. **AC3 — real twin relation.** Every minted twin is bridged to the primary with
   concept `alternative formulation of`, so `twinMap`/parallel view pairs them.
4. **AC4 — own island, no stacking.** A twin is placed on its own lens's canonical
   anchor with a deterministic name-seeded nudge.
5. **AC5 — never a twin of itself.** No minted twin shares the primary's domain;
   ticking twins homes the primary in the verdict's lens.
6. **AC6 — nothing silent.** Twins are opt-in per lens (unticked by default); a
   capture with no ticks behaves exactly as R-0079 did.

## Notes

- Pure helpers in `capture.js` (`lensShort`, `twinName`, `twinBody`, `twinPlan`);
  minting + bridging in `main.js`. 6 new unit tests (incl. an AC5 regression test);
  full web suite 666/666.
- Verified end-to-end in a browser against the **persisted CRDT snapshot**: capturing
  "Integration" with both twins ticked produced `Integration` in Physics plus
  `Mathematics view: Integration` and `SIA view: Integration` in their own domains,
  each joined by `alternative formulation of`, with no same-domain violation.
- AC5 was found *by* that verification, not by the unit tests — the first pass planned
  twins against the verdict's leader while the create path resolved a different home.
