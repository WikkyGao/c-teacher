#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
DMG_DIR="$DESKTOP_DIR/src-tauri/target/release/bundle/dmg"
OUTPUT_DIR="$ROOT_DIR/outputs"

cd "$ROOT_DIR"

# --- prerequisites ---
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required to build the DMG." >&2
  exit 1
fi

if [ -f "$HOME/.cargo/env" ]; then
  source "$HOME/.cargo/env"
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: Rust/Cargo is required for Tauri packaging." >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Installing npm dependencies..."
  npm install
fi

# --- build ---
echo "Building C-teacher DMG..."
cd "$DESKTOP_DIR"
npx tauri build --bundles dmg
cd "$ROOT_DIR"

# --- locate DMG ---
DMG_PATH="$(find "$DMG_DIR" -maxdepth 1 -type f -name 'C-teacher_*.dmg' 2>/dev/null | sort -r | head -n 1)"
if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
  echo "Error: DMG was not created in: $DMG_DIR" >&2
  exit 1
fi

# --- copy to outputs ---
mkdir -p "$OUTPUT_DIR"
cp "$DMG_PATH" "$OUTPUT_DIR/"

echo ""
echo "DMG ready:"
echo "  $DMG_PATH"
echo "  $OUTPUT_DIR/$(basename "$DMG_PATH")"
