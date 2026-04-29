param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$markerStart = "# >>> CodeRouter Auto Hook >>>"
$markerEnd = "# <<< CodeRouter Auto Hook <<<"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "      Uninstalling CodeRouter Globally       " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stop background proxy
Write-Host "[1/5] Stopping background proxy..." -ForegroundColor Gray
Get-Process -Name "node" -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -match "proxy" -or $_.Path -match "node" } |
  ForEach-Object {
    try { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue } catch {}
  }
Write-Host "  [OK] Proxy stopped." -ForegroundColor Green

# 2. Remove Profile Hooks
Write-Host "[2/5] Removing shell profile hooks..." -ForegroundColor Gray
$profilePaths = @(
  $PROFILE.CurrentUserCurrentHost,
  $PROFILE.CurrentUserAllHosts,
  "$env:USERPROFILE\Documents\PowerShell\Microsoft.PowerShell_profile.ps1",
  "$env:USERPROFILE\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
) | Where-Object { $_ } | Select-Object -Unique

$hookRemoved = 0
foreach ($profilePath in $profilePaths) {
  if (Test-Path $profilePath) {
    $existing = Get-Content $profilePath -Raw
    if ($existing -match [regex]::Escape($markerStart)) {
      $pattern = "(?s)\r?\n?$([regex]::Escape($markerStart)).*?$([regex]::Escape($markerEnd))\r?\n?"
      $updated = [regex]::Replace($existing, $pattern, "")
      Set-Content -Path $profilePath -Value $updated
      Write-Host "  [OK] Cleaned $profilePath" -ForegroundColor Green
      $hookRemoved++
    }
  }
}
if ($hookRemoved -eq 0) { Write-Host "  -> No hooks found." -ForegroundColor DarkGray }

# 3. Remove Global Env Vars
Write-Host "[3/5] Removing global environment variables..." -ForegroundColor Gray
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", $null, "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null, "User")
Write-Host "  [OK] Removed ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY" -ForegroundColor Green

# Also remove from current session
Remove-Item env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
Remove-Item env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

# 4. Remove wrappers
Write-Host "[4/5] Removing coderouter command wrappers..." -ForegroundColor Gray
$cmdPath = Join-Path "$env:APPDATA\npm" "coderouter.cmd"
if (Test-Path $cmdPath) {
  Remove-Item $cmdPath -Force
  Write-Host "  [OK] Removed coderouter.cmd" -ForegroundColor Green
} else {
  Write-Host "  -> No cmd wrapper found." -ForegroundColor DarkGray
}

# 5. Cleanup logs
Write-Host "[5/5] Cleaning up log files..." -ForegroundColor Gray
$logDir = "$env:USERPROFILE\.coderouter"
if (Test-Path $logDir) {
  Remove-Item -Path $logDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "  [OK] Removed .coderouter folder" -ForegroundColor Green
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "         UNINSTALL COMPLETE                  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "CodeRouter routing has been removed from your system." -ForegroundColor White
Write-Host "Any Claude Code skills and MCP servers were kept as they are native Claude features." -ForegroundColor Gray
Write-Host ""
Write-Host "IMPORTANT: You need to log back into Anthropic to use Claude Code:" -ForegroundColor Yellow
Write-Host "  claude auth login" -ForegroundColor Cyan
Write-Host ""
