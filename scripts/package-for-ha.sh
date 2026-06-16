#!/usr/bin/env bash
# Package a clean copy for Home Assistant /addons/medication_tracker/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/dist-ha/medication_tracker"

echo "Packaging Home Assistant app to dist-ha/medication_tracker/ ..."

rm -rf "${ROOT}/dist-ha"
mkdir -p "$OUT"

rsync -a \
  --exclude node_modules \
  --exclude client/node_modules \
  --exclude server/node_modules \
  --exclude client/dist \
  --exclude server/dist \
  --exclude .env \
  --exclude deploy.local.env \
  --exclude deploy.local.env.example \
  --exclude .git \
  --exclude dist-ha \
  --exclude '*.log' \
  --exclude .DS_Store \
  --exclude Dockerfile.standalone \
  --exclude docker-compose.yml \
  "$ROOT/" "$OUT/"

# Ensure entrypoint is executable
chmod +x "$OUT/run.sh"

VERSION="$(grep -E '^version:' "$ROOT/config.yaml" | sed 's/version:[[:space:]]*"\?\([^"]*\)"\?/\1/')"
echo "$VERSION" > "$OUT/APP_VERSION"

ARCHIVE="${ROOT}/dist-ha/medication_tracker-${VERSION}.tar.gz"
tar -czf "$ARCHIVE" -C "${ROOT}/dist-ha" medication_tracker

echo "Package version: ${VERSION}"
echo ""
echo "Ready to copy to Home Assistant:"
echo "  Folder:  ${OUT}"
echo "  Archive: ${ARCHIVE}"
echo ""
echo "After copying, verify ON THE HA HOST:"
echo "  grep version /addons/medication_tracker/config.yaml"
echo "  # must show: version: \"${VERSION}\""
echo ""
echo "Then: Settings → Apps → Check for updates → Update (or uninstall + reinstall)"
echo ""
echo "Logs should show: Starting Medication Tracker v${VERSION}..."
