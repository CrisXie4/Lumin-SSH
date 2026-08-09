$wailsJson = Get-Content "wails.json" | ConvertFrom-Json
$version = $wailsJson.info.productVersion

Write-Host "Start LuminSSH packaging process: V$version" -ForegroundColor Cyan

$basePath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$nsisPath = "$basePath\Packaging_Tools\nsis\nsis-3.08"
$goPath = "$basePath\Source_Codes\Lumin-Source\go\bin"

# Sync version to config.js, package.json, package-lock.json
node -e "const fs=require('fs');const v=process.argv[1];let c=fs.readFileSync('frontend/src/config.js','utf8');c=c.replace(/APP_VERSION\s*=\s*'[^']*'/,'APP_VERSION = '+String.fromCharCode(39)+v+String.fromCharCode(39));fs.writeFileSync('frontend/src/config.js',c);const p=JSON.parse(fs.readFileSync('frontend/package.json','utf8'));p.version=v;fs.writeFileSync('frontend/package.json',JSON.stringify(p,null,2)+'\n');const pl=JSON.parse(fs.readFileSync('frontend/package-lock.json','utf8'));pl.version=v;if(pl.packages&&pl.packages[''])pl.packages[''].version=v;fs.writeFileSync('frontend/package-lock.json',JSON.stringify(pl,null,2)+'\n');console.log('Synced version '+v+' to config.js, package.json, package-lock.json')" "$version"

# Inject required paths
$env:PATH = "$goPath;$nsisPath;$env:USERPROFILE\go\bin;" + $env:PATH

Write-Host "`n[1/2] Building with Wails (portable + installer)..." -ForegroundColor Yellow
wails build -clean -upx -nsis -ldflags "-s -w"
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

Write-Host "`n[2/2] Renaming output files..." -ForegroundColor Yellow
$portableDest = "build\bin\Lumin-V$version-portable.exe"
$setupDest = "build\bin\Lumin-V$version-amd64-installer.exe"
Move-Item -Path "build\bin\Lumin.exe" -Destination $portableDest -Force
Move-Item -Path "build\bin\Lumin-amd64-installer.exe" -Destination $setupDest -Force

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host "  SUCCESS!" -ForegroundColor Cyan
Write-Host "  Portable:  $portableDest" -ForegroundColor Green
Write-Host "  Installer: $setupDest" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
