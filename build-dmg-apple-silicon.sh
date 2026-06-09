#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_TRIPLE="aarch64-apple-darwin"
TARGET_LABEL="aarch64"
DMG_DIR="$ROOT_DIR/apps/desktop/src-tauri/target/$TARGET_TRIPLE/release/bundle/dmg"
OUTPUT_DIR="$ROOT_DIR/outputs"

cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required to build the Apple Silicon DMG." >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: Rust/Cargo is required for Tauri packaging." >&2
  exit 1
fi

if ! rustup target list --installed 2>/dev/null | grep -qx "$TARGET_TRIPLE"; then
  echo "Error: Rust target $TARGET_TRIPLE is not installed." >&2
  echo "Run: rustup target add $TARGET_TRIPLE" >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Installing npm dependencies..."
  npm install
fi

echo "Building C-teacher Apple Silicon DMG ($TARGET_TRIPLE)..."
rm -f "$DMG_DIR"/C-teacher_*.dmg "$DMG_DIR"/rw.*.C-teacher_*.dmg
npm run tauri --workspace @c-teacher/desktop -- build --target "$TARGET_TRIPLE" --bundles dmg

DMG_PATH="$(find "$DMG_DIR" -maxdepth 1 -type f -name "C-teacher_*_${TARGET_LABEL}.dmg" -print0 | xargs -0 ls -t | head -n 1)"
if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
  echo "Error: Apple Silicon DMG was not created in expected directory: $DMG_DIR" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_DMG_PATH="$OUTPUT_DIR/$(basename "$DMG_PATH")"
cp "$DMG_PATH" "$OUTPUT_DMG_PATH"

echo "Apple Silicon DMG ready:"
echo "$DMG_PATH"
echo "$OUTPUT_DMG_PATH"
