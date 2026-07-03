# Godot worldspace study panel — wireframe & interaction notes

- **Status:** Design sketch (pre-implementation) for SPEC-0025 **AC5** (study in-world).
- **Author:** Gustavo Delgadillo (with Claude)
- **Created:** 2026-07-03
- **Realizes:** SPEC-0025 §2.7 (worldspace study), R-0025 AC5; R-0020/R-0023 (plateau body +
  stone-ranked resources) as the source of truth.
- **Module(s):** `apps/godot/` (new `StudyPanel.tscn` + `study_panel.gd`), reads via the
  `GraphSource` interface. **No core change.**
- **Unblocks:** Track A8 (worldspace study panel).

---

## 1. Goal & scope

When a wizard focuses a plateau in the 3D world, surface that plateau's **description** and its
**stone-ranked resources** on an in-world panel, without leaving immersive mode (AC5). This is
a **read + light-interaction** surface, not an authoring surface: the web 2D study view stays
the place you write bodies, run proofs/CAS drills, and add resources with forms (§4). R-0025
is explicit: *read & study first, no in-VR authoring* (non-goal §4).

Data comes from the `GraphSource` DTOs already defined (SPEC-0025 §2.2):

- `PlateauDto { id, name, description, domain_id, position }` — the panel header + body.
- `ResourceDto { id, plateau_id, title, kind, uri, state, vote_count }` — the ranked list.

"Stone-ranked" = ordered by the R-0023 ranking (higher `vote_count` first; `state` shows how
crystallized a resource is — floating → crystallized, R-0015).

---

## 2. Trigger & placement

- **Open:** focusing a plateau (the existing left-click / controller **select** pick in
  `world.gd::_pick_plateau`) opens the panel for that plateau id. In VR the same select action
  (see `docs/design/openxr-interactions.md`) opens it.
- **Placement:** a worldspace panel anchored **beside the focused plateau** (offset toward the
  camera/rig, billboarded to face the viewer), so the plateau stays visible behind it. In
  flat-3D it may instead dock as a screen-space overlay (§5).
- **Close:** select the same plateau again, select empty space, or a **✕** on the panel; the
  focus lens returns to the plain map.
- **One at a time:** focusing another plateau replaces the panel's contents (re-uses one
  instance), matching the single-focus lens model in `world.gd`.

---

## 3. Wireframe (worldspace panel)

```
        ┌─────────────────────────────────────────────────────────┐
        │  CALCULUS                                    ● Math    ✕  │   ← name + domain chip + close
        ├─────────────────────────────────────────────────────────┤
        │                                                           │
        │  The study of continuous change — limits, derivatives,    │   ← description
        │  integrals. Grounds motion in physics and underlies       │     (plain/source text in v1;
        │  optimization across the sciences.                        │      Markdown/KaTeX = sub-spec §6)
        │                                                           │
        │  Reach: ●●●○  lit                                         │   ← fog/reach state (read-only)
        ├─────────────────────────────────────────────────────────┤
        │  RESOURCES                                    stone-ranked │
        │                                                           │
        │  ◆ Spivak — Calculus                    ▲ 12   [ crystal ]│   ← ◆/◇ = state, ▲ vote, chip=state
        │      article · spivak.example/…                    [open] │
        │                                                           │
        │  ◆ 3Blue1Brown — Essence of Calculus    ▲  8   [ placed  ]│
        │      video · youtube.example/…                     [open] │
        │                                                           │
        │  ◇ Paul's Online Notes                  ▲  2   [ floating]│
        │      article · tutorial.example/…                  [open] │
        │                                                           │
        │  … (scroll for more) …                                    │
        ├─────────────────────────────────────────────────────────┤
        │  [ ▲ Vote on selected ]   [ + Add resource → 2D ]  [ Ask ]│   ← action bar (§3.2)
        └─────────────────────────────────────────────────────────┘
```

### 3.1 Regions

| Region | Source | Notes |
|--------|--------|-------|
| Header | `PlateauDto.name`, `domain_id` | Domain chip color mirrors the 2D domain palette (A3) |
| Description | `PlateauDto.description` | v1 plain/source text; rich Markdown/KaTeX deferred (§6) |
| Reach line | the fog `reachable` set (`GraphSource.reachable`) | Read-only echo of the world lighting; no recompute |
| Resource row | `ResourceDto` | `title`, `kind` (article/video/…), `uri` (host elided), `vote_count`, `state` |
| Action bar | `GraphSource` write methods | Vote in-world; Add routes to 2D; Ask opens the companion prompt |

