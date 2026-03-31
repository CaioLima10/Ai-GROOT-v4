#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
REQUESTS="${REQUESTS:-100}"
PARALLEL="${PARALLEL:-10}"

run_load() {
  local endpoint="$1"
  echo "[stress] endpoint=${endpoint} requests=${REQUESTS} parallel=${PARALLEL}"
  seq 1 "${REQUESTS}" | xargs -I{} -P "${PARALLEL}" sh -c \
    "curl -s -o /dev/null -X POST '${BASE_URL}${endpoint}' -H 'Content-Type: application/json' -d '{\"query\":\"health check {}\"}'"
}

run_load "/ask"
run_load "/ask/stream"

echo "[stress] done"
