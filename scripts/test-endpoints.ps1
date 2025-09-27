Param(
  [string]$BaseUrl,               # e.g. https://madeena-site.azurestaticapps.net
  [string]$AdminKey,              # SUBSCRIBERS_ADMIN_KEY value (for diag)
  [string]$TestEmail = "test+demo@example.com",
  [string]$EventId = "friday-halaqa-2025-10-03"
)

if(-not $BaseUrl){ Write-Error 'Provide -BaseUrl (e.g. https://<yoursite>.azurestaticapps.net)'; exit 1 }

Write-Host "== 1. Diagnostics (diag-tables-key) =="
if($AdminKey){
  try {
    $diag = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/diag-tables-key?adminKey=$AdminKey"
    $diag | ConvertTo-Json -Depth 6 | Write-Host
  } catch { Write-Warning "Diag call failed: $($_.Exception.Message)" }
} else {
  Write-Warning 'Skipping diag (no -AdminKey supplied)'
}

Write-Host "== 2. Subscribe test user =="
$subBody = @{ email = $TestEmail } | ConvertTo-Json
try {
  $subResp = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/subscribe" -ContentType 'application/json' -Body $subBody
  Write-Host ($subResp | ConvertTo-Json -Depth 5)
} catch { Write-Warning "Subscribe failed: $($_.Exception.Message)" }

Write-Host "== 3. RSVP test =="
$rsvpBody = @{ eventId = $EventId; email = $TestEmail; name = 'Test User'; adults = 1; children = 0; notes='Automated test' } | ConvertTo-Json
try {
  $rsvpResp = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/rsvp" -ContentType 'application/json' -Body $rsvpBody
  Write-Host ($rsvpResp | ConvertTo-Json -Depth 5)
} catch { Write-Warning "RSVP failed: $($_.Exception.Message)" }

Write-Host "== Done =="
