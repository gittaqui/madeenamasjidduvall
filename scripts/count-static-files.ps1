Param(
  [string]$Root = (Resolve-Path '..' -Relative),
  [string]$ApiDir = 'api'
)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Resolve-Path "$here/..") | Out-Null

$ignorePatterns = Get-Content '.swaignore' -ErrorAction SilentlyContinue | Where-Object { $_ -and -not $_.StartsWith('#') }

function Test-Ignored($path){
  foreach($pat in $ignorePatterns){
    if([string]::IsNullOrWhiteSpace($pat)){ continue }
    # naive glob handling: support trailing * and directory excludes
    if($pat.EndsWith('/')){
      if($path -like ("*" + $pat + "*")){ return $true }
    } elseif($pat.Contains('*')) {
      if($path -like $pat){ return $true }
    } else {
      if($path -like ("*" + $pat)){ return $true }
    }
  }
  return $false
}

$all = Get-ChildItem -File -Recurse | Where-Object { $_.FullName -notlike "*${ApiDir}*" }
$included = @()
foreach($f in $all){ if(-not (Test-Ignored ($f.FullName.Replace((Get-Location).Path,'').TrimStart('\')))){ $included += $f } }

Write-Host ("Static file count (approx, excluding API & ignored): {0}" -f $included.Count) -ForegroundColor Cyan
$included | Sort-Object Length -Descending | Select-Object -First 10 | ForEach-Object {
  Write-Host ("LARGEST: {0,8} bytes {1}" -f $_.Length, ($_.FullName.Replace((Get-Location).Path,'').TrimStart('\')))
}

Write-Host 'Done.'