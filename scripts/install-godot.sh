#!/usr/bin/env bash
# Install Godot 4.4 editor binary into tools/godot/ (local, gitignored).
#
# Usage: ./scripts/install-godot.sh
#
# Linux x86_64 only in this script; on macOS install Godot.app manually or via brew.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/tools/godot"
VERSION="4.4-stable"

mkdir -p "$TOOLS"

find_godot() {
  if [[ -x "$TOOLS/Godot" ]]; then
    echo "$TOOLS/Godot"
    return 0
  fi
  if command -v godot4 >/dev/null 2>&1; then
    command -v godot4
    return 0
  fi
  if command -v godot >/dev/null 2>&1; then
    command -v godot
    return 0
  fi
  return 1
}

if find_godot >/dev/null; then
  echo "Godot already available: $(find_godot)"
  exit 0
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

if [[ "$OS" != "Linux" || "$ARCH" != "x86_64" ]]; then
  echo "Auto-install is Linux x86_64 only." >&2
  echo "Install Godot 4.4 manually and ensure 'godot' or 'godot4' is on PATH." >&2
  echo "  macOS: brew install --cask godot" >&2
  exit 1
fi

ZIP="Godot_v${VERSION}_linux.x86_64.zip"
URL="https://github.com/godotengine/godot/releases/download/${VERSION}/${ZIP}"
TMP="$(mktemp -d)"

echo "Downloading Godot ${VERSION}…"
curl -fsSL "$URL" -o "$TMP/$ZIP"
unzip -q "$TMP/$ZIP" -d "$TMP"
mv "$TMP"/Godot_v"${VERSION}"_linux.x86_64 "$TOOLS/Godot"
chmod +x "$TOOLS/Godot"
rm -rf "$TMP"

echo "Installed → $TOOLS/Godot"
echo "start-godot.sh will use this automatically."
