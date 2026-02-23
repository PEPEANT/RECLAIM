$ErrorActionPreference = "Stop"

Write-Host "==> git status"
git status -sb

Write-Host "==> smoke test"
node RECLAIM_WAR/tools/smoke/smoke_runner.cjs
if ($LASTEXITCODE -ne 0) { throw "SMOKE failed" }

Write-Host "==> firebase deploy"
firebase deploy --only hosting

Write-Host "==> done"
