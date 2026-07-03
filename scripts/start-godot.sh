#!/usr/bin/env bash
# Launch the Godot 4 immersive client (apps/godot).
#
# Usage:
#   ./scripts/start-godot.sh              # fixture or native seed_demo
#   MP_WORLD_BLOB=path/to/world.bin ./scripts/start-godot.sh
#
# Builds the GDExtension if missing. Set BUILD_GODOT=0 to skip the cargo build.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GODOT_PROJECT="$ROOT/apps/godot"
export MP_WORLD_BLOB="${MP_WORLD_BLOB:-$ROOT/apps/web/export/world.bin}"

find_godot() {
  if [[ -x "$ROOT/tools/godot/Godot" ]]; then
    echo "$ROOT/tools/godot/Godot"
  elif command -v godot4 >/dev/null 2>&1; then
    command -v godot4
  elif command -v godot >/dev/null 2>&1; then
    command -v godot
  else
    return 1
  fi
}

if ! GODOT="$(find_godot)"; then
  echo "Godot 4 not found. Run: ./scripts/install-godot.sh" >&2
  echo "  or install manually and add godot/godot4 to PATH." >&2
  exit 1
fi

if [[ "${BUILD_GODOT:-1}" != "0" ]]; then
  case "$(uname -s)" in
    Linux)  [[ -f "$GODOT_PROJECT/bin/libmp_godot.so" ]] || "$ROOT/scripts/build-godot-ext.sh" ;;
    Darwin) [[ -f "$GODOT_PROJECT/bin/libmp_godot.dylib" ]] || "$ROOT/scripts/build-godot-ext.sh" ;;
    *)      "$ROOT/scripts/build-godot-ext.sh" 2>/dev/null || true ;;
  esac
fi

mkdir -p "$(dirname "$MP_WORLD_BLOB")"

echo "Godot 3D world"
echo "  project: $GODOT_PROJECT"
echo "  binary:  $GODOT"
if [[ -f "$MP_WORLD_BLOB" ]]; then
  echo "  world:   $MP_WORLD_BLOB ($(wc -c < "$MP_WORLD_BLOB") bytes)"
else
  echo "  world:   (none — edit in web at http://localhost:8145, auto-syncs to export/world.bin)"
fi
echo ""
echo "Controls: right-drag look · WASD move · E/Q up/down · wheel zoom · Shift sprint · click plateau"
echo ""

exec "$GODOT" --path "$GODOT_PROJECT"
