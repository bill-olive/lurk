#!/usr/bin/env bash
# =============================================================================
# Lurk Desktop Daemon — Build & Package Script
#
# Compiles TypeScript, bundles with pkg, and creates a .dmg installer for macOS.
#
# Prerequisites:
#   npm install -g pkg create-dmg
#
# Usage:
#   ./scripts/build.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/build"
VERSION="0.1.0"

echo "╔══════════════════════════════════════╗"
echo "║  Lurk Desktop Daemon — Build v$VERSION  ║"
echo "╚══════════════════════════════════════╝"
echo

# 1. Clean
echo "[1/5] Cleaning previous builds..."
rm -rf "$DIST_DIR" "$BUILD_DIR"
mkdir -p "$BUILD_DIR/Lurk Daemon.app/Contents/MacOS"
mkdir -p "$BUILD_DIR/Lurk Daemon.app/Contents/Resources"

# 2. Compile TypeScript
echo "[2/5] Compiling TypeScript..."
cd "$PROJECT_DIR"
npx tsc

# 3. Bundle with pkg (arm64 + x64 universal)
echo "[3/5] Bundling with pkg..."
npx pkg dist/index.js \
  --target node20-macos-arm64,node20-macos-x64 \
  --output "$BUILD_DIR/lurk-daemon" \
  --compress GZip

# 4. Assemble .app bundle
echo "[4/5] Assembling application bundle..."

# Copy binary
cp "$BUILD_DIR/lurk-daemon" "$BUILD_DIR/Lurk Daemon.app/Contents/MacOS/lurk-daemon"

# Copy resources
cp "$PROJECT_DIR/resources/com.lurk.native_host.json" "$BUILD_DIR/Lurk Daemon.app/Contents/Resources/"
cp "$PROJECT_DIR/resources/com.lurk.daemon.plist" "$BUILD_DIR/Lurk Daemon.app/Contents/Resources/"

# Create Info.plist
cat > "$BUILD_DIR/Lurk Daemon.app/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Lurk Daemon</string>
  <key>CFBundleIdentifier</key>
  <string>com.lurk.daemon</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleExecutable</key>
  <string>lurk-daemon</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST

# Create post-install script
cat > "$BUILD_DIR/install.sh" << 'INSTALL'
#!/usr/bin/env bash
set -euo pipefail

echo "Installing Lurk Daemon..."

# Copy binary
sudo cp "/Volumes/Lurk Daemon/Lurk Daemon.app/Contents/MacOS/lurk-daemon" /usr/local/bin/lurk-daemon
sudo chmod +x /usr/local/bin/lurk-daemon

# Install Chrome native messaging manifest
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"
cp "/Volumes/Lurk Daemon/Lurk Daemon.app/Contents/Resources/com.lurk.native_host.json" "$MANIFEST_DIR/"

# Install launchd plist
cp "/Volumes/Lurk Daemon/Lurk Daemon.app/Contents/Resources/com.lurk.daemon.plist" "$HOME/Library/LaunchAgents/"
launchctl load "$HOME/Library/LaunchAgents/com.lurk.daemon.plist" 2>/dev/null || true

echo "Lurk Daemon installed successfully!"
echo "The daemon will start automatically on login."
echo "To start now: launchctl start com.lurk.daemon"
INSTALL
chmod +x "$BUILD_DIR/install.sh"

# 5. Create DMG
echo "[5/5] Creating DMG..."
if command -v create-dmg &> /dev/null; then
  create-dmg \
    --volname "Lurk Daemon" \
    --volicon "$PROJECT_DIR/resources/icon.icns" 2>/dev/null || true \
    --window-pos 200 120 \
    --window-size 600 400 \
    --icon "Lurk Daemon.app" 150 200 \
    --icon "install.sh" 450 200 \
    "$BUILD_DIR/Lurk-Daemon-$VERSION.dmg" \
    "$BUILD_DIR/" 2>/dev/null || {
      # Fallback: use hdiutil directly
      hdiutil create -volname "Lurk Daemon" -srcfolder "$BUILD_DIR" -ov -format UDZO "$BUILD_DIR/Lurk-Daemon-$VERSION.dmg"
    }
else
  echo "create-dmg not found, using hdiutil..."
  hdiutil create -volname "Lurk Daemon" -srcfolder "$BUILD_DIR" -ov -format UDZO "$BUILD_DIR/Lurk-Daemon-$VERSION.dmg"
fi

echo
echo "Build complete!"
echo "  Binary: $BUILD_DIR/lurk-daemon"
echo "  DMG:    $BUILD_DIR/Lurk-Daemon-$VERSION.dmg"
