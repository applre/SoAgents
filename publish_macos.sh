#!/bin/bash
# SoAgents macOS Release Publisher
# Packages, signs, and uploads build artifacts to Cloudflare R2
#
# Prerequisites:
#   - rclone configured with R2 remote named "r2"
#   - Build completed: npm run tauri:build
#   - Signing key at ~/.tauri/soagents.key
#
# Usage:
#   ./publish_macos.sh [--dry-run]

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────

BUCKET="soagents-releases"
R2_REMOTE="r2"
BASE_URL="https://download.soagents.ai"
SIGNING_KEY_PATH="$HOME/.tauri/soagents.key"

# Read version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Publishing SoAgents v${VERSION} for macOS..."

# ── Detect architecture ──────────────────────────────────────────

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64"
    TAURI_TARGET="darwin-aarch64"
elif [ "$ARCH" = "x86_64" ]; then
    TARGET="x86_64"
    TAURI_TARGET="darwin-x86_64"
else
    echo "ERROR: Unsupported architecture: $ARCH"
    exit 1
fi

echo "Architecture: ${ARCH} -> Target: ${TAURI_TARGET}"

# ── Locate .app bundle ───────────────────────────────────────────

BUNDLE_DIR="src-tauri/target/release/bundle"
APP_BUNDLE="${BUNDLE_DIR}/macos/SoAgents.app"

if [ ! -d "$APP_BUNDLE" ]; then
    echo "ERROR: App bundle not found: $APP_BUNDLE"
    echo "Run 'TAURI_SIGNING_PRIVATE_KEY=\"\$(cat ~/.tauri/soagents.key)\" npm run tauri:build' first."
    exit 1
fi

# ── Re-sign bun binary with JIT entitlements ─────────────────────
# Bun needs JIT compilation to run JavaScript. macOS Hardened Runtime
# blocks JIT by default, so we must explicitly grant the entitlement.

ENTITLEMENTS_FILE="src-tauri/Entitlements.plist"
BUN_BINARY="${APP_BUNDLE}/Contents/MacOS/bun"

if [ -f "$BUN_BINARY" ] && [ -f "$ENTITLEMENTS_FILE" ]; then
    SIGN_IDENTITY="${APPLE_SIGNING_IDENTITY:--}"
    echo "Re-signing bun binary with JIT entitlements (identity: ${SIGN_IDENTITY})..."
    codesign --force --sign "$SIGN_IDENTITY" --entitlements "$ENTITLEMENTS_FILE" "$BUN_BINARY"
    echo "Bun binary re-signed with JIT entitlements."
else
    echo "WARNING: bun binary or entitlements file not found, skipping re-sign"
    [ ! -f "$BUN_BINARY" ] && echo "  Missing: $BUN_BINARY"
    [ ! -f "$ENTITLEMENTS_FILE" ] && echo "  Missing: $ENTITLEMENTS_FILE"
fi

# ── Create .tar.gz from .app ─────────────────────────────────────

APP_TAR="${BUNDLE_DIR}/macos/SoAgents.app.tar.gz"
APP_SIG="${BUNDLE_DIR}/macos/SoAgents.app.tar.gz.sig"

echo "Creating tar.gz from SoAgents.app..."
cd "${BUNDLE_DIR}/macos"
COPYFILE_DISABLE=1 tar -czf SoAgents.app.tar.gz SoAgents.app
cd - > /dev/null

echo "Created: $APP_TAR ($(du -h "$APP_TAR" | cut -f1))"

# ── Sign with tauri signer ───────────────────────────────────────

if [ ! -f "$SIGNING_KEY_PATH" ]; then
    echo "ERROR: Signing key not found: $SIGNING_KEY_PATH"
    exit 1
fi

echo "Signing with tauri signer..."
npx tauri signer sign "$APP_TAR" --private-key-path "$SIGNING_KEY_PATH" --password "soagents" 2>&1

if [ ! -f "$APP_SIG" ]; then
    echo "ERROR: Signature file was not created: $APP_SIG"
    exit 1
fi

SIGNATURE=$(cat "$APP_SIG")
echo "Signature length: ${#SIGNATURE} chars"

# ── Generate update manifest ─────────────────────────────────────

RELEASE_FILENAME="SoAgents_${VERSION}_${TARGET}.app.tar.gz"
RELEASE_URL="${BASE_URL}/releases/v${VERSION}/${RELEASE_FILENAME}"

MANIFEST=$(cat <<EOF
{
  "version": "${VERSION}",
  "notes": "SoAgents v${VERSION}",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "${TAURI_TARGET}": {
      "url": "${RELEASE_URL}",
      "signature": "${SIGNATURE}"
    }
  }
}
EOF
)

MANIFEST_FILE=$(mktemp)
echo "$MANIFEST" > "$MANIFEST_FILE"
echo "Update manifest generated."

# ── Check for dry-run ────────────────────────────────────────────

if [ "${1:-}" = "--dry-run" ]; then
    echo ""
    echo "=== DRY RUN ==="
    echo "Would upload:"
    echo "  $APP_TAR -> ${BUCKET}/releases/v${VERSION}/${RELEASE_FILENAME}"
    echo "  manifest  -> ${BUCKET}/update/${TAURI_TARGET}.json"
    echo ""
    echo "Manifest content:"
    cat "$MANIFEST_FILE"
    rm "$MANIFEST_FILE"
    exit 0
fi

# ── Upload to R2 ─────────────────────────────────────────────────

echo ""
echo "Uploading build artifact..."
rclone copyto "$APP_TAR" "${R2_REMOTE}:${BUCKET}/releases/v${VERSION}/${RELEASE_FILENAME}" --progress

echo "Uploading update manifest..."
rclone copyto "$MANIFEST_FILE" "${R2_REMOTE}:${BUCKET}/update/${TAURI_TARGET}.json" --progress

rm "$MANIFEST_FILE"

# ── Verify ───────────────────────────────────────────────────────

echo ""
echo "=== Upload Complete ==="
echo "Release: ${BASE_URL}/releases/v${VERSION}/${RELEASE_FILENAME}"
echo "Manifest: ${BASE_URL}/update/${TAURI_TARGET}.json"
echo ""
echo "Verify with:"
echo "  curl -s ${BASE_URL}/update/${TAURI_TARGET}.json | jq ."
echo ""
echo "Done!"
