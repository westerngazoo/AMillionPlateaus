# OpenXR interaction map — VR controls & flat-3D fallbacks

- **Status:** Design sketch (pre-implementation) for SPEC-0025 **AC4** (embodied navigation).
- **Author:** Gustavo Delgadillo (with Claude)
- **Created:** 2026-07-03
- **Realizes:** SPEC-0025 §2.3 (XR rig), §2.6 (navigation & presence), R-0025 AC4/AC6.
- **Module(s):** `apps/godot/` — the `XROrigin3D` rig + a Godot **OpenXR action map**
  (`openxr_action_map.tres`) + input handlers, over the existing `world.gd`/`fly_camera.gd`
  affordances. **No core change.**
- **Unblocks:** Track A7 (OpenXR rig — enable when OpenXR init succeeds).

---

## 1. Goal & principles

Map VR controller actions onto the scene affordances that already exist in flat-3D
(`world.gd` plateau picking + focus lens; `fly_camera.gd` free-fly), and give every VR action a
**flat-3D fallback** so the same scene is usable with no headset (AC6).

Principles (from R-0025 §4 / SPEC-0025 §2.6):

- **Hardware-agnostic via OpenXR.** Bind actions to OpenXR **action sets** mapped across
  interaction profiles (Quest/Touch, Index, WMR, …) — no single-vendor SDK. Godot's
  `OpenXRInterface` + an action-map resource is the mechanism.
- **Teleport-first, comfort-first.** Teleport is the default locomotion (lowest motion
  sickness); smooth-fly is opt-in with a comfort vignette; snap-turn by default. Seated-friendly
  default, room-scale supported.
- **Read & study, not author.** No in-VR plateau/bridge authoring (non-goal); interactions are
  navigate + focus + study + vote.
- **The XR rig only enters when OpenXR initializes** (`world.gd` already gates on the native
  binding; the rig mirrors that): `XRServer.find_interface("OpenXR").is_initialized()` →
  enable `XROrigin3D`/`XRCamera3D`/two `XRController3D`; otherwise the plain `Camera3D` +
  `fly_camera.gd` path stays active.

---

## 2. Action map (intent → VR binding → scene affordance → flat-3D fallback)

| Intent | OpenXR action (type) | Typical binding | Scene affordance | Flat-3D fallback |
|--------|----------------------|-----------------|------------------|------------------|
| **Point / aim** | `aim_pose` (pose) + a rendered ray | controller aim pose | Laser pointer; hover-highlights the plateau / resource / panel control under the ray | Mouse position → camera ray (`project_ray_*`) |
| **Select / focus** | `select` (bool) | trigger click | `world.gd::_pick_plateau` → set focus lens + open the study panel | Left-click (existing) |
| **Teleport** | `teleport` (bool) + `aim_pose` | thumbstick-forward or grip, release to commit | Arc ray → floor/plateau; on release lerp `XROrigin3D` to the target | `WASD` move (`fly_camera.gd`) |
| **Smooth-fly (opt-in)** | `move` (Vector2) | left thumbstick | Continuous glide along aim/head, **comfort vignette** while moving | `WASD` + wheel dolly |
| **Snap / smooth turn** | `turn` (Vector2.x) | right thumbstick X | Snap-turn (default) or smooth-turn the rig | Right-drag look (`fly_camera.gd`) |
| **Travel-to-plateau** | `travel` (bool) | A / X button while a plateau is aimed | The 3D `centerOn` (R-0019): lerp the rig to the plateau **and sign a traversal** (`sign_traversal`, earns reach) | Double-click a plateau / a "travel" affordance |
| **Grab / reposition** | `grab` (bool) | grip | Grab-pull to drag the world closer, or reposition the worldspace study panel | Wheel dolly / right-drag (`fly_camera.gd`) |
| **Vote** | reuse `select` on the panel | trigger on the ▲ control | `GraphSource.vote(resource, wizard, weight)` (study panel §3.2) | Click the vote control |
| **Open / close study** | reuse `select` | trigger on plateau / on ✕ | Study panel open/close (see study-panel design) | Click |
| **Toggle lens mode** | `menu` (bool) or a panel toggle | menu button | Flip `world.gd::_lens_mode` (focus dim on/off) | Key |
| **Recenter / reset view** | `recenter` (bool) | long-press menu | `XRServer.center_on_hmd` + reframe (`world.gd::_frame_camera`) | Key |

