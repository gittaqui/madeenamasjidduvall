Param(
  [string]$FuncBase = 'https://madeena-rsvp-api.azurewebsites.net/api',
  [string]$Email = 'ext-func-test+' + (Get-Date -Format 'yyyyMMddHHmmss') + '@example.com',
  [switch]$SkipConfirm
)

if($FuncBase -notmatch '^(?i)https?://'){ $FuncBase = 'https://' + $FuncBase }
$FuncBase = $FuncBase.TrimEnd('/')
Write-Host "Testing external subscriber endpoints at $FuncBase" -ForegroundColor Cyan

function Invoke-JsonPost([string]$Url, $Body){
  try {
    $json = $Body | ConvertTo-Json -Compress
    return Invoke-RestMethod -Method POST -Uri $Url -ContentType 'application/json' -Body $json -TimeoutSec 30
  } catch { throw $_ }
}

# 1. Subscribe
Write-Host "[1] Subscribing $Email" -ForegroundColor Yellow
$subResp = $null
try {
  $subResp = Invoke-JsonPost "$FuncBase/subscribe" @{ email = $Email }
  $subResp | ConvertTo-Json -Depth 5 | Write-Host
} catch { Write-Error "Subscribe failed: $($_.Exception.Message)"; exit 1 }

if($SkipConfirm){ Write-Host 'SkipConfirm set - not attempting token lookup/confirm.' -ForegroundColor DarkYellow; exit 0 }

# 2. Attempt to locate pending token (requires storage access via connection string env locally, so we just instruct if not available)
Write-Host "[2] To confirm, retrieve token row in 'token' partition with the most recent createdUtc for this email's hash." -ForegroundColor Yellow
Write-Host '   (Direct token retrieval not implemented in this helper script to avoid embedding storage creds.)'
Write-Host '   Use existing diagnostics or Azure Storage Explorer, then:'
Write-Host "   Invoke-RestMethod -Uri $FuncBase/confirm?token=<TOKEN>" -ForegroundColor DarkCyan

Write-Host "Done."
