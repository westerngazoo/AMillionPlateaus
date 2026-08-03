# R-0108 — Link a topic from inside your own writing

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0020](0020-plateau-content.md) (Markdown bodies), [R-0056](0056-study-handoff-notepad.md) (the private notepad), [R-0079](0079-capture-topic.md) (⚡ Capture)

## Why

The graph could already be navigated *structurally* — bridges are clickable
(R-0029), and the "Before this, study…" prerequisite chips open their topic. But
nothing you **wrote yourself** could point at a topic. A note saying "revisit
Introducción al cálculo before this" was a dead string: you had to remember the
name, open search, and type it again.

That is the one direction a knowledge graph must support and this one didn't —
prose is where connections actually get made.

## What

Two spellings, in **any** rendered Markdown (topic bodies, notepad + its preview,
Teach-me lesson cards, derivations, review answers, the print view):

| You type | You get |
|---|---|
| `[[Rotors]]` | a link to that topic — wiki-style, and what an Obsidian vault already contains, so an imported note links itself up |
| `:plateau:Introducción al cálculo` | the same, in the terse form you asked for |

**The terse form carries spaces.** With no closing delimiter, the name is resolved
by **longest match** against real topic names — `:plateau:Introducción al cálculo,
then rest` links the three-word name and hands `, then rest` back to the prose.
Trailing punctuation stays out of the link.

**Names resolve the way you actually write them.** Case- and diacritic-insensitive,
with a **unique-prefix** fallback so `[[Rotors]]` finds *"Rotors: Rotation without
Matrices"*. An ambiguous prefix resolves to **nothing** rather than guessing — a
wrong link is worse than no link.

**An unknown name is not a dead end.** It renders as a dashed `＋` affordance that
opens ⚡ Capture prefilled with that name, so writing about a topic you haven't
created yet is how you create it.

## Acceptance criteria

1. **AC1 — both spellings link.** `[[Name]]` and `:plateau:Name` become anchors that
   open the topic.
2. **AC2 — spaces survive.** The terse form resolves a multi-word name without any
   delimiter, and the remainder of the sentence is untouched — including a comma or
   full stop immediately after the name.
3. **AC3 — forgiving resolution.** Case and diacritics are ignored; a unique prefix
   matches; an ambiguous one does not link.
4. **AC4 — unknown names offer creation**, prefilled into ⚡ Capture.
5. **AC5 — everywhere.** Every `renderMarkdown` call site resolves links, not just
   the notepad.
6. **AC6 — nothing else breaks.** Normal `[text](url)` links, images, code and math
   render exactly as before.
7. **AC7 — inert by construction.** A topic name is escaped, so a hostile name can
   never inject markup.
8. **AC8 — pure core.** `markdown.js` gains no knowledge of the graph; resolution is
   injected, and with no resolver a link degrades to its plain name.

## Notes

- `renderMarkdown(src, { resolveTopic })` — the option is optional, so every prior
  caller keeps working unchanged.
- 8 new tests in `markdown.test.mjs`, including the punctuation case (which caught
  a real bug: the comma after a linked name was being swallowed) and the escaping
  case. Suite 694/694.
- One delegated `click` listener covers every render site rather than wiring each.
- The unique-prefix policy lives in `main.js` (app policy), not in the pure module.
- **Not a bug, for the record:** the prerequisite chips under "Before this, study…"
  were already clickable and already open their topic — verified live. What they
  lacked was the *look* of a link; topic links now use a dotted underline so the
  affordance reads correctly.
