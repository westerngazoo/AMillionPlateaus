# Specs

A **spec** states *how* a feature is built — the technical design that realizes
one or more requirements. Requirements
([`requirements/`](../requirements/)) are the WHAT; specs are the HOW.

The project is built spec-first: before any code is written, the feature is
described here as a numbered spec — design, code outline, non-goals, acceptance
mapping — and reviewed by the `architect` agent.

## Process

1. **Draft.** Once the governing requirement is `Accepted`, create a spec from
   [`TEMPLATE.md`](TEMPLATE.md), numbered `SPEC-NNNN`: `NNNN-short-name.md`.
2. **Design review.** The `architect` agent reviews the design and code outline
   against the requirement (`CLAUDE.md` §4, step 2).
3. **Accept.** When the design is sound and unambiguous, status → `Accepted`.
   Only then does implementation begin.
4. **Implement.** Code satisfies exactly the accepted spec and cites its id.
5. **Verify.** Acceptance criteria are checked; status → `Implemented`.

A spec may later become `Superseded` or `Revised` (amended in place, logged).

## Status values

`Draft` → `Accepted` → `Implemented` · (or `Superseded` / `Revised`)

## Relationship to requirements

Every spec links back to the requirement(s) it realizes via its **Realizes**
field. The build order across requirements and specs is in
[`ROADMAP.md`](../ROADMAP.md).

## Index

| Spec | Title | Realizes | Status |
|------|-------|----------|--------|
| [SPEC-0001](0001-mp-graph-foundation.md) | mp-graph foundation crate | R-0001 | Implemented |
| [SPEC-0002](0002-ga-reputation-and-fog.md) | GA reputation engine + fog reachability | R-0002 | Implemented |
| [SPEC-0003](0003-wasm-graph-bridge.md) | mp-wasm: the WASM graph bridge | R-0003 | Implemented |
| [SPEC-0004](0004-crdt-sync.md) | mp-crdt: Automerge-backed graph sync | R-0004 | Implemented |
