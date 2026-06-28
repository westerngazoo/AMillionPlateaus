# ARCHITECTURE — as built (visual)

> Companion to `SYSTEM_ARCHITECTURE.md` (which is partly aspirational). This file
> diagrams **what actually exists today** (through R-0019) and answers two
> questions: *how is the DB shaped?* and *why is the graph you see only a view of
> it?* All diagrams are Mermaid — they render on GitHub and in most editors.

---

## 1. The data model (what the DB stores)

The authoritative store is **one geometric graph**. Everything else is derived.

```mermaid
erDiagram
    PLATEAU ||--o{ BRIDGE : "from / to"
    PLATEAU ||--o{ RESOURCE : "anchored on"
    RESOURCE ||--o{ VOTE : "weighted by"
    DOMAIN ||--o{ PLATEAU : "orients"

    PLATEAU {
        uuid id
        string name
        string description "MD body (planned R-0020)"
        uuid domain_id
        Multivector position "GRADE-1 — (e1,e2,e3) point in concept-space"
    }
    BRIDGE {
        uuid id
        uuid from
        uuid to
        string concept_label
        Multivector rotor "EVEN-GRADE — oriented transform between two points"
        u8 dominant_grade "1=prereq 2=peer 3=synthesis"
    }
    RESOURCE {
        uuid id
        uuid plateau_id
        string title
        ResourceKind kind "Article|Video|Paper|Note|Interactive|Tool"
        string uri
        f32 vote_count "weighted by voter reputation"
        ResourceState state "Floating->Crystallizing->Crystallized"
    }
    VOTE {
        uuid resource_id
        uuid wizard_id
        f32 weight "grow-only (CRDT)"
    }
```

**Two things are deliberately NOT in this picture:**

- **Reputation** — never stored, never synced. It is *recomputed* on each client
  from the **signed event log** (Nostr-signed traversals/vouches). Storing it
  would let someone forge rank by editing the DB; recomputing from signatures
  makes rank earned and unspoofable. (`CLAUDE.md` rule 4 & 7.)
- **The 2D/3D positions you see on screen** — those are a *projection* of each
  node's `position` multivector, computed at render time (see §3).

What syncs between peers is exactly four maps — **`{plateaus, bridges, resources, votes}`** — as an Automerge (CRDT) document. Nothing else crosses the wire.

---

## 2. How the parts interact (as-built component map)

```mermaid
flowchart TB
    subgraph BROWSER["apps/web — browser (vanilla JS, no framework)"]
        UI["main.js — UI wiring<br/>render.js · project.js · wayfinding.js · tutorial.js"]
        AUTH["persona.js (career lens) · identity.js · companion*.js"]
        TRANSPORTS["sync.js (BroadcastChannel)<br/>webrtc.js (P2P) · relay.js (Nostr) · presence.js"]
        EVENTS["events.js — signed event log → reputation"]
        IDB[("persistence.js → IndexedDB<br/>(one save-blob)")]
    end

    subgraph WASM["mp-wasm (Rust→WASM bridge)"]
        W["WasmCrdtDoc · WasmSyncSession · WasmGraph<br/>verify_event · recompute_reputation"]
    end

    subgraph CORE["Core crates (pure Rust, no async)"]
        DOM["mp-domain<br/>PlateauNode · Bridge · Resource (AMP vocabulary)"]
        GRAPH["mp-graph<br/>geo.rs: GeoGraph score / project_above / transport<br/>ga.rs: garust Vga3f adapter"]
        REP["mp-reputation<br/>GA Eigentrust · Sybil grade-collapse"]
        CRDT["mp-crdt<br/>Automerge CrdtDoc · SyncSession · CrdtStore"]
        ID["mp-identity<br/>Nostr BIP340 · wizard_id_of"]
    end

    subgraph OS_KERNEL["AI-First OS Kernel / mp-host"]
        HOST["seed · stats · merge<br/>(Agent Plugin API)"]
        AGENT["Agent Tooling WASM Plugins<br/>(Dynamic Custom Software)"]
        REDB[("redb (durable, same save-blob)")]
    end

    GARUST["garust — the ONLY math layer (Cl(3,0,0))"]

    UI --> W
    AUTH --> W
    EVENTS --> W
    TRANSPORTS <-->|Automerge sync msgs| W
    UI --> IDB
    W --> CRDT
    W --> DOM
    W --> REP
    DOM --> GRAPH
    REP --> GRAPH
    CRDT --> DOM
    ID --> GRAPH
    GRAPH --> GARUST
    REP --> GARUST
    HOST --> CRDT
    HOST --> REDB
    AGENT --> HOST
    IDB -. "export blob → OS kernel merge" .-> HOST

    classDef built fill:#1b2735,stroke:#4a6280,color:#d6e0ea;
    classDef math fill:#2c4a3a,stroke:#7fd0a0,color:#eaffee;
    class GARUST math;
```

