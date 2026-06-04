# SPEC-0014 — Trail Markers: anchor a note/resource to a plateau

- **Status:** Accepted
- **Realizes:** R-0014
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** SPEC-0011 (plateau authoring pattern), SPEC-0012 (durability), SPEC-0013 (bridge authoring), SPEC-0005 (sync + render)
- **Module(s):** `crates/mp-domain/src/types.rs` (`Resource::new`), `crates/mp-wasm/src/lib.rs` (`add_resource` + `WasmGraph::resources`), `crates/mp-wasm/src/convert.rs` (`ResourceDto` + kind parse), `apps/web/src/resource.js` + `resource.test.mjs` (new), `apps/web/src/render.js`, `apps/web/index.html`, `apps/web/src/main.js`

## 1. Motivation

R-0014: let a wizard anchor a marker (a note/resource) to a plateau. The
`Resource` type, the `resources` CRDT map, and `vote`/`resource_vote` already
exist; what is missing is a way to **author** a resource from the browser and to
**render** it. This spec adds a `Resource::new` constructor, a thin
`WasmCrdtDoc::add_resource` binding, a `ResourceDto` + `WasmGraph::resources()`
accessor, marker rendering, and the JS factory+form — mirroring R-0011/R-0013.

## 2. Design

### 2.1 Module layout

```
crates/mp-domain/src/types.rs   ← EDIT  Resource::new(...) constructor (Floating, vote 0)
crates/mp-wasm/src/lib.rs       ← EDIT  WasmCrdtDoc::add_resource(...) + WasmGraph::resources()
crates/mp-wasm/src/convert.rs   ← EDIT  ResourceDto + all_resource_dtos + parse_resource_kind
apps/web/src/resource.js        ← NEW   pure factory buildResource + RESOURCE_KINDS
apps/web/src/resource.test.mjs  ← NEW   node --test; no WASM
apps/web/src/render.js          ← EDIT  draw markers near their anchor plateau
apps/web/src/main.js            ← EDIT  Drop-a-marker form: populate selects, submit
apps/web/index.html             ← EDIT  the marker form markup
```

### 2.2 Rust — constructor + binding + DTO (additive, no GA)

`Resource::new` (types.rs) sets the creation invariants so JS can't pick a state
or a vote count:

```rust
impl Resource {
    /// A freshly contributed resource: Floating, zero votes, unsigned. The id is
    /// engine-assigned; attribution (contributor/signature) is deferred — callers
    /// pass Uuid::nil() this phase (R-0014 AC5).
    pub fn new(plateau_id: PlateauId, title: &str, kind: ResourceKind,
               uri: &str, contributor: WizardId) -> Self {
        Self {
            id: Uuid::new_v4(),
            plateau_id, title: title.to_string(), kind, uri: uri.to_string(),
            contributor, signature: String::new(),
            vote_count: 0.0, state: ResourceState::Floating,
            created_at: now_unix(), // same non-authoritative stamp as PlateauNode::new (0 on wasm32)
        }
    }
}
```

(`created_at` uses the existing `now_unix()` helper for source-consistency with
`PlateauNode::new`; it is `cfg`-gated to `0` on wasm32 — non-authoritative, read
by nothing this phase.)

WASM binding (lib.rs), mirroring `add_plateau`:

```rust
/// Anchor a resource (a trail marker) to an existing plateau, returning its new
/// id. Kind is a label string ("Note", "Article", …) parsed to ResourceKind
/// (unknown → Note). State starts Floating; contributor is nil (attribution
/// deferred, R-0014 AC5). The plateau must exist — a missing anchor is a thrown
/// JsError (server-side AC3 guarantee, mirroring add_bridge's endpoint check).
pub fn add_resource(&mut self, plateau_id: &str, title: &str, kind: &str, uri: &str)
    -> Result<String, JsError> {
    let pid = Uuid::parse_str(plateau_id)?;
    // Reject an orphan anchor up front (mirrors add_bridge), so a marker can
    // never reference a non-existent plateau.
    self.inner.plateau(&pid)?.ok_or_else(|| JsError::new("unknown plateau"))?;
    let r = Resource::new(pid, title, convert::parse_resource_kind(kind), uri, Uuid::nil());
    let id = r.id.to_string();
    self.inner.add_resource(&r)?;
    Ok(id)
}
```

(`CrdtDoc::plateau(&pid) -> Result<Option<PlateauNode>, _>` already exists — the
binding mirrors `add_bridge`'s endpoint validation. Render stays orphan-tolerant
anyway, but this gives AC3 a server-side guarantee, not just a well-formed select.)

DTO + parse (convert.rs). `ResourceKind`/`ResourceState` are unit enums, so serde
serializes each as its variant-name string ("Note", "Floating") — JS reads them
directly:

