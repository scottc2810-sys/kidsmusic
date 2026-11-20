# Melo setup for Windows (PowerShell 5.1+). Requires Python 3.11+ and Node.js 18+.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Checking tools"
$py = (Get-Command py -ErrorAction SilentlyContinue) ; if ($py) { $Python = "py -3" } else { $Python = "python" }
Invoke-Expression "$Python --version"
node --version

Write-Host "==> Backend virtual environment"
if (-not (Test-Path "backend\.venv")) { Invoke-Expression "$Python -m venv backend\.venv" }
& backend\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt -c backend\requirements.lock --quiet

Write-Host "==> Frontend build"
Push-Location frontend
if (Test-Path package-lock.json) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
npm run build
Pop-Location

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host "==> Created .env (edit it to add ANTHROPIC_API_KEY)" }
Write-Host "`nSetup complete. Start Melo with:  .\scripts\run.ps1"
