#!/bin/sh
# Build build/icon.icns from build/icon-master.png (1024x1024, macOS only).
# Usage: ./build/make-icon.sh [master.png]
#
# Prefers Apple's iconutil; falls back to the bundled pure-Python packer
# because iconutil rejects valid sets on some macOS releases.
set -eu
cd "$(dirname "$0")/.."
MASTER="${1:-build/icon-master.png}"
if [ ! -f "$MASTER" ]; then
  echo "error: icon master not found: $MASTER" >&2
  echo "Provide a 1024x1024 PNG (see tasks/plan-electron.md) and re-run." >&2
  exit 1
fi

ICONSET="build/icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
# iconutil wants these exact sizes; sips -z takes height then width.
for spec in "16:icon_16x16" "32:icon_16x16@2x" "32:icon_32x32" "64:icon_32x32@2x" \
            "128:icon_128x128" "256:icon_128x128@2x" "256:icon_256x256" \
            "512:icon_256x256@2x" "512:icon_512x512" "1024:icon_512x512@2x"; do
  size="${spec%%:*}"
  name="${spec##*:}"
  sips -z "$size" "$size" "$MASTER" --out "$ICONSET/$name.png" >/dev/null
done

if iconutil -c icns "$ICONSET" -o build/icon.icns 2>/dev/null; then
  echo "wrote build/icon.icns (via iconutil)"
else
  echo "iconutil rejected the set; packing with build/pack-icns.py instead" >&2
  python3 build/pack-icns.py "$MASTER" build/icon.icns
fi
rm -rf "$ICONSET"
