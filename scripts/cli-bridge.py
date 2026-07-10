#!/usr/bin/env python3
"""cli-bridge — turn a local, already-logged-in AI CLI into the companion's model.

The app's companion talks OpenAI-compatible HTTP to whatever endpoint you point
it at (Ollama, LM Studio, Groq, …). This little server speaks that same shape on
localhost and, per request, shells out to a CLI you already pay for — Claude Code
(`claude -p`) by default. So the companion runs on your Claude subscription with
NO API key and NO per-token cost: exactly the "keep it out of cost" posture this
prototype wants.

Why a bridge at all: a browser tab cannot run a command-line tool (no shell, no
subprocess). The only way the page can reach a CLI is over HTTP — so this process
is the http↔CLI adapter the browser is allowed to call.

Run it (in YOUR terminal, where the CLI is logged in):

    python3 scripts/cli-bridge.py                 # claude backend, port 8787
    python3 scripts/cli-bridge.py --model opus    # pin a model
    python3 scripts/cli-bridge.py --port 9000
    python3 scripts/cli-bridge.py --cmd gemini --model gemini-2.5-flash   # any headless CLI

Then in the app → Model setup:
    Endpoint: http://localhost:8787/v1     Model: (blank, or e.g. sonnet)     Key: (leave empty)
The R-0049 "⇄ Local model" switch then flips the companion to it in one click.

Zero dependencies (Python stdlib only), matching scripts/serve.py. Bind is
127.0.0.1 — this machine only. `--selftest` runs the pure-logic checks.

Caveats:
  • Each request is a fresh CLI invocation (stateless) — the app resends full
    history every turn, which this flattens, so context is preserved; but expect
    CLI cold-start latency per message.
  • Text only. Vision turns (QR/OCR photo → multimodal) send image blocks the
    CLI can't take on stdin; those still need a hosted multimodal endpoint.
  • Riding a Claude/Gemini *subscription* for your own local prototype is fine;
    don't point a public deployment's traffic at it.
"""

import argparse
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def _text_of(content):
    """A message's text, whether it's a plain string or an OpenAI content array
    (vision turns). Non-text parts — images — are dropped: the CLI can't take
    them, and silently keeping the text beats erroring the whole turn."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            p.get("text", "")
            for p in content
            if isinstance(p, dict) and p.get("type") == "text"
        )
    return ""


def flatten(messages):
    """(system, prompt): system messages joined for the CLI's --system flag, the
    rest rendered as a labelled transcript ending on the latest user turn so the
    CLI continues as the assistant. Pure — this is what --selftest covers."""
    systems, turns = [], []
    for m in messages or []:
        role = m.get("role", "user")
        text = _text_of(m.get("content"))
        if role == "system":
            systems.append(text)
        elif role == "assistant":
            turns.append("Assistant: " + text)
        else:
            turns.append("User: " + text)
    system = "\n\n".join(s for s in systems if s.strip())
    prompt = "\n\n".join(turns).strip()
    return system, prompt


def build_argv(base_cmd, model, system):
    """The CLI invocation for a claude-style `-p` headless call. `base_cmd` is the
    binary (claude/gemini/…). System + model become flags; the prompt is fed on
    stdin by the caller (avoids arg-length limits and any shell interpolation —
    we never use shell=True, so a hostile model string can't inject)."""
    argv = [base_cmd, "-p", "--output-format", "text"]
    if model:
        argv += ["--model", model]
    if system:
        argv += ["--append-system-prompt", system]
    return argv


def run_cli(base_cmd, model, messages, timeout):
    """Invoke the CLI once and return its stdout text. Raises on failure with a
    message clear enough to act on (login, wrong flag, timeout)."""
    system, prompt = flatten(messages)
    argv = build_argv(base_cmd, model, system)
    try:
        proc = subprocess.run(
            argv, input=prompt or "Hello.", capture_output=True, text=True, timeout=timeout
        )
    except FileNotFoundError:
        raise RuntimeError(f"'{base_cmd}' not found on PATH — is the CLI installed?")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"'{base_cmd}' timed out after {timeout}s")
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        hint = ""
        if "401" in err or "authenticate" in err.lower():
            hint = f" — run `{base_cmd}` once interactively to log in, then retry"
        raise RuntimeError(f"{base_cmd} exited {proc.returncode}: {err[:400]}{hint}")
    return proc.stdout.strip()


