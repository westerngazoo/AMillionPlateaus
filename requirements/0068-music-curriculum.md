# R-0068 — The detailed Music-theory curriculum (Composer lens)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0065 (the lens → "Your path" mechanism + `DOMAIN_PATH_OF`), R-0067 (the Math
  precedent this mirrors exactly), R-0060/R-0063/R-0064 (each topic is a real plateau → Teach-me /
  progress / Continue), R-0027 (seeded resources).
- **Realized by:** direct implementation — a pure `music-curriculum.js` data module + its integrity
  test, seeded and wired into `DOMAIN_PATH_OF` by main.js.
- **Source:** the owner: picking a lens must open a **numbered, detailed** curriculum from an
  official source — confirmed **seed the curricula**, **all core lenses**. This is the **Music**
  slice, the last bare core lens (the Composer had only 4 description-less seed plateaus, no path).

## 1. Statement

Music gets a **detailed, numbered, followable curriculum** — the standard music-theory sequence:
pitch & the keyboard → notation (staff, clefs) → rhythm & meter → scales, keys & modes → intervals →
triads & chord qualities → diatonic harmony & Roman numerals → progressions & cadences → seventh
chords & non-chord tones → melody → voice-leading → modulation → form → counterpoint. Fifteen new
plateaus (plus the seed **Rhythm** trailhead they thread out of) form **The Music Theory Core** path,
which the Composer lens surfaces as its numbered "Your path" (R-0065). Each topic is a real plateau
with a source-grounded body, so ▶ Teach me, Resume, and Continue all work on it.

With this, **every content domain now has a detailed numbered curriculum** — the "all core lenses"
scope is complete (Physics R-0066, Math R-0067, Music R-0068; Classical/Intuitionistic/Computation/
GA/SIA already had rich curricula surfaced by R-0065).

## 2. Rationale

R-0067 deepened Mathematics; Music was the only remaining bare core lens — the Composer landed on
four description-less pillars (Rhythm/Melody/Harmony/Counterpoint) with no path. Seeding the theory
sequence completes the "pick any core lens → numbered detailed curriculum" promise. Music theory has
a clean, well-agreed canonical order (the one musictheory.net / Open Music Theory teach), which makes
it a natural, high-value seed — offline, no model key, the owner's explicit choice.

## 3. Acceptance criteria

- **AC1 — A numbered music path.** `MUSIC_PATH` ("The Music Theory Core") sequences the seed Rhythm
  trailhead + 15 new topics in learning order; `DOMAIN_PATH_OF[MUSIC_DOMAIN]` points at it so the
  Composer lens opens it as a numbered "Your path".
- **AC2 — Detailed, source-grounded topics.** Each of the 15 plateaus has a real body (the idea + a
  concrete example), a **Deliverable**, and a **Study (official)** pointer to musictheory.net / Open
  Music Theory / Khan (/ Fux for counterpoint).
- **AC3 — Real plateaus, wired in.** Topics seed as MUSIC_DOMAIN plateaus (e3-dominant, the CREATIVE
  axis; Grade-1) with a prerequisite bridge spine (and a link from the seed Rhythm trailhead); they
  participate in the seed loops, so Teach-me / progress / Continue work on them.
- **AC4 — Official references seeded.** Canonical free resources (musictheory.net, Open Music Theory,
  Khan Music, Fux) attach to the right plateaus (R-0027 shape).
- **AC5 — Additive, no collisions, tested.** New ids live in a reserved MUSIC namespace (plateaus
  f0…, bridges f1…, resources f2…, path f3…); nothing existing is redefined; `apps/web` only, no
  core/Rust/wasm change. A sibling `music-curriculum.test.mjs` asserts uuid validity, global
  uniqueness (vs seeds/QC/CS/phys-lens/phys-core/math), namespaces, e3-dominant Grade-1 coords,
  source-grounded bodies, and path/bridge/resource resolution.

## 4. Constraints & non-goals

- **Seed, don't fetch** — bodies are authored (grounded in the official sequences); no runtime scrape
  (offline-first, CSP).
- **Reference the seed Rhythm pillar, don't redefine it** — threaded into as the trailhead (like
  Arithmetic in R-0067 / Motion in R-0066); the other seed pillars are superseded by the new detailed
  topics rather than reused (reusing their ids would trip the collision test).
- **Non-goals (follow-ups):** giving the bare seed pillars their own bodies; the Polymath lens
  (Math×Music) beyond its first faced domain; audio/interactive examples (staff renderers, playback)
  inside topic bodies; a course table-of-contents beyond the "Your path" panel.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Self-contained new topics in an `f…` namespace, mirroring R-0067's `e…` for Math | Consistency across the curriculum slices; reserved ranges keep the id space legible and the grand-union test simple. |
| 2026-07-16 | e3-dominant coords for every topic, incl. the theoretical ones (voice-leading, counterpoint) | Music is the CREATIVE axis; even its formal end stays e3-dominant so the topics cluster in the Music region and clear fog on that axis. |
| 2026-07-16 | ~15 topics, pitch/notation → harmony → form/counterpoint | The standard theory-1/2 sequence a learner completes; deep enough to be "not general", bounded enough to review in one PR. |

## Changelog

- 2026-07-16 created (Accepted) + implemented — `music-curriculum.js`: 15 detailed, source-grounded
  MUSIC plateaus + a 16-step "The Music Theory Core" path + prereq bridges + musictheory.net / Open
  Music Theory / Khan / Fux resources, wired into the seed loops and `DOMAIN_PATH_OF[MUSIC_DOMAIN]`.
  Added `music-curriculum.test.mjs` (6 new cases; full suite 500/500). Global integrity check clean
  (111 plateaus / 139 bridges / 34 resources / 6 paths, zero collisions/dangling). Live-verified: the
  Composer lens opens "The Music Theory Core" (16 numbered topics, "0 of 16 studied", ▶ Start here); a
  row opens the detailed topic (Diatonic Harmony & Roman Numerals) with the R-0063 course line +
  R-0064 Continue live; +15 topics seeded, no console errors. **Completes "all core lenses."**
