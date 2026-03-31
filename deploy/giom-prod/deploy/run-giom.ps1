$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$stack = Join-Path $root "deploy\giom-prod"

Set-Location $stack

Write-Host "[deploy] starting GIOM production stack"
docker compose -f docker-compose.prod.yml up -d --build

Write-Host "[deploy] waiting for services"
Start-Sleep -Seconds 20

Write-Host "[deploy] health checks"
try { Invoke-WebRequest -UseBasicParsing -Uri "http://localhost/health" | Out-Null } catch {}
try {
  (Invoke-WebRequest -UseBasicParsing -Uri "http://localhost/metrics/memoryContext?format=prometheus&includeDistributed=true").Content |
    Select-Object -First 20 | Out-Null
} catch {}

Set-Location $root
node scripts/render-giom-poster-a3.mjs

Set-Location $stack
powershell -ExecutionPolicy Bypass -File ".\qa\stress-memory-prod.ps1"

Write-Host "[deploy] done"
Write-Host "[deploy] grafana: http://localhost:3000"
Write-Host "[deploy] prometheus: http://localhost:9090"
