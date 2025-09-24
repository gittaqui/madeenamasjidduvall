param(
  [string]$ResourceGroup = 'rg-madeena-wus2',
  [string]$AppName,
  [switch]$Seed,
  [string]$OutFile
)
$ErrorActionPreference = 'Stop'
if(-not $AppName){
  $AppName = az resource list -g $ResourceGroup --resource-type Microsoft.Web/staticSites --query "[0].name" -o tsv
  if(-not $AppName){ throw "No Static Web App found in resource group $ResourceGroup" }
}
$hostName = az staticwebapp show --name $AppName --resource-group $ResourceGroup --query properties.defaultHostname -o tsv
if(-not $hostName){ throw "Could not resolve hostname for $AppName" }
$baseUrl = "https://$hostName"
Write-Host "SWA:  $AppName" -ForegroundColor Cyan
Write-Host "URL:  $baseUrl" -ForegroundColor Cyan

function Probe($url){
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 20 -Method GET
    return @{ status=$r.StatusCode; length=$r.RawContentLength; body=$r.Content }
  } catch {
    return @{ status=-1; length=0; body=$_.Exception.Message }
  }
}
Write-Host 'Testing root...' -ForegroundColor Yellow
$root = Probe "$baseUrl/"
Write-Host ("  / -> {0} ({1} bytes)" -f $root.status,$root.length)

Write-Host 'Testing /api/prayer-times (GET)...' -ForegroundColor Yellow
$api = Probe "$baseUrl/api/prayer-times"
Write-Host ("  /api/prayer-times -> {0} ({1} bytes)" -f $api.status,$api.length)
if($api.status -eq 404){ Write-Host '  (Blob not found yet — you can seed with -Seed)' -ForegroundColor DarkYellow }
elseif($api.status -eq 200){ Write-Host '  OK' -ForegroundColor Green }
else { Write-Host '  Unexpected status; check Functions logs.' -ForegroundColor Red }

if($Seed){
  if($api.status -eq 200){ Write-Host 'Skipping seed: data already present.' -ForegroundColor DarkYellow }
  else {
    Write-Host 'Seeding initial schedule via local file + POST requires browser auth; fallback: create local seed file.' -ForegroundColor Yellow
    $seedObj = @{
      note='Initial schedule';
      adhan=@{ fajr='05:30 AM'; dhuhr='01:15 PM'; asr='05:00 PM'; maghrib='Sunset'; isha='09:15 PM' };
      iqamah=@{ fajr='06:00 AM'; dhuhr='01:30 PM'; asr='05:15 PM'; maghrib='Sunset +5'; isha='09:30 PM' };
      jumuah=@(@{ title='Khutbah'; start='13:15'; end='13:45'; salah='13:45' })
    } | ConvertTo-Json -Depth 5
    $seedPath = Join-Path $PSScriptRoot 'seed-prayer-times.json'
    $seedObj | Set-Content -Encoding UTF8 $seedPath
    Write-Host "Seed file generated: $seedPath" -ForegroundColor Green
    Write-Host 'Upload it by: open admin-schedule.html in browser (after login) -> Import -> Save to Server.' -ForegroundColor Cyan
  }
}

if($OutFile){
  @{ root=$root; api=$api; url=$baseUrl } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $OutFile
  Write-Host "Wrote results to $OutFile" -ForegroundColor Green
}
