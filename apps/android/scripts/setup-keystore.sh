#!/usr/bin/env bash
#
# Interactive keystore setup for CoverGuard Android signing.
#
# This script:
#   1. Generates a new release keystore (.jks)
#   2. Creates keystore.properties for Gradle
#   3. Extracts the SHA-256 fingerprint for Digital Asset Links
#
# Usage:
#   ./scripts/setup-keystore.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."

cd "$PROJECT_DIR"

KEYSTORE_FILE="coverguard-release.jks"
ALIAS="coverguard"

echo "=== CoverGuard Keystore Setup ==="
echo ""

if [ -f "$KEYSTORE_FILE" ]; then
    echo "Keystore already exists: $KEYSTORE_FILE"
    echo "To regenerate, delete the existing keystore first."
else
    echo "Generating new release keystore..."
    echo ""

    read -rp "Organization name (e.g., CoverGuard Inc.): " ORG_NAME
    read -rp "Country code (e.g., US): " COUNTRY
    read -rsp "Keystore password (min 6 chars): " STORE_PASS
    echo ""
    read -rsp "Key password (min 6 chars): " KEY_PASS
    echo ""

    keytool -genkeypair -v \
        -keystore "$KEYSTORE_FILE" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -alias "$ALIAS" \
        -storepass "$STORE_PASS" \
        -keypass "$KEY_PASS" \
        -dname "CN=CoverGuard, O=$ORG_NAME, C=$COUNTRY"

    echo ""
    echo "Keystore created: $KEYSTORE_FILE"
fi

# Create keystore.properties
cat > keystore.properties <<EOF
storeFile=$KEYSTORE_FILE
storePassword=$STORE_PASS
keyAlias=$ALIAS
keyPassword=$KEY_PASS
EOF

echo "Created: keystore.properties"

# Extract SHA-256 fingerprint
echo ""
echo "=== SHA-256 Certificate Fingerprint ==="
echo ""
FINGERPRINT=$(keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$ALIAS" -storepass "$STORE_PASS" 2>/dev/null | grep "SHA256:" | sed 's/.*SHA256: //')

if [ -n "$FINGERPRINT" ]; then
    echo "  $FINGERPRINT"
    echo ""
    echo "IMPORTANT: Update these files with the fingerprint above:"
    echo "  1. app/build.gradle → signingCertFingerprint"
    echo "  2. ../web/public/.well-known/assetlinks.json → sha256_cert_fingerprints"
else
    echo "Could not extract fingerprint. Run manually:"
    echo "  keytool -list -v -keystore $KEYSTORE_FILE -alias $ALIAS"
fi

echo ""
echo "SECURITY REMINDER:"
echo "  - NEVER commit $KEYSTORE_FILE or keystore.properties to git"
echo "  - Back up your keystore securely — you cannot update your app without it"
echo "  - Consider using Google Play App Signing for additional security"
