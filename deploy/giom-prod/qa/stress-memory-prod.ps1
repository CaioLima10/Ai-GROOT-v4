param(
  [string]$BaseUrl = "http://localhost",
  [int]$Requests = 100,
  [int]$Parallel = 10
)

function Invoke-StressEndpoint {
  param(
    [string]$Endpoint
  )

  Write-Host "[stress] endpoint=$Endpoint requests=$Requests parallel=$Parallel"

  $jobs = @()
  for ($i = 1; $i -le $Requests; $i++) {
    while ((Get-Job -State Running).Count -ge $Parallel) {
      Start-Sleep -Milliseconds 150
    }

    $idx = $i
    $jobs += Start-Job -ScriptBlock {
      param($Url, $N)
      $body = @{ query = "health check $N" } | ConvertTo-Json -Compress
      try {
        Invoke-RestMethod -Method Post -Uri $Url -ContentType "application/json" -Body $body | Out-Null
      } catch {
        # keep stress loop resilient
      }
    } -ArgumentList "$BaseUrl$Endpoint", $idx
  }

  $jobs | Wait-Job | Out-Null
  $jobs | Remove-Job -Force | Out-Null
}

Invoke-StressEndpoint -Endpoint "/ask"
Invoke-StressEndpoint -Endpoint "/ask/stream"

Write-Host "[stress] done"
