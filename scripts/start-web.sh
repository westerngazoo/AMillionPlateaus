#!/usr/bin/env bash
# Start the fog-world dev server (apps/web).
#
# Usage (from repo root):
#   ./scripts/start-web.sh          # http://localhost:8145
#   ./scripts/start-web.sh 9000   # custom port
#
# Uses scripts/serve.py (no-cache headers) so wasm/JS reloads stay fresh after rebuilds.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8145}"

echo "→ http://localhost:${PORT}"
echo "  serving ${ROOT}/apps/web (no-cache)"
echo "  Ctrl+C to stop"
echo ""

exec python3 "${ROOT}/scripts/serve.py" "${PORT}"