```rust
#[derive(serde::Serialize)]
pub struct ResourceDto {
    pub id: String,
    pub plateau_id: String,
    pub title: String,
    pub kind: ResourceKind,    // serializes to "Note" etc.
    pub uri: String,
    pub state: ResourceState,  // serializes to "Floating" etc.
    pub vote_count: f32,
}
pub fn resource_dto(r: &Resource) -> ResourceDto { /* field copy, ids to_string */ }
pub fn all_resource_dtos(g: &KnowledgeGraph) -> Vec<ResourceDto> {
    g.resources.values().map(resource_dto).collect()
}
pub fn parse_resource_kind(s: &str) -> ResourceKind {
    match s {
        "Article" => ResourceKind::Article,
        "Video" => ResourceKind::Video,
        "Interactive" => ResourceKind::Interactive,
        "Paper" => ResourceKind::Paper,
        "Tool" => ResourceKind::Tool,
        _ => ResourceKind::Note, // unknown/blank → Note (R-0014 AC3)
    }
}
```

`WasmGraph::resources()` (lib.rs) mirrors `plateaus()`:

```rust
pub fn resources(&self) -> Result<JsValue, JsError> {
    Ok(serde_wasm_bindgen::to_value(&convert::all_resource_dtos(&self.inner))?)
}
```

No change to `root_keys` (resources was always one of the four maps); no GA, no
reputation (AC7).

### 2.3 `resource.js` — pure factory

```js
// resource.js — pure. Validates trail-marker inputs. No WASM, no GA.
export const RESOURCE_KINDS = ["Note", "Article", "Video", "Interactive", "Paper", "Tool"];
export const TITLE_FALLBACK = "Untitled note";

// buildResource({ plateau, title, kind, uri }) → { plateau, title, kind, uri,
// error: null } | { error }. Requires a plateau anchor; title trims to a
// fallback; an unknown/blank kind defaults to "Note"; uri trims, empty allowed.
export function buildResource({ plateau, title, kind, uri } = {}) {
  if (!plateau) return { error: "Pick a plateau to anchor the marker to." };
  return {
    plateau,
    title: (typeof title === "string" ? title.trim() : "") || TITLE_FALLBACK,
    kind: RESOURCE_KINDS.includes(kind) ? kind : "Note",
    uri: typeof uri === "string" ? uri.trim() : "",
    error: null,
  };
}
```

### 2.4 `render.js` — draw markers near their anchor

`render({ plateaus, bridges, reachable, view, resources = [] })` — after the
plateau discs, draw each marker stacked to the right of its anchor:

```js
// Self-contained block: save/restore so the marker loop's font/textAlign/alpha
// never leak into the next frame's plateau/bridge text (render state hygiene).
ctx.save();
ctx.textAlign = "left";
ctx.font = "10px system-ui, sans-serif";
const seen = new Map(); // plateauId → how many markers already placed
for (const r of resources) {
  const pt = points.get(r.plateau_id);
  if (!pt) continue;                       // orphan (anchor gone) → skip
  const i = seen.get(r.plateau_id) ?? 0;
  seen.set(r.plateau_id, i + 1);
  const mx = pt.x + RADIUS + 10;
  const my = pt.y - RADIUS + i * 14;
  ctx.globalAlpha = r.state === "Crystallized" ? 1 : 0.6; // Floating is faint
  ctx.fillStyle = "#7fd0a0";
  ctx.beginPath();
  ctx.arc(mx, my, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = LABEL;
  ctx.fillText(r.title, mx + 8, my + 3);
}
ctx.restore();
```

Markers draw after plateaus so they sit on top; the faint alpha distinguishes a
Floating marker from a (future) Crystallized one (R-0015). The `save`/`restore`
keeps the block self-contained (architect findings 1–2) rather than relying on
the plateau loop re-setting `textAlign`/`font` next frame. Layout caps are a
future enhancement — a long stack is AC-compliant ("without fully overlapping")
but unbounded; a "+k more" glyph can cap it later.

### 2.5 `index.html` + `main.js` — the form

A collapsible `<details id="drop-marker" class="draft-plateau">` "Drop a marker"
form + `#drop-marker-toggle` button in `.bar` (after `#draft-bridge-toggle`),
inheriting the existing form styling: a `#dm-plateau` select, a `#dm-title`
input, a `#dm-kind` select (from `RESOURCE_KINDS`), a `#dm-uri` input,
`#dm-error`, submit. Wiring mirrors the bridge form exactly:

