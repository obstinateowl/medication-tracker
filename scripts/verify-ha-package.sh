#!/usr/bin/env bash
# Verify the HA package before copying
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="${ROOT}/dist-ha/medication_tracker"

if [[ ! -d "$PKG" ]]; then
  echo "No package found. Run: npm run package:ha"
  exit 1
fi

echo "=== Source config.yaml ==="
grep '^version:' "$ROOT/config.yaml"

echo ""
echo "=== Package config.yaml ==="
grep '^version:' "$PKG/config.yaml"

echo ""
echo "=== Package APP_VERSION ==="
cat "$PKG/APP_VERSION" 2>/dev/null || echo "(missing — re-run npm run package:ha)"

echo ""
echo "=== build.yaml ==="
grep 'BUILD_VERSION' "$PKG/build.yaml"

echo ""
if diff -q "$ROOT/config.yaml" "$PKG/config.yaml" >/dev/null; then
  echo "OK: package matches source"
else
  echo "WARN: package config.yaml differs from source — run npm run package:ha"
fi
