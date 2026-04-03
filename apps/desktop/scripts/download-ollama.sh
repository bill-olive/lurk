#!/usr/bin/env bash
# =============================================================================
# Download Ollama binary for bundling in the Lurk Desktop app
#
# Downloads the official Ollama CLI binary from GitHub releases.
# Run this before electron-builder to ensure resources/bin/ollama exists.
#
# Usage:
#   ./scripts/download-ollama.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$PROJECT_DIR/resources/bin"
OLLAMA_BIN="$BIN_DIR/ollama"
OLLAMA_VERSION="0.20.0"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  PLATFORM="darwin-arm64"
elif [ "$ARCH" = "x86_64" ]; then
  PLATFORM="darwin-amd64"
else
  echo "Unsupported architecture: $ARCH"
  exit 1
fi

# Check if already downloaded
if [ -f "$OLLAMA_BIN" ]; then
  echo "[Ollama] Binary already exists at $OLLAMA_BIN"
  echo "[Ollama] Delete it and re-run to download fresh."
  exit 0
fi

mkdir -p "$BIN_DIR"

# Try to copy from local brew install first (faster for dev)
BREW_OLLAMA="/opt/homebrew/bin/ollama"
if [ -f "$BREW_OLLAMA" ]; then
  echo "[Ollama] Copying from local brew install..."
  cp "$BREW_OLLAMA" "$OLLAMA_BIN"
  chmod +x "$OLLAMA_BIN"
  echo "[Ollama] Done: $OLLAMA_BIN ($(du -sh "$OLLAMA_BIN" | cut -f1))"
  exit 0
fi

# Download from GitHub releases
DOWNLOAD_URL="https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-${PLATFORM}"
echo "[Ollama] Downloading v${OLLAMA_VERSION} for ${PLATFORM}..."
echo "[Ollama] URL: $DOWNLOAD_URL"

curl -L --progress-bar -o "$OLLAMA_BIN" "$DOWNLOAD_URL"
chmod +x "$OLLAMA_BIN"

echo "[Ollama] Done: $OLLAMA_BIN ($(du -sh "$OLLAMA_BIN" | cut -f1))"
