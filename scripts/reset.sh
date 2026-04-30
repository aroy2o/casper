#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [[ -z "${ADMIN_TOKEN}" ]]; then
  echo "Set ADMIN_TOKEN to call admin reset endpoint."
  exit 1
fi

echo "[1/3] Calling admin reset endpoint..."
curl -sS -X DELETE "${API_URL}/api/admin/reset" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json"
echo

echo "[2/3] Running live reset-and-seed script..."
cd "$(dirname "$0")/../backend"
npx tsx src/scripts/reset-and-seed.ts

echo "[3/3] Done."
