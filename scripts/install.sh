#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing dependencies..."
npm ci
npm ci --prefix server
npm ci --prefix client

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example — edit it before starting."
  cp .env.example .env
fi

echo "Building client and server..."
npm run build

echo "Done. Start with: npm run start:prod"
echo "Or Docker:      docker compose up -d --build"