`vote`, `open/close`, and `select/focus` deliberately reuse the **one** `select` action on
whatever the ray targets (plateau vs. panel control) — fewer bindings, consistent mental model.

---

## 3. Controller layout (typical, ASCII)

Two-controller default (bindings are per-profile in the action map; this is the Touch-style
reference):

```
        LEFT controller                         RIGHT controller
   ┌───────────────────────┐              ┌───────────────────────┐
   │  menu ▸ lens / recenter│              │  A/X ▸ travel-to-plateau│
   │                        │              │                        │
   │  ◉ thumbstick          │              │  ◉ thumbstick          │
   │     ▸ smooth-fly (opt) │              │     X ▸ snap/smooth turn│
   │     fwd ▸ teleport aim │              │                        │
   │                        │              │  ⟟ aim ray (point)     │
   │  ⟟ aim ray (point)     │              │  ⊟ trigger ▸ SELECT     │
   │  ⊟ trigger ▸ SELECT     │              │       (focus/vote/open)│
   │  ✊ grip ▸ grab/teleport │              │  ✊ grip ▸ grab          │
   └───────────────────────┘              └───────────────────────┘
```

Either controller can point + select (dominant hand is a preference). Locomotion defaults to
the **left** stick (teleport/fly), turning to the **right** stick (snap by default).

---

## 4. Comfort & accessibility (first-class, R-0025 §5)

- **Teleport is default**; smooth-fly is opt-in in settings.
- **Comfort vignette** tunnels the view during smooth-fly / continuous turn.
- **Snap-turn** by default (configurable angle); smooth-turn opt-in.
- **Seated default**, room-scale supported; **recenter** rebinds forward to the current HMD.
- Motion-sickness mitigation is a requirement, not a nicety — no forced acceleration, no
  vection-heavy defaults.

---

## 5. Flat-3D fallback (AC6) — no headset

When OpenXR is absent the scene runs exactly as today: plain `Camera3D` + `fly_camera.gd`
(right-drag look · `WASD` move · `E`/`Q` up/down · wheel dolly · `Shift` sprint) and mouse
picking (`world.gd::_pick_plateau`). Every VR intent above has a mouse/keyboard equivalent (the
right-hand column of §2), so the **feature set is identical**; only the input device differs.
The on-screen controls hint already present in flat-3D documents the fallback bindings.

---

## 6. Test handles

- **Pure / headless:** the action-map **resource loads** and the rig **enables/disables**
  cleanly based on a mocked `is_initialized()` — verifiable in the GUT headless runner
  (`test/run_tests.gd`) with **XR disabled**, no headset (the AC6 "flat-3D, no error" smoke).
  Teleport target resolution (aim ray → floor/plateau point) can be a **pure function** over a
  ray + positions, unit-tested like `place_node`.
- **Manual in-headset (AC4):** teleport + travel-to-plateau move the rig, travel signs a
  traversal, presence avatars appear, a vote cast in VR round-trips to the 2D app after sync —
  recorded as manual evidence in SPEC-0025 (like the 2D specs' browser pass).

---

## 7. Notes & dependencies

- **Travel signs a traversal** (`sign_traversal`) — earned reach grows exactly as in the 2D
  app. The **round-trip of that signed event (and of in-world votes) to the 2D client needs the
  native sync transport** (SPEC-0025 §2.9 / Track D → AC7); until it lands, VR-side signs/votes
  are local-preview (same caveat as the study panel). See `docs/SYNC_CONTRACT.md`.
- **Presence** (R-0016) avatars are a **transport** concern, not a `GraphSource`/input method
  (SPEC-0025 §2.6/§2.9); this map covers input only.
- **Non-goals (R-0025 §4):** hand-tracking, haptics beyond basic click feedback, in-VR
  authoring, voice.

---

## 8. Open questions

- **Binding per profile:** which interaction profiles ship in v1 (Quest/Touch + a generic
  fallback), and are the defaults comfortable across them?
- **Teleport vs. travel overlap:** teleport (to a floor/aim point) and travel-to-plateau (lerp
  + sign) are distinct; confirm the two bindings don't confuse (teleport = stick, travel =
  button while aiming a plateau).
- **Dominant-hand config:** expose a left/right pointer preference, or auto-detect?
- **Panel interaction model:** ray-cursor over the `SubViewport` Control vs. poke (near-field
  touch) for the study panel — which reads better? (Ties into the study-panel design.)
