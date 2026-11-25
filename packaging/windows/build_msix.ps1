# Build the Microsoft Store package (MSIX) from dist\Melo (run packaging\windows\build.ps1 first).
#   powershell -ExecutionPolicy Bypass -File packaging\windows\build_msix.ps1
# Output: dist\Melo-<version>.msix, UNSIGNED: upload it in Partner Center and the Store signs it.
# Needs makeappx.exe from the Windows SDK (present on GitHub's windows-latest runners).
# Identity: MSIX_IDENTITY_NAME, MSIX_PUBLISHER, MSIX_PUBLISHER_DISPLAY from the environment (Partner Center ->
# your app -> Product identity). The placeholders below only let the package build and be checked.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root
$Version = "1.6.0"
$Py = if (Test-Path "backend\.venv\Scripts\python.exe") { "backend\.venv\Scripts\python.exe" } else { "python" }
if (-not (Test-Path "dist\Melo\Melo.exe")) { throw "dist\Melo\Melo.exe is missing: run packaging\windows\build.ps1 first" }

$Name = if ($env:MSIX_IDENTITY_NAME) { $env:MSIX_IDENTITY_NAME } else { "MeloKids.Melo" }
$Publisher = if ($env:MSIX_PUBLISHER) { $env:MSIX_PUBLISHER } else { "CN=Melo Placeholder" }
$Display = if ($env:MSIX_PUBLISHER_DISPLAY) { $env:MSIX_PUBLISHER_DISPLAY } else { "Melo" }
if (-not $env:MSIX_PUBLISHER) { Write-Host "Note: placeholder identity; set MSIX_IDENTITY_NAME / MSIX_PUBLISHER before uploading to the Store." }

Write-Host "==> Layout"
$Stage = "build\msix"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force "$Stage\Assets" | Out-Null
Copy-Item -Recurse "dist\Melo\*" $Stage
& $Py -c @"
from PIL import Image
src = Image.open('packaging/icons/melo.png').convert('RGBA')
for name, w, h in [('StoreLogo', 50, 50), ('Square44x44Logo', 44, 44), ('Square150x150Logo', 150, 150), ('Wide310x150Logo', 310, 150)]:
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    side = min(w, h)
    canvas.paste(src.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
    canvas.save(f'build/msix/Assets/{name}.png')
"@
if ($LASTEXITCODE -ne 0) { throw "logo generation failed (needs Pillow)" }
$manifest = Get-Content "packaging\windows\msix\AppxManifest.xml" -Raw
$manifest = $manifest.Replace("{{IDENTITY_NAME}}", $Name).Replace("{{PUBLISHER}}", $Publisher).Replace("{{PUBLISHER_DISPLAY}}", $Display).Replace("{{VERSION}}", "$Version.0")
Set-Content -Path "$Stage\AppxManifest.xml" -Value $manifest -Encoding UTF8

Write-Host "==> Pack"
$MakeAppx = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $MakeAppx) { throw "makeappx.exe not found: install the Windows SDK (it is on GitHub's windows-latest runners)" }
& $MakeAppx.FullName pack /d $Stage /p "dist\Melo-$Version.msix" /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }
Write-Host "`nDone: dist\Melo-$Version.msix (unsigned; the Microsoft Store signs it)"
