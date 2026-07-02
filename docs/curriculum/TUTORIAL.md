# TUTORIAL — your first session in the fog world

A guided first session for someone who has never opened the tool. Every step below was
run and verified against the app as-built (2026-07-01); what you'll see is what's
described. The companion doc [STUDY-GUIDE.md](STUDY-GUIDE.md) is the terse day-to-day
loop; this is the narrated walkthrough.

**The idea in one line:** knowledge is a *world*, not a syllabus — every island is a
topic, bridges are how ideas connect, and your job is to walk it, prove you crossed it,
and extend the map where it's missing.

---

## 1 · Arrive: pick a lens

Open the app. A short tour greets you —

> *"Every island is a topic; bridges connect related ideas. You fly through a map of
> knowledge, not a course."*

— then six **lens** cards. A lens is a starting *orientation*, never a wall: it decides
where you wake up, not what you may touch.

- **The Geometer / The Composer / The Polymath / The Physicist** — the original
  Mathematics / Music / Physics lenses.
- **The Logician** — the *classical* foundations branch: LEM, ZFC, hyperreals — the
  branch that reconnects to measured physics.
- **The Constructivist** — the *intuitionistic* branch: topos theory, SIA, nilpotent
  infinitesimals — build-the-witness mathematics.

You can also **Build your own**: name new lenses (AI, Electromagnetism, FPGA…) and aim
them with three sliders — Formal, Empirical, Creative. That's the whole geometry of the
world: every topic is a direction in that 3-axis space.

*For this tutorial, pick The Constructivist.*

## 2 · Read the world

You land on the map: **31 topics · 38 bridges** (the numbers live in the HUD, top).
Three regions: Music (lower-left), classical Physics (top-left), and the big
center-right cluster — the **ground-up rebuild curriculum**: 22 plateaus from
*Classical Predicate Logic* and *Intuitionistic Logic* up through *Clifford Algebra*,
*Maxwell in one equation*, *Qubit = Spinor*, to *GA-Equivariant AI*.

The two-logic fork is drawn, not narrated: classical and intuitionistic plateaus are
different domains whose bridges marked **(meet)** are the crossings — one spec
(infinitesimal calculus), two logical backends.

Your companion (right panel) introduces itself in your lens and answers questions
grounded in what's actually near you. No model connected? It still works — it degrades
to an offline digest, never to silence.

## 3 · Travel, read, do

Click **Travel**, pick *Intuitionistic Logic*, and the camera centers it (travel is
camera only — it never changes what you've earned). Click the island.

The drawer opens with the full body — typeset math included:

- the concept: drop LEM as an axiom; $P \lor \lnot P$ must be **constructed**; the
  algebraic semantics is a **Heyting algebra**;
- why it matters here: that gap is exactly what lets a nonzero $\varepsilon$ with
  $\varepsilon^2 = 0$ exist — the door to honest infinitesimals;
- a **Deliverable**: *exhibit a Heyting algebra that is not Boolean.*

Under it: **Study with your companion** (Summarize · Mental model · What to read first ·
Quiz me), and **Resources ranked by stones** — the community's votes decide what's worth
reading first, and you can pin a book/video/link right there.

**The rule of the world: do the deliverable.** In a notebook, in code, on paper —
produce the thing. The 3-element chain $0 < \tfrac12 < 1$ with $\lnot\tfrac12 = 0$ is
your first witness.

## 4 · Close the island — honestly

Click **Mark as mastered**. The tool does *not* just flip a flag:

1. it first runs **Quiz me** — a recall self-test over the topic;
2. only then does a confirm appear: **"✓ I can answer these — mark mastered"**;
3. clicking it signs a **mastery event** with your wizard key (the 🔑 in the HUD — a
   real keypair minted in your browser; nothing leaves your machine unless you publish).

The HUD ticks to **1 mastered · 0 studying**. This survives closing the browser — your
progress is a log of *signed events*, not a server row. And mastery is a completion
claim, never reputation: rank in this world is earned only by traversal and vouches,
so claiming can't be farmed.

Want receipts? For math topics you can go further: write the proof (AI-checked) or
solve the drill (CAS-checked, offline, deterministic) — and optionally **publish** the
artifact, signed, for others to read.

## 5 · The gap rule: extend the map

Mid-deliverable you'll hit something the map doesn't cover deeply enough. That's not a
detour — that's the mechanism. When a gap appears:

1. **Draft a plateau** — name it (*Heyting Algebras*), give it a domain, aim it with
   the three sliders, and write its body in Markdown + math — including its own goal.
2. **Draft a bridge** — connect it to the topic that spawned it (*Heyting Algebras →
   Intuitionistic Logic*, concept: "algebraic semantics").
3. Go there, study it, close it, come back.

The HUD now reads **32 topics · 39 bridges** — the world grew because *you* studied.
The curriculum is a level of main topics, never the final list; depth is added exactly
where your study demands it. (Semantic zoom — expanding a plateau into its own
sub-roadmap and rolling progress back up — is tracked as the next feature, issue #31.)

## 6 · Where everything lives

| Thing | Where | Survives |
|---|---|---|
| The world (topics, bridges, resources, votes) | a CRDT doc in your browser (IndexedDB) | reloads, restarts; merges conflict-free with peers |
| Your progress (mastery, proofs, traversals) | signed events, local log | reloads; verifiable by anyone, forgeable by no one |
| Your key | your browser only | — secret never shown, synced, or logged |
| Sharing | opt-in: P2P (WebRTC), a relay, or publish signed artifacts | you decide, per action |

Two tabs of the same browser converge automatically; two machines converge over
**Connect a peer (P2P)** with no server at all.

## 7 · Suggested first week (Constructivist route)

1. *Intuitionistic Logic* → deliverable → mastered (you just did).
2. *Classical Predicate Logic* — walk the **(meet)** bridge; know exactly what the
   other branch assumes that you refuse.
3. *Hehner Predicative Logic* — specs and programs as one calculus.
4. *Elementary Topos Theory* — where your logic natively lives.
5. *SIA Infinitesimals (Kock–Lawvere)* — the payoff: $f(x+\varepsilon) = f(x) +
   f'(x)\varepsilon$ **exactly**.

Then the trunk: Universal Algebra → Grassmann → Clifford → rotors → Maxwell → Dirac →
qubits. Add plateaus wherever the ground feels thin. The map is yours.
