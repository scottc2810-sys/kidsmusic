# Build the Windows app and its one-click installer.
#   powershell -ExecutionPolicy Bypass -File packaging\windows\build.ps1
# Output: dist\Melo\Melo.exe (the app), dist\Melo-windows.zip (portable copy) and, when Inno Setup
# is installed, dist\Melo-Setup-<version>.exe (the installer to give to families).
# Needs Python 3.11+ and Node.js 18+. Inno Setup: winget install JRSoftware.InnoSetup
# -InstallerOnly rebuilds only Setup.exe from dist\Melo (used after Melo.exe has been code-signed).
# MELO_PUBLISHER sets the publisher shown by Windows (must match the signing certificate's name).
param([switch]$InstallerOnly)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root
$Version = "1.5.0"
$Py = "backend\.venv\Scripts\python.exe"

if (-not $InstallerOnly) {
Write-Host "==> Python environment"
if (-not (Test-Path $Py)) { python -m venv backend\.venv }
& $Py -m pip install --quiet --upgrade pip
& $Py -m pip install --quiet -r backend\requirements.txt -c backend\requirements.lock pyinstaller pillow
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Write-Host "==> Web app"
Push-Location frontend
if (-not (Test-Path node_modules)) { npm ci --no-audit --no-fund }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "frontend build failed" }
Pop-Location

Write-Host "==> Desktop app"
& $Py packaging\make_icons.py
& $Py -m PyInstaller packaging\melo.spec --noconfirm --distpath dist --workpath build
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (is Melo still running? close it first)" }
Compress-Archive -Path dist\Melo -DestinationPath dist\Melo-windows.zip -Force
}

Write-Host "==> Installer"
$Iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Iscc) { $cmd = Get-Command iscc -ErrorAction SilentlyContinue; if ($cmd) { $Iscc = $cmd.Source } }
if ($Iscc) {
  $Publisher = if ($env:MELO_PUBLISHER) { $env:MELO_PUBLISHER } else { "Melo" }
  & $Iscc "/DAppVersion=$Version" "/DAppPublisher=$Publisher" packaging\windows\melo.iss
  if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed" }
  Write-Host "`nDone: dist\Melo-Setup-$Version.exe"
} else {
  Write-Host "`nInno Setup is not installed, so no Setup.exe was made."
  Write-Host "Install it once with:  winget install JRSoftware.InnoSetup   then run this script again."
  Write-Host "Meanwhile dist\Melo-windows.zip is a portable copy: unzip and double-click Melo.exe."
}
