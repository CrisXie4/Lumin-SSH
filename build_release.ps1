$wailsJson = Get-Content "wails.json" | ConvertFrom-Json
$version = $wailsJson.info.productVersion

Write-Host "Start LuminSSH packaging process: V$version" -ForegroundColor Cyan

$basePath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$exePath = "$basePath\exe"
$portablePath = "$basePath\Portable"
$nsisPath = "$basePath\Packaging_Tools\nsis\nsis-3.08"
$goPath = "$basePath\Source_Codes\Lumin-Source\go\bin"

if (!(Test-Path $exePath)) { New-Item -ItemType Directory -Path $exePath | Out-Null }
if (!(Test-Path $portablePath)) { New-Item -ItemType Directory -Path $portablePath | Out-Null }

# Sync wails.json version to config.js
$configPath = "frontend\src\config.js"
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    $configContent = $configContent -replace "APP_VERSION = '.*?';", "APP_VERSION = '$version';"
    Set-Content -Path $configPath -Value $configContent
    Write-Host "Synced version $version to frontend config.js" -ForegroundColor Green
}

# Inject required paths
$env:PATH = "$goPath;$nsisPath;" + $env:PATH

Write-Host "`n[1/2] Compiling Portable Edition..." -ForegroundColor Yellow
wails build -clean -upx -ldflags "-s -w"
if ($LASTEXITCODE -ne 0) { Write-Error "Portable build failed"; exit 1 }

$portableDest = "$portablePath\Lumin_Portable_V$version.exe"
Write-Host "Output portable to: $portableDest" -ForegroundColor Green
Copy-Item -Path "build\bin\Lumin.exe" -Destination $portableDest -Force

Write-Host "`n[2/2] Compiling Setup Edition..." -ForegroundColor Yellow
wails build -clean -nsis -upx -ldflags "-s -w"
if ($LASTEXITCODE -ne 0) { Write-Error "Setup build failed"; exit 1 }

$setupDest = "$exePath\Lumin_Setup_V$version.exe"
Write-Host "Output setup to: $setupDest" -ForegroundColor Green
Copy-Item -Path "build\bin\Lumin-amd64-installer.exe" -Destination $setupDest -Force

Write-Host "`nPackaging completed successfully!" -ForegroundColor Cyan
