#!/usr/bin/env bash
#
# Generate all required icon assets from a single high-res source image.
#
# Usage:
#   ./scripts/generate-icons.sh <path-to-1024x1024-icon.png>
#
# Prerequisites:
#   - ImageMagick (convert command): brew install imagemagick / apt install imagemagick
#
# This generates:
#   1. Android mipmap icons (mdpi through xxxhdpi)
#   2. Web PWA icons (48, 72, 96, 144, 192, 512)
#   3. Maskable icons for adaptive icon support
#   4. Play Store feature graphic placeholder

set -euo pipefail

SOURCE="${1:?Usage: $0 <path-to-1024x1024-icon.png>}"

if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required. Install with:"
    echo "  macOS:  brew install imagemagick"
    echo "  Linux:  sudo apt install imagemagick"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_RES="$SCRIPT_DIR/../app/src/main/res"
WEB_ICONS="$SCRIPT_DIR/../../web/public/icons"

mkdir -p "$WEB_ICONS"

echo "==> Generating Android mipmap icons..."

# Android icon sizes per density (48dp base)
declare -A ANDROID_SIZES=(
    ["mipmap-mdpi"]=48
    ["mipmap-hdpi"]=72
    ["mipmap-xhdpi"]=96
    ["mipmap-xxhdpi"]=144
    ["mipmap-xxxhdpi"]=192
)

for folder in "${!ANDROID_SIZES[@]}"; do
    size="${ANDROID_SIZES[$folder]}"
    mkdir -p "$ANDROID_RES/$folder"
    convert "$SOURCE" -resize "${size}x${size}" "$ANDROID_RES/$folder/ic_launcher.png"
    convert "$SOURCE" -resize "${size}x${size}" \
        \( +clone -threshold -1 -negate -fill white -draw "circle $((size/2)),$((size/2)) $((size/2)),0" \) \
        -alpha off -compose CopyOpacity -composite \
        "$ANDROID_RES/$folder/ic_launcher_round.png"
    echo "    $folder: ${size}x${size}"
done

echo "==> Generating web PWA icons..."

for size in 48 72 96 144 192 512; do
    convert "$SOURCE" -resize "${size}x${size}" "$WEB_ICONS/icon-${size}.png"
    echo "    icon-${size}.png"
done

echo "==> Generating maskable icons (with 20% safe-zone padding)..."

for size in 192 512; do
    # Maskable icons need 20% padding around the logo
    inner=$((size * 80 / 100))
    convert "$SOURCE" -resize "${inner}x${inner}" \
        -gravity center -background "#0d1929" -extent "${size}x${size}" \
        "$WEB_ICONS/maskable-${size}.png"
    echo "    maskable-${size}.png"
done

echo "==> Generating Play Store high-res icon (512x512)..."
convert "$SOURCE" -resize "512x512" "$SCRIPT_DIR/../store-listing/graphics/icon-512.png"

echo ""
echo "Done! Icon assets generated."
echo ""
echo "Next steps:"
echo "  1. Replace the source icon with your final CoverGuard logo"
echo "  2. Create a feature graphic (1024x500) at store-listing/graphics/feature-graphic.png"
echo "  3. Add Play Store screenshots (min 2) at store-listing/screenshots/"
