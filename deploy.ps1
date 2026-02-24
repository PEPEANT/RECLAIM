param(
  [ValidateSet("v6", "v7")]
  [string]$Target = "v7",
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

$projectMap = @{
  v6 = "dis-com-c1900"
  v7 = "reclaim-4c4af"
}

$projectId = $projectMap[$Target]
if (-not $projectId) {
  throw "Unknown target: $Target"
}

Write-Host "==> target: $Target ($projectId)"
Write-Host "==> git status"
git status -sb

$smokeScript = "v6/tools/smoke/smoke_runner.cjs"
if (-not $SkipSmoke -and (Test-Path $smokeScript)) {
  Write-Host "==> smoke test"
  node $smokeScript
  if ($LASTEXITCODE -ne 0) { throw "SMOKE failed" }
} else {
  Write-Host "==> smoke test skipped"
}

Write-Host "==> firebase deploy"
firebase deploy --only hosting --project $projectId
if ($LASTEXITCODE -ne 0) { throw "Firebase deploy failed" }

Write-Host "==> done"
