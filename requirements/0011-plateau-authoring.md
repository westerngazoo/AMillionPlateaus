# R-0011 — Plateau Authoring: draft new knowledge nodes into the fog-world

- **Status:** Met
- **Milestone:** POC — Draft DB
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** R-0005 (fog-world + BroadcastChannel sync), R-0008 (domain-agnostic graph), R-0010 (wizard identity)
- **Realized by:** SPEC-0011 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The fog-world is currently frozen: all plateau nodes are seeded in Rust at
build time. A wizard cannot grow the world. This requirement lets a wizard
**author a new plateau node** through the web UI: give it a name, place it in
an existing domain, and orient it in GA space. The new plateau enters the
shared Automerge CRDT doc, syncs to every other open tab, and immediately
appears in the fog-world subject to the normal fog/reachability rules. (Durable
persistence across a full close/reload is **not** part of this POC — see AC3 —
because the browser build cannot link redb; that is R-0012.)

The authoring form replaces the existing crude stub ("Add a plateau (syncs)"
button, which today generates a random position and a generic name). The stub
already proves the plumbing works (WASM `add_plateau` → CRDT → BroadcastChannel
→ render); this requirement adds the user-facing interface and the pure tested
factory that drives it.

## 2. Rationale

Every requirement so far has added a feature *on top of* a static, seeded
world. To realize the vision of a user-grown knowledge graph, someone must be
able to add to it. Plateau authoring is the minimum viable "write" operation:
before bridges, resources, or votes, a new node must exist. It is also the
natural first deliverable of the "Draft DB" incremental POC roadmap, because:

- The WASM and CRDT plumbing are proven end-to-end (R-0003, R-0004, R-0005).
- No new Rust code is needed — `WasmCrdtDoc::add_plateau` already accepts
  `(name, domain_id, e1, e2, e3)`.
- The authoring pattern mirrors the already-audited `authorPersona` (R-0009):
  a pure JS factory, human-labeled controls, no raw blade indices in the UI.

## 3. Acceptance criteria

- **AC1 — Plateau authoring form.** Alongside (or replacing) the stub "Add"
  button, there is a **"Draft Plateau" form** with three controls:
  - A **name** text input (trimmed; falls back to `"Untitled Plateau"` if blank).
  - A **domain** select populated from the existing `DOMAINS` list in
    `persona.js` (Mathematics, Music). No new domains.
  - A **position** composed of three sliders representing the grade-1 GA axes
    under **human labels** — `Formal`, `Empirical`, `Creative` (i.e. e1, e2, e3
    respectively, per `AXES` in `persona.js`). Raw blade indices never appear
    in the UI.
  - A **submit** button that creates the plateau.

- **AC2 — New plateau appears in the fog-world.** On submit, the drafted plateau
  renders on the map immediately (same frame as `draw()`). Its fog/reachability
  state follows the wizard's current reputation: a plateau authored in
  Mathematics is only reachable from a Math-oriented wizard, consistent with
  domain-scoped fog (R-0005 AC3).

- **AC3 — Lives for the session and converges across open tabs.** A drafted
  plateau is held in the in-memory CRDT doc and propagates to every other open
  tab via BroadcastChannel (AC4). It is **not** durable across a full
  close/reload when no other tab is open: the browser build compiles redb out of
  `mp-wasm` (redb does not target wasm32), and `WasmCrdtDoc` exposes no
  save/load yet. Durable cross-reload persistence (an IndexedDB snapshot of the
  CRDT doc) is explicitly **R-0012**; this POC does not claim it.

- **AC4 — Syncs across tabs.** The drafted plateau propagates to all other open
  tabs via the existing `BroadcastChannel` CRDT sync path (R-0005 AC6) with no
  change to the sync protocol. Opening a second tab after authoring converges to
  include the new plateau.

- **AC5 — Zero-vector guard.** If the wizard submits with all three position
  sliders at zero (an all-zero grade-1 vector), the form does not submit a
  degenerate node; it either snaps one axis to a small non-zero default or shows
  an inline error. No invalid / unreachable-forever plateau is silently created.

- **AC6 — Pure `buildPlateau` factory, unit-tested.** A new `plateau.js` module
  exports a pure `buildPlateau({ name, domain, e1, e2, e3 })` function that
  validates and normalises inputs (trim name, apply fallback, return `null` on
  all-zero direction or unknown domain) and returns the argument shape
  `wasm.add_plateau()` accepts. Tested via `node --test`, no WASM dependency:
  - deterministic output for the same inputs,
  - name trim + blank fallback,
  - all-zero direction → `null`,
  - unknown domain id → `null`.

- **AC7 — Wizard attribution (deferred to R-0012).** `WasmCrdtDoc::add_plateau`
  does not accept a `created_by` argument in its current Rust signature. Threading
  the pubkey through the CRDT field requires a Rust change and is therefore
  scoped to R-0012 (bridge authoring events, which will also add a signed
  `create-plateau` Nostr event). This POC records the plateau without attribution;
  the wizard's pubkey is available from `identity.js` for R-0012 to use.

- **AC8 — Green across all suites.** `cargo test --workspace`, `wasm-pack test
  --node`, `node --test apps/web/src/*.test.mjs`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt --all --check` all green. Page loads and authors a
  plateau with no uncaught console errors.

## 4. Constraints & non-goals

- **No new Rust code.** The existing `WasmCrdtDoc::add_plateau(name, domain_id,
  e1, e2, e3)` WASM binding is the only write path. No changes to `mp-graph`,
  `mp-crdt`, `mp-wasm`, or `mp-identity`.
- **Existing domains only.** Authoring is bounded to the two seeded domains
  (Mathematics, Music). Adding new domains is a separate, later requirement.
- **Create-only.** No delete or edit of authored plateaus this POC.
- **No bridge authoring.** A bridge between the new plateau and an existing one
  is a separate requirement (R-0012).
- **No Nostr signing of the create-plateau action.** The event-log signs
  traversals and vouches (R-0010); signing authorship events is future work.
- **No 3D / avatar / cosmetic changes.** Phase 6/9.

## 5. Open questions

- Should authored plateaus be visually distinguished from seeded ones (e.g. a
  dashed border, an "authored" tag)? Helpful for debugging; cosmetic choice.
- Should the position sliders default to a random non-zero value (more
  discoverable) or all-0.5 (predictable)? The spec should decide.
- Should the form be a persistent side-panel or a modal triggered by a button?

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Replace the existing random-plateau stub with a proper authoring form | The stub proves the plumbing; this requirement gives wizards actual control |
| 2026-06-02 | No new Rust — use existing `WasmCrdtDoc::add_plateau` | The WASM binding already accepts (name, domain_id, e1, e2, e3); zero new crate surface |
| 2026-06-02 | Existing domains only | New domain creation involves seeding new GA clusters; out of scope for this POC |

## Changelog

- 2026-06-02 created (Draft) — pending SPEC-0011 + architect design review, then acceptance.
- 2026-06-02 **AC3 corrected.** The original AC3 claimed drafted plateaus
  "persist across reloads via existing redb persistence" — false: redb does not
  build for wasm32 and is compiled out of `mp-wasm`, and `WasmCrdtDoc` exposes no
  save/load. AC3 now scopes R-0011 to session + cross-tab convergence; durable
  cross-reload persistence is carved out to R-0012 (IndexedDB snapshot).
- 2026-06-02 implemented (commit d96900e) and **QA sign-off → PASS** (all AC1–AC8
  met; 80 JS + 100 Rust tests, clippy host+wasm32, fmt all green; browser-level
  ACs verified by inspection + the pure-factory tests). **Status → Met.**
