#!/bin/bash
# Ad-hoc sign macOS app and DMG to bypass Gatekeeper
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$SCRIPT_DIR/src-tauri/target/release/bundle/macos/C-teacher.app"
DMG_DIR="$SCRIPT_DIR/src-tauri/target/release/bundle/dmg"

if [ -d "$APP_PATH" ]; then
  echo "Signing C-teacher.app..."
  codesign --force --deep --sign - "$APP_PATH"
  echo "App signed."
fi

for dmg in "$DMG_DIR"/*.dmg; do
  if [ -f "$dmg" ]; then
    echo "Signing $(basename "$dmg")..."
    codesign --force --sign - "$dmg"
    echo "DMG signed."
  fi
done

echo "Done."
