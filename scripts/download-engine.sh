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

# Apply patches to worker JS
echo "Applying worker patches..."

# Patch: add 'readfile' command to worker message handler
# Allows browser to read files from the WASM virtual filesystem
if ! grep -q '"readfile"' "$DEST/swiftlatexpdftex.js"; then
  sed -i.bak 's/else if(cmd==="flushcache"){cleanDir(WORKROOT)}else{console.error("Unknown command "+cmd)}/else if(cmd==="readfile"){try{let d=FS.readFile(WORKROOT+"\/"+data["url"],{encoding:data["encoding"]||"utf8"});self.postMessage({"result":"ok","cmd":"readfile","url":data["url"],"data":d})}catch(e){self.postMessage({"result":"failed","cmd":"readfile","url":data["url"]})}}else if(cmd==="flushcache"){cleanDir(WORKROOT)}else{console.error("Unknown command "+cmd)}/' "$DEST/swiftlatexpdftex.js"
  rm -f "$DEST/swiftlatexpdftex.js.bak"
  echo "  readfile command: patched"
else
  echo "  readfile command: already present"
fi
