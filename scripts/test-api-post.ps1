param(
  [string]$Host = "green-sky-058aa821e.2.azurestaticapps.net",
  [string]$JsonPath = "prayer-times.json"
)

Write-Host "Testing GET $Host/api/prayer-times" -ForegroundColor Cyan
try {
  $get = Invoke-RestMethod -Uri "https://$Host/api/prayer-times" -Method GET -TimeoutSec 30
  Write-Host "GET succeeded. Keys:" ($get | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name -ErrorAction SilentlyContinue) -ForegroundColor Green
} catch {
  Write-Host "GET failed: $($_.Exception.Message)" -ForegroundColor Red
}

if (-not (Test-Path $JsonPath)) {
  Write-Host "Local file $JsonPath not found; aborting POST test." -ForegroundColor Yellow
  exit 0
}

Write-Host "POST requires auth (admin role). If you are logged into browser and have a token, you must supply headers manually. This script demonstrates an anonymous failure." -ForegroundColor Yellow
try {
  $body = Get-Content $JsonPath -Raw
  $resp = Invoke-WebRequest -Uri "https://$Host/api/prayer-times" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 30 -ErrorAction Stop
  Write-Host "POST status: $($resp.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "Expected POST failure without auth: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "Add an auth header after retrieving a valid cookie/session from browser if you need to test POST via script." -ForegroundColor Cyan
