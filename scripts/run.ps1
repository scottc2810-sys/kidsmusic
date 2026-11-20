# Start Melo on Windows. Open http://127.0.0.1:8000 (or the KM_HOST/KM_PORT from .env).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$HostAddr = if ($env:KM_HOST) { $env:KM_HOST } else { "127.0.0.1" }
$Port = if ($env:KM_PORT) { $env:KM_PORT } else { "8000" }
if (Test-Path "$Root\.env") {
  Get-Content "$Root\.env" | Where-Object { $_ -match '^\s*KM_(HOST|PORT)\s*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2; $v = ($v -split '#')[0].Trim()
    if ($k.Trim() -eq "KM_HOST" -and -not $env:KM_HOST) { $HostAddr = $v }
    if ($k.Trim() -eq "KM_PORT" -and -not $env:KM_PORT) { $Port = $v }
  }
}
Set-Location "$Root\backend"
Write-Host "Melo is starting on http://${HostAddr}:${Port}  (Ctrl+C to stop)"
# One worker: SQLite + in-process background analysis and rate limiting are designed for a single process.
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host $HostAddr --port $Port --workers 1 --proxy-headers
