# TESTME — the 5-minute MVP tour

Your Obsidian vault, as an explorable knowledge world. Everything below runs
**offline, with no server owning the data** — the page is static files + wasm.

## 0. Start the world

```bash
cd ~/projects/a-million-plateus
# Fresh clone only — build the wasm core (pkg/ is gitignored):
wasm-pack build crates/mp-wasm --target web --out-dir ../../apps/web/pkg
python3 scripts/serve.py          # serves apps/web on http://localhost:8143
```

Open **http://localhost:8143** in a browser.

> `scripts/serve.py` sends no-cache headers, so a normal reload always picks up
> the latest code — plain `python3 -m http.server` serves stale modules after
> rebuilds. Stop it with Ctrl-C; if one is running in the background:
> `pkill -f serve.py`.

> Your vault is already imported as `apps/web/igoose-world.bin` (630 notes ·
> 642 bridges · 60 resources, built from `westerngazoo/obsidian_vaults/IGoose`).
> To rebuild it after editing your notes:
> ```bash
> cargo run -p mp-host -- import /path/to/obsidian_vaults/IGoose apps/web/igoose-world.bin
> ```

## 1. First contact (R-0019)

- A **first-run tutorial** welcomes you (only the first time; **Tour** replays it).
- Pick a **career lens** — try *The Geometer*. It orients you; it grants nothing.

## 2. Bring in your vault (R-0021)

- Click **Import a world** → choose `apps/web/igoose-world.bin`.
- The HUD jumps to **~638 plateaus · ~632 bridges · 60 markers**. The import is a
  CRDT **merge** — it adds to the world, never replaces, and re-importing the
  same file changes nothing (stable ids).

## 3. Earn reach (R-0002/R-0010 — the GA core)

- Click the one **lit** island (your trailhead, *Arithmetic*) a few times. Each
  click **signs a traversal** with your local Nostr key; reach is **recomputed
  from your signed history** by the geometric-algebra core — never granted.
- Watch the HUD: a few clicks light **~580 of your own notes** (the math-facing
  bulk of the vault projects onto your lens).
- **Reset my history** wipes the log — the fog closes back in. Earned, not stored.

## 4. Find and read your notes (R-0019/R-0020)

- **Travel** → pick e.g. *Combinaciones lineales, Span, independencia lineal* →
  the camera centres it with a highlight ring.
- **Click it** → the read view opens: your Markdown rendered, **LaTeX typeset by
  vendored KaTeX** (offline — that note renders 26 equations), plus any
  resources anchored there (your PDFs / YouTube links from the notes).

## 5. Author and crystallize (R-0011…R-0015)

- **Draft a plateau** — give it a name, aim the Formal/Empirical/Creative
  sliders, and write a **Body** with math (`$E=mc^2$`). Click it to read it.
- **Draft a bridge** between two topics; **Drop a marker** (a resource) on one;
  **Place a stone** (vote) on the marker — enough weighted votes crystallize it
  into gold terrain. State is derived from votes, never set by a client.

## 6. Prove the decentralization (R-0005/R-0012/R-0018)

- **Second tab**, same URL: the world is identical (BroadcastChannel sync) and
  edits appear live in both.
- **Reload**: everything survives (IndexedDB snapshot — the same save-blob format
  the native `mp-host` redb store uses).
- **Connect a peer (P2P)** on two devices: copy-paste the invite/answer blobs and
  the graphs converge **directly over WebRTC — no server**.

## Native side (R-0017)

```bash
cargo run -p mp-host -- merge /tmp/world.redb apps/web/igoose-world.bin
cargo run -p mp-host -- stats /tmp/world.redb
# → 630 plateaus · 623 bridges · 60 resources
```

One save-blob, two backings (IndexedDB in the browser, redb natively).

## Known rough edges (next up)

- **The map is dense at 630 notes** — labels overlap badly; navigate by
  **Travel** + the read view. A zoom/level-of-detail map view is the next
  map-side requirement.
- **Physics notes start fogged**: no lens *faces* the new Physics domain yet
  (R-0022 adds a Physicist lens + trailhead); reach them by bridging in from
  math notes.
- **Images** in notes show as literal `![[…]]` text (asset bundling not built);
  PDFs/links DO appear as resources.
- Positioning is a keyword heuristic (v1) — AI-assisted placement is R-0022.

## Run the test suites

```bash
node --test apps/web/src/*.test.mjs      # 147 JS tests
cargo test --workspace                   # Rust core (incl. 8 importer tests)
```
