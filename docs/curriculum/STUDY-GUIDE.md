# STUDY GUIDE — driving the fog-world at study pace

How to use the tool as the **first real-life test**: recreating science from the ground
up, one plateau at a time. The level-0 spine is
[lem-free-foundations.md](lem-free-foundations.md); the seeded in-app region is the QC
ground-up rebuild ([curriculum.js](../../apps/web/src/curriculum.js), 22 plateaus /
28 bridges across the Classical ↔ Intuitionistic fork). The roadmap is a *living*
level of main topics — *never* the final list.

## 0. Launch

```
cd apps/web && python3 -m http.server 8145     # then open http://localhost:8145
```
(First time after a Rust change: `cd crates/mp-wasm && wasm-pack build --target web
--out-dir ../../apps/web/pkg`.)

## 1. Pick your lens

Choose **The Logician** (classical branch: LEM · ZFC · hyperreals → measured physics)
or **The Constructivist** (intuitionistic branch: topos · SIA → build-the-witness) —
or *Build your own* and add lenses (R-0038). The lens only orients where you wake up;
every topic stays explorable.

## 2. The study loop (per plateau)

1. **Travel** → pick the topic → the camera centers it.
2. **Click it** → the detail drawer; **Read** → the full Markdown + KaTeX body (each
   curriculum plateau ships its concept + an *embedded-systems analogy* + a
   **deliverable**).
3. **Study the resources** (ranked by stones; add your own as you find better ones —
   they persist and sync).
4. **Do the deliverable.** Then close the topic honestly:
   - *Solve it* — CAS-checked answers (R-0034, deterministic, offline), or
   - *Prove it* — AI-checked proof (R-0032, needs a model in "Model setup"), or
   - self-tested **Mark as mastered** (R-0030).
5. Mastery signs a `KIND_MASTERY` event → the map colors your progress (R-0033); keep
   or publish proofs deliberately (R-0036).

## 3. When you hit a gap — the flexible rule

The roadmap must bend to your actual study. When a step assumes something you don't
have (e.g. "Ostrowski" assumes valuations, "Topos" assumes categories):

1. **Draft a plateau** for the missing subtopic — name it, place it near its region
   (the sliders are the Formal/Empirical/Creative direction), write a body.
2. **Draft a bridge** from it to the blocked topic (concept = what it unblocks).
3. Go study the new plateau to mastery; come back along the bridge.

Nothing is lost: authored plateaus persist (IndexedDB), sync P2P, and carry their own
domain for reputation. The level-0 spine stays clean because detail lives *next to*
the main journey, not inside it.

## 4. Zooming in and out — level-of-detail roadmaps (planned)

What exists today: **map zoom + label level-of-detail** (R-0024) and **progress
coloring** (R-0033) — zoom out to see where you stand across the whole journey; zoom
in to a cluster to see its labels.

What's planned (tracked, not yet built): **LOD roadmaps** — a plateau can *expand*
into its own sub-roadmap (a nested region of micro-plateaus) so you can zoom INTO a
main topic and see the detailed route through it, then collapse back to level 0 to see
where you stand on the main journey and which obviated foundations you still owe.
This rides the same geometry (a sub-region is just plateaus placed near the parent's
position; the parent's domain plane, RFC-0002, is fit from them) and the paths work
(R-0039 — a sub-roadmap is a path at a finer level). See the GitHub issue for the
requirement.

## 5. Study cadence that matches the SDLC

You are the first user, so the tool adjusts as you study:

- A missing capability while studying → say it in-session → it becomes an
  R-requirement → spec → dev-team issue (the working loop in
  [BACKLOG.md](../BACKLOG.md)).
- A missing *topic* → don't wait for anyone: draft the plateau (§3) and keep moving.
- Weekly: zoom out, check the progress colors against the sequence gates in
  [lem-free-foundations.md](lem-free-foundations.md) (§Sequence), and let the
  companion (grounded in what's actually in reach) suggest the next step.
