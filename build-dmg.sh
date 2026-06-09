#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DMG_DIR="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle/dmg"
OUTPUT_DIR="$ROOT_DIR/outputs"

cd "$ROOT_DIR"

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

echo "Building C-teacher DMG..."
rm -f "$DMG_DIR"/C-teacher_*.dmg "$DMG_DIR"/rw.*.C-teacher_*.dmg
npm run build:dmg

DMG_PATH="$(find "$DMG_DIR" -maxdepth 1 -type f -name 'C-teacher_*.dmg' -print0 | xargs -0 ls -t | head -n 1)"
if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
  echo "Error: DMG was not created in expected directory: $DMG_DIR" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
ROOT_DMG_PATH="$OUTPUT_DIR/$(basename "$DMG_PATH")"
cp "$DMG_PATH" "$ROOT_DMG_PATH"

echo "DMG ready:"
echo "$DMG_PATH"
echo "$ROOT_DMG_PATH"
