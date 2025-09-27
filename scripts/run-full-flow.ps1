<#
  Orchestrates full diagnostic + subscribe + RSVP flow using Invoke-RestMethod (or curl.exe fallback) against production or staging.
  Usage examples:
    pwsh ./scripts/run-full-flow.ps1 -BaseUrl https://www.madeenamasjid.com -TestEmail test+flow1@example.com -EventId friday-halaqa-2025-10-03
    pwsh ./scripts/run-full-flow.ps1 -BaseUrl www.madeenamasjid.com -AdminKey <key>
  If no -AdminKey is supplied you must already be logged in as admin in a browser; this script cannot harvest your auth cookie. Use -AdminKey for headless diagnostics.
#>
Param(
  [Parameter(Mandatory)][string]$BaseUrl,
  [string]$AdminKey,
  [string]$TestEmail = 'test+flow@example.com',
  [string]$EventId = 'friday-halaqa-2025-10-03',
  [switch]$DryRun,
  [int]$TimeoutSeconds = 30
)

function Normalize-Base($u){
  $u = $u.Trim(); if($u -notmatch '^(?i)https?://'){ $u = 'https://' + $u }; return $u.TrimEnd('/')
}
Add-Type -AssemblyName System.Web | Out-Null
function New-Url($path, [hashtable]$q){
  $b = Normalize-Base $BaseUrl
  $u = "$b$path"; if($q){ $pairs=@(); foreach($k in $q.Keys){ if($q[$k]){ $pairs += ([System.Web.HttpUtility]::UrlEncode($k)+'='+[System.Web.HttpUtility]::UrlEncode([string]$q[$k])) } }; if($pairs.Count){ $u += '?' + ($pairs -join '&') } }; return $u
}

Write-Host "=== FULL FLOW START ===" -ForegroundColor Cyan
$BaseUrl = Normalize-Base $BaseUrl
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor Cyan

function Get-OrInvoke($method, $uri, $body){
  Write-Host ("{0} {1}" -f $method.ToUpper(), $uri) -ForegroundColor Yellow
  if($DryRun){ Write-Host '[dry-run] skipping call'; return $null }
  try {
    if($body){ return Invoke-RestMethod -Method $method -Uri $uri -ContentType 'application/json' -Body ($body | ConvertTo-Json) -TimeoutSec $TimeoutSeconds }
    else { return Invoke-RestMethod -Method $method -Uri $uri -TimeoutSec $TimeoutSeconds }
  } catch { Write-Warning "Request failed: $($_.Exception.Message)"; return $null }
}

# 1. Auth info (if session cookie present in current shell context, seldom true, but attempt)
$authInfo = Get-OrInvoke GET (New-Url '/.auth/me' @{}) $null
if($authInfo){ Write-Host ('Auth Info: ' + ($authInfo | ConvertTo-Json -Depth 6)) }

# 2. Diagnostics (fast + full)
if($AdminKey){
  $diagFast = Get-OrInvoke GET (New-Url '/api/diag-tables-key' @{ adminKey = $AdminKey }) $null
  if($diagFast){ Write-Host ('Diag Fast: ' + ($diagFast | ConvertTo-Json -Depth 6)) }
  $diagFull = Get-OrInvoke GET (New-Url '/api/diag-storage-full' @{ adminKey = $AdminKey }) $null
  if($diagFull){ Write-Host ('Diag Full: ' + ($diagFull | ConvertTo-Json -Depth 6)) }
} else {
  Write-Host 'No admin key provided; attempting role-based diag endpoints (must be logged in in same auth context which typical console lacks).' -ForegroundColor DarkYellow
  $diagRole = Get-OrInvoke GET (New-Url '/api/diag-tables' @{}) $null
  if($diagRole){ Write-Host ('Diag Role: ' + ($diagRole | ConvertTo-Json -Depth 6)) }
}

# 3. Subscribe
$subResp = Get-OrInvoke POST (New-Url '/api/subscribe' @{}) @{ email = $TestEmail }
if($subResp){ Write-Host ('Subscribe Response: ' + ($subResp | ConvertTo-Json -Depth 6)) }

# 4. RSVP
$rsvpResp = Get-OrInvoke POST (New-Url '/api/rsvp' @{}) @{ eventId = $EventId; email = $TestEmail; name='Flow Tester'; adults=1; children=0; notes='Automated full-flow test' }
if($rsvpResp){ Write-Host ('RSVP Response: ' + ($rsvpResp | ConvertTo-Json -Depth 6)) }

# 5. Post-operation full diag (if key available)
if($AdminKey){
  Start-Sleep -Seconds 2
  $diagAfter = Get-OrInvoke GET (New-Url '/api/diag-storage-full' @{ adminKey = $AdminKey }) $null
  if($diagAfter){ Write-Host ('Diag After: ' + ($diagAfter | ConvertTo-Json -Depth 8)) }
}

Write-Host '=== FULL FLOW END ===' -ForegroundColor Cyan
