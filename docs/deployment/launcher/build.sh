#!/bin/sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app=${1:?Usage: build.sh /absolute/output/OmniFocus MCP.app}
signing_identity=${SIGNING_IDENTITY:?Set SIGNING_IDENTITY to your Developer ID Application identity or certificate fingerprint}
case "$app" in
    /*.app) ;;
    *) echo 'Output must be an absolute .app path' >&2; exit 64 ;;
esac
if [ -e "$app" ]; then
    echo "Output already exists: $app" >&2
    exit 1
fi

mkdir -p "$app/Contents/MacOS"
cp "$source_dir/Info.plist" "$app/Contents/Info.plist"
xcrun clang -std=c11 -Wall -Wextra -Werror -O2 "$source_dir/main.c" \
    -o "$app/Contents/MacOS/omnifocus-mcp-launcher"
codesign --sign "$signing_identity" \
    --options runtime --timestamp --entitlements "$source_dir/entitlements.plist" "$app"
codesign --verify --strict --verbose=2 "$app"
codesign -d -r- "$app"
