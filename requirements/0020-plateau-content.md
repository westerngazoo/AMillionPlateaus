# R-0020 — Plateau content: a Markdown body with typeset math, and a read view

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-08
- **Depends on:** R-0005 (fog-world + render), R-0011 (plateau authoring), R-0012 (durable graph), R-0014 (resources anchored to a plateau)
- **Realized by:** SPEC-0020 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Today a plateau is a named point with a position — there is nowhere to put *the
knowledge itself*. This requirement gives every plateau an authorable
**Markdown body** (text **and** equations) and a **read view** that renders it.
A visitor can write a topic up — prose, lists, and LaTeX math like `$\int_a^b
f\,dx$` — and anyone who reaches that plateau can **open it and read** the
rendered content together with the resources anchored there. The body is graph
data: it lives in the CRDT, so it **syncs** between peers and **survives a
reload**, exactly like the rest of the world.

This turns the world from a map of empty islands into a map of *legible* islands
— the substrate the Obsidian import (R-0021) fills and the AI companion (R-0007)
reads.

## 2. Rationale

The data model already reserves the field — `PlateauNode.description` exists and
round-trips through the CRDT and the wasm DTO — but nothing authors it, syncs it
from the client, or renders it. The cheapest, highest-leverage step toward "see
the info on a topic" is to (a) let the Draft form write a body, and (b) add a
read view that renders Markdown + typeset math. It needs **no new GA/CRDT
machinery** (the field and its sync path exist), and it unblocks both the
importer (R-0021 writes real notes into the body) and richer resources (R-0022).
Math must actually render — these are physics and maths notes — so the renderer
ships with **vendored KaTeX** (offline-true, no CDN, honoring
DECENTRALIZATION.md). Because bodies arrive from **untrusted synced/imported
peers**, the renderer is **injection-safe by construction**.

## 3. Acceptance criteria

- **AC1 — A plateau carries an authorable Markdown body.** The existing
  `description` field is written from the client at draft time, **syncs** over
  the CRDT (same channel as plateaus/bridges/votes), and **persists** across a
  reload (R-0012 snapshot). No new authoritative state outside the graph — the
  body IS graph data.

- **AC2 — Author a body when drafting.** The Draft-a-plateau form gains an
  **optional body** input (a textarea). The pure `buildPlateau` factory threads
  it; the wasm `add_plateau` binding accepts a `description` argument and sets it
  via the existing `with_description` builder. An empty body is valid (current
  behavior unchanged).

- **AC3 — A read view.** Selecting a **lit** plateau opens a **detail panel**
  showing the plateau's name, its body **rendered as Markdown with typeset
  math**, and the **resources anchored** to it (title · kind · link). Opening
  the view is *reading*: it does not edit the graph or change reachability. (It
  may still record the visit/traversal exactly as a click does today — visiting
  a topic is still a traversal.)

- **AC4 — Rendering is injection-safe and pure-tested.** Markdown→view is a
  **pure** function, **unit-tested without a browser**, that renders a known safe
  subset (headings, emphasis, lists, code, links, paragraphs, math) and
  **neutralizes hostile input** — raw HTML, `<script>`, `<img onerror=…>`,
  `javascript:` URLs in synced/imported bodies must NOT execute or inject. Links
  render as inert/safe (e.g. `http(s)`/`mailto` only). Math is delegated to
  KaTeX in a safe mode (`throwOnError:false`, untrusted).

- **AC5 — KaTeX is vendored and offline.** The math renderer's assets (JS +
  fonts/CSS) are **committed to the repo** and loaded **on demand** (lazy), with
  a **graceful fallback** to the raw `$…$` source if the asset is unavailable.
  **No runtime CDN/network dependency** — the world types math offline.

- **AC6 — Additive, no regressions.** No change to GA/reachability, the CRDT root
  keys, reputation, identity, sync, persistence, or presence. Existing tests stay
  green. The body is the only new authored field, and it already exists in the
  schema.

- **AC7 — Green + browser-verified.** `node --test apps/web/src/*.test.mjs`,
  `cargo test --workspace`, `wasm-pack test --node`, clippy `-D warnings`
  (host + `wasm32`), and `cargo fmt --all --check` all green; on the page, a
  visitor can draft a plateau with a body containing an equation, open its read
  view to see rendered prose **and** typeset math, the body **syncs** to a second
  tab, and there are **no uncaught console errors**.

