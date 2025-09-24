param(
  [Parameter(Mandatory=$true)][string]$Email
)

# Invite a user with admin role to the Static Web App
$appName = "madeenmasjidduvall"
$rg = "rg-madeena-wus2"

Write-Host "Inviting $Email as admin..." -ForegroundColor Cyan
az staticwebapp users invite `
  --name $appName `
  --resource-group $rg `
  --authentication-provider GitHub `
  --roles admin `
  --user-details $Email `
  --invitation-expiration-in-hours 48

Write-Host "Invitation (if successful) will produce a JSON with a 'userId' or send email." -ForegroundColor Green
