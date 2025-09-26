# Run Azurite (if not already) and start SWA emulator with Functions
param(
  [switch]$NoAzurite
)

$ErrorActionPreference = 'Stop'

Write-Host 'Starting local development environment...' -ForegroundColor Cyan

if(-not $NoAzurite){
  $azurite = Get-Process -Name azurite -ErrorAction SilentlyContinue
  if(-not $azurite){
    $azuriteCmd = 'azurite'
    if(-not (Get-Command azurite -ErrorAction SilentlyContinue)){
      Write-Host 'Global azurite not found; using npx azurite (install globally for faster startup).' -ForegroundColor Yellow
      $azuriteCmd = 'npx'
      $argsList = 'azurite --silent'
    } else {
      $argsList = '--silent'
    }
    Write-Host 'Launching Azurite on default ports (Blob:10000 Queue:10001 Table:10002)...' -ForegroundColor Yellow
    if($azuriteCmd -eq 'npx'){
      Start-Process -FilePath $azuriteCmd -ArgumentList $argsList | Out-Null
    } else {
      Start-Process -FilePath $azuriteCmd -ArgumentList $argsList | Out-Null
    }
    Start-Sleep -Seconds 3
  } else {
    Write-Host 'Azurite already running.' -ForegroundColor Green
  }
  # Quick connectivity probe for Table endpoint
  try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $iar = $tcpClient.BeginConnect('127.0.0.1',10002,$null,$null)
    $connected = $iar.AsyncWaitHandle.WaitOne(500)
    if(-not $connected){ Write-Host 'Warning: Azurite Table endpoint (10002) not reachable; table features may be skipped.' -ForegroundColor Yellow }
    $tcpClient.Close()
  } catch { Write-Host 'Warning: Could not test Azurite Table endpoint.' -ForegroundColor Yellow }
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
