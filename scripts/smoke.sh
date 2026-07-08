#!/usr/bin/env bash
# smoke.sh — server lifecycle around scripts/smoke.mjs (the real check; see its
# header). Needs: apps/web/pkg built, python3, node >= 22 (built-in WebSocket),
# and a Chrome/Chromium (CHROME_BIN to override discovery).
set -euo pipefail

PORT="${1:-8151}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$ROOT/apps/web/pkg/mp_wasm.js" ] || { echo "smoke: apps/web/pkg missing — build wasm first"; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || { echo "smoke: node >= 22 required (built-in WebSocket); got $(node --version)"; exit 1; }

python3 "$ROOT/scripts/serve.py" "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1

node "$ROOT/scripts/smoke.mjs" "$PORT"
