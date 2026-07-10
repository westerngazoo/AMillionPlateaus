# CLI bridge — run the companion on a CLI you already pay for (no API key)

A browser tab can't run a command-line tool, so the app can't call `claude` (or a
Gemini CLI) directly. `scripts/cli-bridge.py` is the missing link: a tiny
localhost server that speaks the OpenAI-compatible HTTP the companion already
uses and forwards each request to the CLI. Result — the companion answers on your
**Claude Code subscription**, with **no API key and no per-token cost**.

## Run it

In *your* terminal (where `claude` is logged in):

```sh
python3 scripts/cli-bridge.py                 # claude backend, http://localhost:8787/v1
python3 scripts/cli-bridge.py --model opus    # pin a model
python3 scripts/cli-bridge.py --port 9000
python3 scripts/cli-bridge.py --cmd gemini --model gemini-2.5-flash   # any headless CLI
```

It prints whether the CLI is logged in at startup. Zero dependencies (Python
stdlib only). Bound to `127.0.0.1` — this machine only. `--selftest` runs the
pure-logic checks.

## Point the app at it

Model setup →
- **Endpoint:** `http://localhost:8787/v1`
- **Model:** blank, or a value the CLI accepts (`sonnet`, `opus`, …)
- **Key:** leave empty

The **⇄ Local model** switch (R-0049) then flips the companion to it in one click.

> ⚠️ Using a **keyless local endpoint requires the R-0049 fix** (PR #81): before
> it, the app demanded an API key for *every* endpoint and silently fell back to
> offline — which is why Ollama / LM Studio / this bridge appeared "not to
> connect". Land that fix and all local backends work.

## What it does / doesn't

- **Stateless per call.** The app resends full history each turn; the bridge
  flattens it into one prompt, so context is preserved — expect CLI cold-start
  latency per message.
- **Text only.** Vision turns (QR/OCR photo) send image blocks a text CLI can't
  take; those still need a hosted multimodal endpoint.
- **Personal / local use.** Fine to run your own prototype on your subscription;
  don't route a public deployment's traffic through it.
- **Google side:** there is no Gemini/"AGI" CLI bundled with Antigravity (that's
  an IDE). `--cmd gemini` works if you install Google's Gemini CLI separately.
