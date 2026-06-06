#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DMG_PATH="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle/dmg/C-teacher_0.1.0_aarch64.dmg"

cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required to build the DMG." >&2
  exit 1
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
npm run build:dmg

if [ ! -f "$DMG_PATH" ]; then
  echo "Error: DMG was not created at expected path: $DMG_PATH" >&2
  exit 1
fi

echo "DMG ready:"
echo "$DMG_PATH"