### 3.2 Actions

- **Vote (▲):** select a resource row, cast a vote via `GraphSource.vote(resource, wizard,
  weight)`. Optimistically reflect the new `vote_count`/`state`; the vote is a signed/CRDT edit
  whose **round-trip to the 2D app requires the sync transport** (SPEC-0025 §2.9 / Track D →
  AC7) — until that lands, treat in-world votes as local-preview and flag it in the UI
  (Track A10 dependency).
- **Add resource:** authoring stays in 2D. The button is a **hand-off** (e.g. "add in the 2D
  map"), not an in-world form — consistent with R-0025's no-in-VR-authoring non-goal.
- **Ask (companion):** opens a compact, plateau-scoped companion prompt so studying doesn't
  require leaving immersive mode (AC5 "the companion stays reachable"). The companion call is a
  client/transport concern, not a `GraphSource` method.

---

## 4. What stays in web 2D study vs what appears in 3D

| Capability | Web 2D study (R-0020/R-0023) | Godot 3D panel (AC5) |
|------------|------------------------------|----------------------|
| Read the description | ✅ full Markdown + typeset KaTeX | ✅ v1 plain/source; rich rendering = sub-spec (§6) |
| Stone-ranked resources | ✅ full list, ranking, states | ✅ ranked list, vote counts, state chips |
| Open a resource URI | ✅ | ✅ (open externally / flat browser) |
| **Vote** on a resource | ✅ authoritative | ✅ via `GraphSource.vote` (round-trip needs Track D) |
| **Add** a resource (form) | ✅ inline add + multi-pin (R-0028) | ↪ hand-off to 2D (no in-VR authoring) |
| Author/edit the body | ✅ | ❌ (non-goal — read & study first) |
| Proof / CAS drills, "Prove it", mastery gating | ✅ (R-0032/R-0034/R-0030) | ❌ v1 (2D-only; possible later sub-spec) |
| Companion chat | ✅ full | ✅ compact plateau-scoped prompt (reachable, not full authoring UX) |
| Cross-cutting "Also covers" (R-0028) | ✅ | ◻ show as read-only badges if present; editing stays 2D |

**Rule of thumb:** *reading, ranking, opening, and a quick vote/ask* belong in 3D; *writing*
(bodies, resources, proofs) stays in the 2D authoring surface. The 3D panel is a lens onto the
same CRDT/graph, never a second source of truth (CLAUDE.md §6).

---

## 5. Tech & flat-3D fallback

- **Worldspace:** a Godot `Control` (VBox of the regions above) rendered into a `SubViewport`
  on a textured quad (SPEC-0025 §2.7 leaning), billboarded, sized for legibility at reading
  distance. Controller ray or gaze drives a virtual cursor over the Control (see the OpenXR
  interaction map).
- **Flat-3D (no headset, AC6):** the same `Control` may render as a **screen-space overlay
  panel** (docked right) instead of a worldspace quad — the desktop fallback, driven by mouse.
  Either way it reads the identical `GraphSource` DTOs.
- **Scroll:** resources beyond the fold scroll (thumbstick / wheel / drag).
- **Headless test (AC3/AC6 style):** the panel's **pure data assembly** — plateau id →
  `{name, description, ranked resources}` view-model — is unit-testable in the GUT headless
  runner with a fixture `GraphSource`, with no GPU (mirrors the `place_node`/`plan_labels`
  pattern). The rendered quad is covered by the headless scene smoke.

---

## 6. Open questions

- **Rich text fidelity:** Markdown + KaTeX in a `SubViewport` is a deferred sub-spec
  (SPEC-0025 §2.7/§5). v1 shows plain/source. When does rich rendering land, and via what
  (RichTextLabel + a math image pipeline)?
- **Vote round-trip:** in-world votes can't reach the 2D app until the native sync transport
  exists (Track D). Ship vote as local-preview first, or gate the button until Track D?
- **Resource `kind`/`state` vocabulary:** confirm the exact `ResourceKind`/`ResourceState`
  variant set to render icons/chips (source: `mp-domain` `Resource`), so chips match the 2D
  palette.
- **Panel placement in dense clusters:** billboarded worldspace panel vs always screen-space —
  which reads better at the imported-vault density? (Tune with the label declutter, §2.5 of the
  spec.)
