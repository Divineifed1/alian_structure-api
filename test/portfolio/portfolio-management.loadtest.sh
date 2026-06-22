#!/usr/bin/env bash
set -euo pipefail

# Minimal load test for portfolio endpoints (requires `npx autocannon`).
# Usage:
#   PORTFOLIO_TOKEN=... bash test/portfolio/portfolio-management.loadtest.sh

TOKEN="${PORTFOLIO_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Missing PORTFOLIO_TOKEN env var (JWT token)."
  exit 1
fi

BASE_URL="http://localhost:3000/api/v1/portfolio"

echo "Running load test against: $BASE_URL"

echo "1) POST / (create)"

npx -y autocannon -c 50 -a 20 -d 10 \
  -H "Authorization: Bearer $TOKEN" \
  -p "{\"name\":\"Load Portfolio\"}" \
  "$BASE_URL" \
  --method POST \
  --timeout 30000

echo "2) GET / (list)"

npx -y autocannon -c 50 -a 20 -d 10 \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL" \
  --method GET \
  --timeout 30000

echo "3) GET /:id (skips if id missing)"
if [[ -n "PORTFOLIO_ID:-" && "$PORTFOLIO_ID" != "-" ]]; then
  npx -y autocannon -c 50 -a 20 -d 10 \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/$PORTFOLIO_ID" \
    --method GET \
    --timeout 30000
else
  echo "Set PORTFOLIO_ID to test GET /:id"
fi

echo "Load test completed."

