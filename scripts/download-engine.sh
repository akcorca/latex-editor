#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$DIR/public/swiftlatex"
RELEASE_URL="https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v20022022/20-02-2022.zip"

mkdir -p "$DEST"

if [[ -f "$DEST/swiftlatexpdftex.js" && -f "$DEST/swiftlatexpdftex.wasm" ]]; then
  echo "SwiftLaTeX engine already downloaded."
  exit 0
fi

echo "Downloading SwiftLaTeX engine..."
TMP=$(mktemp -d)
curl -L -o "$TMP/swiftlatex.zip" "$RELEASE_URL" 2>/dev/null || {
  # Fallback: try the SwiftLaTeX/SwiftLaTeX repo
  RELEASE_URL="https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v17022022/17022022.zip"
  curl -L -o "$TMP/swiftlatex.zip" "$RELEASE_URL" 2>/dev/null
}
cd "$TMP"
unzip -o swiftlatex.zip
# Find and copy the files
find . -name "swiftlatexpdftex.js" -exec cp {} "$DEST/" \;
find . -name "swiftlatexpdftex.wasm" -exec cp {} "$DEST/" \;
rm -rf "$TMP"

if [[ -f "$DEST/swiftlatexpdftex.js" && -f "$DEST/swiftlatexpdftex.wasm" ]]; then
  echo "SwiftLaTeX engine downloaded successfully."
else
  echo "ERROR: Failed to download SwiftLaTeX engine files."
  exit 1
fi
