# Run Azurite (if not already) and start SWA emulator with Functions
param(
  [switch]$NoAzurite
)

$ErrorActionPreference = 'Stop'

Write-Host 'Starting local development environment...' -ForegroundColor Cyan

if(-not $NoAzurite){
  $azurite = Get-Process -Name azurite -ErrorAction SilentlyContinue
  if(-not $azurite){
    Write-Host 'Launching Azurite on default ports...' -ForegroundColor Yellow
    Start-Process -FilePath azurite -ArgumentList '--silent' | Out-Null
    Start-Sleep -Seconds 2
  } else {
    Write-Host 'Azurite already running.' -ForegroundColor Green
  }
}

# Ensure dependencies for Functions
if(Test-Path api/package.json){
  Push-Location api
  if(-not (Test-Path node_modules)){
    Write-Host 'Installing API dependencies...' -ForegroundColor Yellow
    npm install --no-audit --no-fund | Out-Null
  }
  Pop-Location
}

# Start SWA emulator
Write-Host 'Starting SWA emulator (port 4280, API 7071)...' -ForegroundColor Cyan
swa start ./ --api-location ./api --config swa-cli.config.json --port 4280 --api-port 7071 --verbose
