#!/usr/bin/env bash
set -euo pipefail

# FidesOrigin SDK — Publish to GitHub Packages
# Usage: GITHUB_TOKEN=<your-token> ./publish.sh

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "❌ GITHUB_TOKEN is not set. Please export your GitHub personal access token (with write:packages scope)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# .npmrc already references ${GITHUB_TOKEN} via env substitution
echo "🔐 Publishing @fidesorigin/sdk to GitHub Packages..."
npm publish --access restricted

echo "✅ Publish complete."
