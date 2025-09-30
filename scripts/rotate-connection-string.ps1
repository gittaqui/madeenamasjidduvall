# Helper script: rotate-connection-string.ps1
# Fetches a fresh storage account connection string, base64-encodes it, and updates Static Web App app settings
# Usage (PowerShell):
#   ./scripts/rotate-connection-string.ps1 -StorageAccount madeenafnsa821e -ResourceGroup rg-madeena-wus2 -StaticWebApp madeenmasjidduvall
param(
  [Parameter(Mandatory=$true)] [string]$StorageAccount,
  [Parameter(Mandatory=$true)] [string]$ResourceGroup,
  [Parameter(Mandatory=$true)] [string]$StaticWebApp,
  [int]$DaysUntilNextReminder = 7
)

Write-Host "[rotate] Retrieving connection string for $StorageAccount ..."
$conn = az storage account show-connection-string -n $StorageAccount -g $ResourceGroup -o tsv
if(-not $conn){ Write-Error '[rotate] Failed to retrieve connection string'; exit 1 }

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($conn))
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
Write-Host "[rotate] Length (raw)=" $conn.Length " encoded=" $b64.Length

Write-Host "[rotate] Updating Static Web App app settings..."
az staticwebapp appsettings set -n $StaticWebApp -g $ResourceGroup --setting-names `
  STORAGE_CONNECTION_STRING_B64=$b64 `
  STORAGE_CONNECTION_STRING_SET_AT=$timestamp > $null

Write-Host "[rotate] Done. Stored timestamp: $timestamp"
Write-Host "[rotate] Reminder: rotate again by" ((Get-Date).AddDays($DaysUntilNextReminder).ToString('yyyy-MM-dd'))
