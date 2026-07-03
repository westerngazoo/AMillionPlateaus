#!/usr/bin/env bash
# Start web (2D) + Godot (3D) in parallel — the dual-client dev workflow.
#
# Usage: ./scripts/start-dev.sh [web-port]
#
#   Web:   http://localhost:8145  (default)
#   Godot: opens the 3D window; reloads when apps/web/export/world.bin changes
#
# Ctrl+C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8145}"
export MP_WORLD_BLOB="$ROOT/apps/web/export/world.bin"

mkdir -p "$ROOT/apps/web/export"

# ── Preflight health check (D4) ─────────────────────────────────────────────
# Fail fast with a helpful pointer if Godot is missing, instead of starting the
# web server and only discovering the problem when we try to launch Godot.
if [[ ! -x "$ROOT/tools/godot/Godot" ]] \
    && ! command -v godot4 >/dev/null 2>&1 \
    && ! command -v godot >/dev/null 2>&1; then
  echo "✖ Godot 4 not found — cannot start the 3D client." >&2
  echo "  Install it with:  ./scripts/install-godot.sh" >&2
  echo "  (or install Godot 4.4 yourself and put 'godot' / 'godot4' on PATH)" >&2
  exit 1
fi

cleanup() {
  echo ""
  echo "Stopping dev servers…"
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  [[ -n "${GODOT_PID:-}" ]] && kill "$GODOT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "═══════════════════════════════════════════════════════════"
echo "  A Million Plateaus — parallel dev (2D web + 3D Godot)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  2D map:  http://localhost:${PORT}"
echo "  3D world: Godot window (same CRDT blob via export/world.bin)"
echo ""
echo "  Edit in the browser → world + lens + reputation sync to Godot (~1s reload)"
echo "  Ctrl+C stops both"
echo ""

# Web server (background)
python3 "$ROOT/scripts/serve.py" "$PORT" &
WEB_PID=$!

# Brief pause so web is up before Godot if user alt-tabs immediately
sleep 0.5

# Godot (foreground — keeps terminal attached; web runs behind)
"$ROOT/scripts/start-godot.sh" &
GODOT_PID=$!

wait "$GODOT_PID" 2>/dev/null || wait
