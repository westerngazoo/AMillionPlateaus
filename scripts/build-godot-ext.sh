#!/usr/bin/env bash
# Build the mp-godot GDExtension and copy the cdylib into apps/godot/bin/.
#
# Usage: ./scripts/build-godot-ext.sh [debug|release]
#
# Requires: Rust toolchain, sibling garust at ../garust (see Cargo.toml).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${1:-debug}"
FEATURES="--features gdext"

if [[ "$PROFILE" == "release" ]]; then
  CARGO_PROFILE="--release"
  OUT_DIR="release"
else
  CARGO_PROFILE=""
  OUT_DIR="debug"
fi

echo "Building mp-godot GDExtension ($PROFILE)…"
cd "$ROOT"
cargo build -p mp-godot $FEATURES $CARGO_PROFILE

BIN_DIR="$ROOT/apps/godot/bin"
mkdir -p "$BIN_DIR"

case "$(uname -s)" in
  Darwin)
    SRC="$ROOT/target/$OUT_DIR/libmp_godot.dylib"
    cp -f "$SRC" "$BIN_DIR/libmp_godot.dylib"
    echo "→ $BIN_DIR/libmp_godot.dylib"
    ;;
  Linux)
    SRC="$ROOT/target/$OUT_DIR/libmp_godot.so"
    cp -f "$SRC" "$BIN_DIR/libmp_godot.so"
    echo "→ $BIN_DIR/libmp_godot.so"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    SRC="$ROOT/target/$OUT_DIR/mp_godot.dll"
    cp -f "$SRC" "$BIN_DIR/mp_godot.dll"
    echo "→ $BIN_DIR/mp_godot.dll"
    ;;
  *)
    echo "Unsupported OS for GDExtension copy: $(uname -s)" >&2
    exit 1
    ;;
esac

echo "Done. Godot will load GraphSourceNative from apps/godot/bin/."
