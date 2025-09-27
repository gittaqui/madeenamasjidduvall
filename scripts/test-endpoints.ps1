Param(
  [string]$BaseUrl,                 # e.g. https://madeena-site.azurestaticapps.net OR www.madeenamasjid.com
  [string]$AdminKey,                # SUBSCRIBERS_ADMIN_KEY value (for diag) optional
  [string]$TestEmail = "test+demo@example.com",
  [string]$EventId = "friday-halaqa-2025-10-03",
  [switch]$NoWrites                  # If set, skip subscribe / rsvp POSTs
)

if(-not $BaseUrl){ Write-Error 'Provide -BaseUrl (e.g. https://<yoursite>.azurestaticapps.net)'; exit 1 }

# Normalize BaseUrl (add https:// if missing)
$BaseUrl = $BaseUrl.Trim()
if($BaseUrl -notmatch '^(?i)https?://') { $BaseUrl = 'https://' + $BaseUrl }
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "Normalized BaseUrl => $BaseUrl" -ForegroundColor Cyan

function New-ApiUri([string]$Path, [hashtable]$Query){
  $u = "$BaseUrl$Path"
  if($Query){
    Add-Type -AssemblyName System.Web | Out-Null
    $pairs = @()
    foreach($k in $Query.Keys){
      if($null -ne $Query[$k] -and $Query[$k] -ne ''){
        $pairs += ("{0}={1}" -f [System.Web.HttpUtility]::UrlEncode($k), [System.Web.HttpUtility]::UrlEncode([string]$Query[$k]))
      }
    }
    if($pairs.Count){ $u += '?' + ($pairs -join '&') }
  }
  return $u
}

Write-Host "== 1. Diagnostics (diag-tables-key) ==" -ForegroundColor Yellow
if($AdminKey){
  $diagKeyUri = New-ApiUri '/api/diag-tables-key' @{ adminKey = $AdminKey }
  Write-Host "GET $diagKeyUri"
  try {
    $diag = Invoke-RestMethod -Method GET -Uri $diagKeyUri -TimeoutSec 30
    $diag | ConvertTo-Json -Depth 6 | Write-Host
  } catch { Write-Warning "Diag key call failed: $($_.Exception.Message)" }
} else { Write-Warning 'Skipping diag-tables-key (no -AdminKey supplied)' }

Write-Host "== 2. Full Storage Diagnostic (diag-storage-full) ==" -ForegroundColor Yellow
if($AdminKey){
  $diagFullUri = New-ApiUri '/api/diag-storage-full' @{ adminKey = $AdminKey }
  Write-Host "GET $diagFullUri"
  try {
    $diagFull = Invoke-RestMethod -Method GET -Uri $diagFullUri -TimeoutSec 45
    ($diagFull | ConvertTo-Json -Depth 8) | Write-Host
  } catch { Write-Warning "Full storage diag failed: $($_.Exception.Message)" }
} else { Write-Warning 'Skipping diag-storage-full (no -AdminKey supplied)' }

if($NoWrites){
  Write-Host 'NoWrites flag set - skipping subscribe/RSVP test calls.' -ForegroundColor DarkYellow
  Write-Host '== Done ==' ; return
}

Write-Host "== 3. Subscribe test user ==" -ForegroundColor Yellow
$subBody = @{ email = $TestEmail } | ConvertTo-Json
$subUri = New-ApiUri '/api/subscribe' @{}
Write-Host "POST $subUri email=$TestEmail"
try {
  $subResp = Invoke-RestMethod -Method POST -Uri $subUri -ContentType 'application/json' -Body $subBody -TimeoutSec 30
  Write-Host ($subResp | ConvertTo-Json -Depth 5)
} catch { Write-Warning "Subscribe failed: $($_.Exception.Message)" }

Write-Host "== 4. RSVP test ==" -ForegroundColor Yellow
$rsvpBody = @{ eventId = $EventId; email = $TestEmail; name = 'Test User'; adults = 1; children = 0; notes='Automated test' } | ConvertTo-Json
$rsvpUri = New-ApiUri '/api/rsvp' @{}
Write-Host "POST $rsvpUri eventId=$EventId email=$TestEmail"
try {
  $rsvpResp = Invoke-RestMethod -Method POST -Uri $rsvpUri -ContentType 'application/json' -Body $rsvpBody -TimeoutSec 30
  Write-Host ($rsvpResp | ConvertTo-Json -Depth 5)
} catch { Write-Warning "RSVP failed: $($_.Exception.Message)" }

Write-Host "== Done =="
