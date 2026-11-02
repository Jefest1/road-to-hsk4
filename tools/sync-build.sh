#!/bin/sh
# Copies the app into a short path: the installer tool can't read files under the long session folder.
SRC="$(cd "$(dirname "$0")/.." && pwd)"; B=/c/Users/anyan/AppData/Local/Temp/hsk4-build
node "$SRC/tools/build-page.js"
rm -rf "$B/js" "$B/data" "$B/vendor" "$B/licenses"
cp "$SRC/package.json" "$SRC/main.js" "$SRC/preload.js" "$SRC/index.html" "$B/"
cp -r "$SRC/js" "$SRC/data" "$SRC/vendor" "$SRC/licenses" "$B/"
mkdir -p "$B/build" && cp "$SRC/build/icon.png" "$B/build/"
