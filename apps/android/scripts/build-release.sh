#!/usr/bin/env bash
#
# Build a signed release AAB (Android App Bundle) for Google Play Store upload.
#
# Prerequisites:
#   1. Java 17+ (JAVA_HOME set)
#   2. Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT set)
#   3. Keystore configured in keystore.properties (see README)
#   4. Digital Asset Links SHA-256 fingerprint configured in app/build.gradle
#
# Usage:
#   ./scripts/build-release.sh
#
# Output:
#   app/build/outputs/bundle/release/app-release.aab

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."

cd "$PROJECT_DIR"

echo "=== CoverGuard Android Release Build ==="
echo ""

# Validate environment
if [ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]; then
    echo "Error: ANDROID_HOME or ANDROID_SDK_ROOT must be set."
    echo "  macOS:  export ANDROID_HOME=\$HOME/Library/Android/sdk"
    echo "  Linux:  export ANDROID_HOME=\$HOME/Android/Sdk"
    exit 1
fi

if ! java -version 2>&1 | grep -q "17\|18\|19\|20\|21\|22"; then
    echo "Warning: Java 17+ recommended for Android Gradle Plugin 8.x"
fi

# Check keystore
if [ ! -f "keystore.properties" ]; then
    echo "Error: keystore.properties not found."
    echo ""
    echo "Create keystore.properties with:"
    echo "  storeFile=path/to/your-keystore.jks"
    echo "  storePassword=your-store-password"
    echo "  keyAlias=your-key-alias"
    echo "  keyPassword=your-key-password"
    echo ""
    echo "To generate a new keystore:"
    echo "  keytool -genkeypair -v -keystore coverguard-release.jks \\"
    echo "    -keyalg RSA -keysize 2048 -validity 10000 \\"
    echo "    -alias coverguard -storepass <password> -keypass <password>"
    exit 1
fi

echo "1/3  Cleaning previous build..."
./gradlew clean

echo "2/3  Running lint checks..."
./gradlew :app:lint

echo "3/3  Building release AAB..."
./gradlew :app:bundleRelease

AAB_PATH="app/build/outputs/bundle/release/app-release.aab"

if [ -f "$AAB_PATH" ]; then
    SIZE=$(du -h "$AAB_PATH" | cut -f1)
    echo ""
    echo "=== Build Successful ==="
    echo "  AAB: $AAB_PATH ($SIZE)"
    echo ""
    echo "Next steps:"
    echo "  1. Upload $AAB_PATH to Google Play Console"
    echo "  2. Complete the store listing (title, description, screenshots)"
    echo "  3. Fill out the content rating questionnaire"
    echo "  4. Complete the data safety form"
    echo "  5. Submit for review"
else
    echo "Error: Build output not found at $AAB_PATH"
    exit 1
fi
