$ErrorActionPreference='Stop'
$u='https://green-sky-058aa821e.2.azurestaticapps.net/api/prayer-times'
Write-Host "Testing GET $u"
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Uri $u
  Write-Host "Status: $($resp.StatusCode)"
  $len = $resp.Content.Length
  Write-Host "Content length: $len"
  $preview = $resp.Content.Substring(0, [Math]::Min(400, $len))
  Write-Host "Preview:\n$preview"
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
  if($_.Exception.Response -and $_.Exception.Response.StatusCode){
    Write-Host "HTTP Status: $([int]$_.Exception.Response.StatusCode)"
  }
}