class Bridge(BaseHTTPRequestHandler):
    # Set by main(): the backend binary, default model, per-request timeout.
    base_cmd = "claude"
    default_model = ""
    timeout = 120

    def _cors(self):
        # localhost is a "potentially trustworthy" origin, so an https deployment
        # (plateaus.goosethropic.systems) may call this http endpoint. Echo * and
        # allow the headers the app sends.
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "POST, GET, OPTIONS")
        self.send_header("access-control-allow-headers", "content-type, authorization")

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self._cors()
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            return self._json(200, {"ok": True, "backend": self.base_cmd})
        # Some OpenAI clients probe /v1/models; the app doesn't, but answer sanely.
        if self.path.rstrip("/") == "/v1/models":
            return self._json(200, {"object": "list", "data": [
                {"id": self.default_model or self.base_cmd, "object": "model"}]})
        self._json(404, {"error": {"message": "not found"}})

    def do_POST(self):
        if self.path.rstrip("/") != "/v1/chat/completions":
            return self._json(404, {"error": {"message": "POST /v1/chat/completions"}})
        try:
            length = int(self.headers.get("content-length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": {"message": "invalid JSON body"}})
        model = (payload.get("model") or self.default_model or "").strip()
        try:
            text = run_cli(self.base_cmd, model, payload.get("messages", []), self.timeout)
        except RuntimeError as e:
            # 502: the app surfaces "model HTTP 502"; the real reason is here and
            # in this terminal. Keeps the failure honest instead of faking a reply.
            return self._json(502, {"error": {"message": str(e)}})
        self._json(200, {
            "object": "chat.completion",
            "model": model or self.base_cmd,
            "choices": [{"index": 0, "finish_reason": "stop",
                         "message": {"role": "assistant", "content": text}}],
        })

    def log_message(self, fmt, *args):  # one tidy line per request
        sys.stderr.write("  %s\n" % (fmt % args))


def _selftest():
    sys_out, prompt = flatten([
        {"role": "system", "content": "You are Ada."},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": [{"type": "text", "text": "explain topos"},
                                     {"type": "image_url", "image_url": {"url": "x"}}]},
    ])
    assert sys_out == "You are Ada.", sys_out
    assert prompt == "User: hi\n\nAssistant: hello\n\nUser: explain topos", repr(prompt)
    # image part dropped, text kept
    assert "explain topos" in prompt and "image" not in prompt
    # empty → safe
    assert flatten([]) == ("", "")
    assert flatten(None) == ("", "")
    # argv: model + system become flags, no shell metachars ever interpolated
    argv = build_argv("claude", "opus", "SYS")
    assert argv == ["claude", "-p", "--output-format", "text",
                    "--model", "opus", "--append-system-prompt", "SYS"], argv
    assert build_argv("claude", "", "") == ["claude", "-p", "--output-format", "text"]
    print("cli-bridge selftest: OK")


def main():
    ap = argparse.ArgumentParser(description="OpenAI-compatible bridge to a local AI CLI")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--cmd", default="claude", help="CLI binary (default: claude)")
    ap.add_argument("--model", default="", help="default model / --model value")
    ap.add_argument("--timeout", type=int, default=120, help="per-request seconds")
    ap.add_argument("--selftest", action="store_true", help="run pure-logic checks and exit")
    args = ap.parse_args()

    if args.selftest:
        _selftest()
        return

    Bridge.base_cmd = args.cmd
    Bridge.default_model = args.model
    Bridge.timeout = args.timeout

    # Startup health check: tell the user in THIS terminal whether the CLI is
    # logged in, before they wonder why the app shows "model HTTP 502".
    sys.stderr.write(f"cli-bridge: checking `{args.cmd}` … ")
    sys.stderr.flush()
    try:
        run_cli(args.cmd, args.model, [{"role": "user", "content": "Reply with: ok"}],
                min(args.timeout, 30))
        sys.stderr.write("logged in ✓\n")
    except RuntimeError as e:
        sys.stderr.write("NOT READY ✗\n  " + str(e) + "\n")
        sys.stderr.write(f"  (serving anyway; fix the CLI and requests will start working)\n")

    endpoint = f"http://localhost:{args.port}/v1"
    sys.stderr.write(
        f"cli-bridge: serving {endpoint}  →  {args.cmd}"
        f"{(' ' + args.model) if args.model else ''}\n"
        f"  In the app → Model setup: endpoint {endpoint}, model "
        f"{args.model or '(blank)'}, key (empty).\n"
        f"  Ctrl-C to stop.\n"
    )
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Bridge)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\ncli-bridge: stopped.\n")


if __name__ == "__main__":
    main()
