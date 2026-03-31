#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STACK_DIR="${ROOT_DIR}/deploy/giom-prod"

cd "${STACK_DIR}"

echo "[deploy] starting GIOM production stack"
docker compose -f docker-compose.prod.yml up -d --build

echo "[deploy] waiting for services"
sleep 20

echo "[deploy] health checks"
curl -sSf http://localhost/health >/dev/null || true
curl -sSf "http://localhost/metrics/memoryContext?format=prometheus&includeDistributed=true" | head -n 20 || true

cd "${ROOT_DIR}"
node scripts/render-giom-poster-a3.mjs

cd "${STACK_DIR}"
./qa/stress-memory-prod.sh

echo "[deploy] done"
echo "[deploy] grafana: http://localhost:3000"
echo "[deploy] prometheus: http://localhost:9090"