```js
import { buildResource, RESOURCE_KINDS } from "./resource.js";

const dmPlateau = document.getElementById("dm-plateau");
const dmTitle = document.getElementById("dm-title");
const dmKind = document.getElementById("dm-kind");
const dmUri = document.getElementById("dm-uri");

// #dm-kind is populated ONCE from RESOURCE_KINDS (the kind set never changes).
for (const k of RESOURCE_KINDS) {
  const o = document.createElement("option");
  o.value = k; o.textContent = k;
  dmKind.appendChild(o);
}
// #dm-plateau is rebuilt on form open from the current graph (like the bridge form).
function refreshMarkerPlateaus() {
  dmPlateau.replaceChildren(...doc.to_graph().plateaus().map((p) => {
    const o = document.createElement("option");
    o.value = p.id; o.textContent = p.name;
    return o;
  }));
}
const markerPanel = document.getElementById("drop-marker");
document.getElementById("drop-marker-toggle").addEventListener("click", () => {
  markerPanel.hidden = !markerPanel.hidden;
  if (!markerPanel.hidden) { markerPanel.open = true; refreshMarkerPlateaus(); }
});

document.getElementById("drop-marker-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const spec = buildResource({
    plateau: dmPlateau.value, title: dmTitle.value,
    kind: dmKind.value, uri: dmUri.value,
  });
  const errEl = document.getElementById("dm-error");
  if (spec.error) { errEl.textContent = spec.error; errEl.hidden = false; return; }
  try { doc.add_resource(spec.plateau, spec.title, spec.kind, spec.uri); }
  catch { errEl.textContent = "Could not add marker."; errEl.hidden = false; return; }
  errEl.hidden = true;
  sync.pump(); persist(); draw();
  dmTitle.value = ""; dmUri.value = "";
});
```

`draw()` passes resources to the renderer:
`render(ctx, { plateaus, bridges, reachable: lit, view: VIEW, resources: graph.resources() })`.

## 3. Code outline

See §2 — one constructor, one binding, one DTO+parse+accessor (Rust); one pure
factory + test, ~12 lines of marker render, ~10 lines of markup, ~30 lines of
wiring (JS).

## 4. Non-goals

- No voting/crystallization/state transitions (R-0015) — every marker stays Floating.
- No wizard attribution / signed contribution events (future); contributor nil.
- No intra-plateau free positioning; markers anchor to the plateau.
- No URI validation beyond trim; no edit/delete; no IPFS.

## 5. Open questions (resolved here)

- Marker glyph/layout → a small dot stacked to the right of the anchor, title in
  10px (§2.4); faint alpha for Floating.
- Kind labels → the six `ResourceKind` names verbatim (§2.3).
- URI validation → none beyond trim (§2.3).

## 6. Acceptance criteria

Maps 1-to-1 to R-0014 AC:

- [ ] AC1 — Drop-a-marker form: plateau select (rebuilt on open), title, kind
      select (6 kinds), optional link, submit.
- [ ] AC2 — On submit the marker renders near its anchor plateau same-frame,
      distinct from discs, Floating; multiple markers don't fully overlap.
- [ ] AC3 — Missing plateau → inline error, no write; blank title → fallback;
      empty uri allowed; unknown/blank kind → Note.
- [ ] AC4 — Syncs to another tab + survives reload (IndexedDB snapshot), still
      anchored.
- [ ] AC5 — New marker is Floating, vote_count 0, contributor nil (attribution
      deferred).
- [ ] AC6 — Pure `buildResource` unit-tested: valid→ok, missing plateau→error,
      blank title→fallback, unknown/blank kind→Note, empty uri allowed,
      deterministic.
- [ ] AC7 — Additive Rust only (constructor + binding + DTO/accessor); root keys
      stay `{bridges, plateaus, resources, votes}`; no reputation in the CRDT.
- [ ] AC8 — All suites green (incl. a wasm add_resource/resources round-trip);
      drop a marker + reload, no uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | `Resource::new` enforces Floating + zero votes + unsigned at creation | JS cannot pick a state/vote/rank (CLAUDE.md §4 spirit); crystallization is earned (R-0015) |
| 2026-06-02 | Kind crosses as a label string, parsed in Rust (unknown → Note) | Keeps the enum authoritative in Rust; JS sends human labels, no enum coupling |
| 2026-06-02 | DTO serializes `kind`/`state` as their variant-name strings | Unit enums serialize to "Note"/"Floating"; render + tests read them directly |
| 2026-06-02 | Markers render faint until Crystallized | Sets up R-0015's crystallization visual; Floating reads as "debris", not bedrock |

## Changelog

- 2026-06-02 created (Draft) — pending architect review, then Accepted.
- 2026-06-02 architect design review: **APPROVE-WITH-NITS** (the load-bearing
  serde unit-enum→string claim verified empirically). Folded in: `add_resource`
  validates the plateau exists (server-side AC3, mirrors add_bridge);
  `Resource::new` uses `now_unix()` for source-consistency; the marker render
  block is wrapped in `save`/`restore` so font/textAlign/alpha don't leak; cached
  `dmUri` ref + explicit toggle/rebuild-on-open wiring; marker-overflow cap noted
  as a future enhancement. **Status → Accepted**; ready to implement.
