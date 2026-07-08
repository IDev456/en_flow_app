#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

docker run --rm -v "${REPO_ROOT}:/app" -w /app/frontend node:20-alpine sh -c "npm test"