**Reading it:** the browser never touches Rust internals — it calls `mp-wasm`,
which drives the pure core crates, which bottom out in **garust** for all
geometry. The *same* CRDT save-blob is the unit of persistence in both backings
(IndexedDB in the browser, redb natively) — "one save-blob, two backings." Three
independent transports carry the *same* sync bytes: BroadcastChannel (same-origin
tabs), WebRTC (cross-device, no server), and a Nostr relay (signed events).

> **Built today:** everything above. **Not built (in the old doc, ignore for
> now):** Godot, Three.js 3D, Gun.js, IPFS, Colyseus. The renderer today is the
> 2D canvas fog-world.

---

## 3. Why the graph you see is only a *view* of the DB

This is the key idea — and the answer to "calculus connects to everything; how
does that look in the DB?"

The DB holds **one** node for calculus, at **one** position. Its many
connections are **edges**. What changes between travelers is not the DB — it is
the **lens** (your career-lens orientation, a direction multivector) that decides
which neighbors light up.

```mermaid
flowchart LR
    subgraph DB["THE DB — one geometric graph (all nodes, all edges)"]
        CALC(("Calculus<br/>position ≈ e1, low e2"))
        MECH(("Mechanics<br/>e2"))
        ANAL(("Analysis<br/>e1"))
        ML(("Machine Learning<br/>e1+e2"))
        MUS(("Rhythm<br/>e3"))
        CALC --- MECH
        CALC --- ANAL
        CALC --- ML
        ANAL --- MUS
    end

    LENS{"Your lens =<br/>a direction<br/>multivector"}

    subgraph PHYS["VIEW through a PHYSICS lens (dir≈e2)"]
        P1(("Calculus")) --- P2(("Mechanics"))
    end
    subgraph MATH["VIEW through a PURE-MATH lens (dir≈e1)"]
        M1(("Calculus")) --- M2(("Analysis"))
    end

    DB --> LENS
    LENS -->|"score = ⟨dir·position⟩₀ > 0.15"| PHYS
    LENS -->|"different dir, same DB"| MATH
```

Concretely, in `crates/mp-graph/src/geo.rs`:

```text
score(node, directions)   = max over dirs of  ⟨dir · node.position⟩₀   // Hestenes inner product, scalar part
project_above(dirs, 0.15) = every node whose score clears the fog threshold
```

So:

1. **Calculus is one row** in the `plateaus` map — a single Grade-1 multivector
   (a *point/direction* in concept-space), not "a thing connected to everything."
2. **Its hub-ness is geometric.** Because its position has a large component on a
   widely-shared axis (e.g. `e1`, the formal axis), *many* lens-directions
   project onto it above threshold. That is *why* it lights up from almost any
   orientation — it is mathematically near many lenses, not specially flagged.
3. **The path you walk is `project_above` ∘ your lens ∘ reputation**, then
   flattened to screen by `project.js` (a fixed isometric 2D projection). Two
   travelers with different lenses see *different lit subgraphs over the identical
   DB*. Calculus appears in both — embedded in a different neighborhood each time.
4. **Edges are oriented, not just present.** A bridge carries an even-grade
   *rotor*; `transport(edge, v) = R·v·~R` carries a vector *along* a connection.
   "Calculus → Mechanics through the physics lens" is a different transport than
   "Calculus → Analysis through the math lens" — same hub, different rotor.

> **So yes:** the graph/path on screen is a *particular view* of the DB —
> specifically `2D-projection( fog-filter( lens, reputation, the-one-GA-graph ) )`.
> Change the lens, the DB is untouched, but the view (and which of calculus's
> bridges glow) changes. That is the whole point of using geometric algebra
> instead of a plain property graph: "the right lens" is a literal projection.

---

## 4. Where new ideas plug in

| Idea | Where it lands in this model |
|------|------------------------------|
| **Topic info as MD + equations** | `PlateauNode.description` becomes an MD body (rendered with LaTeX client-side). Already a field in the schema; needs storage + a renderer. |
| **Embed media (YouTube/video/PDF)** | A `Resource` with `kind = Video/Paper/Interactive` and a `uri`. The kinds already exist. |
| **AI-vetted, best-upvoted resources** | `vote_count` + `ResourceState` (Floating→Crystallized) already rank by weighted votes. Add an AI pre-check gate before a resource crystallizes/shows. |
| **Import an Obsidian vault** | `.md` note → plateau (body = description); `[[wikilink]]` → bridge; `![[img]]`/`.pdf` → resource; folder/tag → domain; `.canvas` x/y → seed position. |
```