## 4. Constraints & non-goals

- **Body is graph data.** It lives in `PlateauNode.description` and the CRDT
  `plateaus` map — never a side store, never in reputation/identity.
- **Safe subset, not full CommonMark.** A small, auditable Markdown subset is
  sufficient; the bar is *legible + safe*, not spec-complete. No raw HTML
  passthrough, ever.
- **Vendored, lazy math.** KaTeX assets in-repo, loaded only when a body with
  math is first rendered; no CDN.
- **Non-goals:** a full WYSIWYG editor (a textarea is enough); editing a body
  after creation (v1 authors at draft time — editing existing bodies can come
  later); image-asset bundling (inline image embeds render as a labeled
  placeholder/link, not the image — asset bundling is R-0021/R-0022 territory);
  collaborative rich-text/CRDT-per-character (the body is a plain string field).

## 5. Open questions

- **Open affordance.** Does clicking a lit plateau open the read view directly
  (and also sign the traversal), or is there a separate "open" control? Leans:
  click opens + still signs (visiting = reading). Spec decides.
- **Markdown library.** A tiny in-repo renderer (auditable, dependency-free for
  the text subset) vs a vendored MD lib. Leans in-repo for the text subset +
  vendored KaTeX only for math. Spec decides.
- **Panel placement.** A side/overlay panel vs replacing the companion column.
  Cosmetic; spec decides.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-08 | Body = the existing `description` field, authored from the client and synced via the CRDT | The field + sync path already exist; no new state, no new CRDT key |
| 2026-06-08 | Vendored, lazy KaTeX; no CDN | Equations must render offline — honors DECENTRALIZATION.md (owner-chosen) |
| 2026-06-08 | Renderer is injection-safe by construction + pure-tested | Bodies arrive from untrusted synced/imported peers; rendering must not be an XSS vector |
| 2026-06-08 | v1 authors a body at draft time; no post-hoc edit | Smallest useful slice; editing existing bodies is a clean follow-on |

## Changelog

- 2026-06-08 created (Accepted) — paired with R-0021 (importer fills these bodies). Pending SPEC-0020 + architect review.
- 2026-06-08 **QA sign-off → Met.** All seven AC verified by passing tests + gates. Gates: `node --test apps/web/src/*.test.mjs` **147 pass / 0 fail** (135 prior + 12 new in `markdown.test.mjs`); `cargo test --workspace` **green** (mp-crdt 13+6, mp-domain 16+4, mp-graph 16, mp-host 6, mp-identity 1+16, mp-reputation 11+1, mp-wasm 18 host lib); `wasm-pack test --node` (mp-wasm) **9 pass / 0 fail** incl. the new `plateau_body_round_trips_through_the_doc`; `cargo fmt --all --check` **clean**; clippy `-D warnings` host **0** + wasm32 **0**. AC4 verified adversarially: an XSS battery (raw `<script>`/`<img onerror>`, link-attr breakout, `$…$`/`$$…$$` `</span><script>` and `"`-quote attribute breakouts, dangerous-scheme + control-char URLs, PUA-sentinel forgery) parses to **only** inert allowlisted `<span>`/`<p>` markup — every payload char entity-escaped, no live tag, no `on*` handler, no unsafe `href`; the structural `scan()` test confirmed to flag disallowed tags **and** attribute names; `safeHref` is the single chokepoint reused for resource `uri`s in `renderResourceList`. AC3: `openPlateau`/`renderResourceList` call no mutating fn (read-only over the DTO). AC1/AC2: body is `PlateauNode.description` in the CRDT `plateaus` map (not a side store / not reputation); empty body stored verbatim as `""`, the `_No description yet._` placeholder is render-time only (one site, never persisted). AC5: KaTeX 0.16.11 vendored (woff2-first, no `.woff`/`.ttf` requested), lazy `import("../vendor/katex/katex.mjs")`, `trust:false`/`throwOnError:false`, raw-TeX fallback, no CDN/network. AC6: CRDT root keys unchanged `["bridges","plateaus","resources","votes"]`; only `WasmCrdtDoc::add_plateau` gained a `description` param; mp-graph/mp-reputation/mp-crdt/mp-domain/mp-identity untouched by this change; no new `unwrap()` without SAFETY. AC7: gates green + browser evidence recorded in SPEC-0020 §6 (4 typeset equations offline, console clean) — the manual portion.
