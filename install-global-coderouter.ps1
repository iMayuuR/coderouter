param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$markerStart = "# >>> CodeRouter Auto Hook >>>"
$markerEnd = "# <<< CodeRouter Auto Hook <<<"
$profilePaths = @(
  $PROFILE.CurrentUserCurrentHost,
  $PROFILE.CurrentUserAllHosts,
  "$env:USERPROFILE\Documents\PowerShell\Microsoft.PowerShell_profile.ps1",
  "$env:USERPROFILE\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
) | Where-Object { $_ } | Select-Object -Unique

$block = @"
$markerStart
`$global:CodeRouterRoot = '$projectRoot'
`$global:CodeRouterHealthUrl = 'http://127.0.0.1:3000/health'
`$global:CodeRouterLogPath = Join-Path `$env:USERPROFILE '.coderouter\router.log'

function Invoke-CodeRouterEnsure {
  `$env:ANTHROPIC_BASE_URL = 'http://127.0.0.1:3000'
  `$env:ANTHROPIC_API_KEY = 'sk-ant-api03-coderouter-1234567890'
  # Remove OAuth token so Claude Code uses API key auth (which respects ANTHROPIC_BASE_URL)
  Remove-Item env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue

  try {
    `$null = Invoke-RestMethod -Uri `$global:CodeRouterHealthUrl -Method Get -TimeoutSec 2
    return
  } catch {}

  New-Item -ItemType Directory -Force -Path (Split-Path `$global:CodeRouterLogPath -Parent) | Out-Null
  `$args = '-NoProfile -Command "Set-Location ''{0}''; npm start *>> ''{1}''"' -f `$global:CodeRouterRoot, `$global:CodeRouterLogPath
  Start-Process -FilePath 'powershell.exe' -NoNewWindow -ArgumentList `$args | Out-Null

  for (`$i = 0; `$i -lt 20; `$i++) {
    Start-Sleep -Milliseconds 500
    try {
      `$null = Invoke-RestMethod -Uri `$global:CodeRouterHealthUrl -Method Get -TimeoutSec 2
      return
    } catch {}
  }

  throw "CodeRouter failed to start. Check logs: `$global:CodeRouterLogPath"
}

function Invoke-ClaudeOriginal {
  # Find the real claude binary (not our function)
  `$cmd = Get-Command claude.exe -ErrorAction SilentlyContinue
  if (-not `$cmd) { `$cmd = Get-Command claude.cmd -ErrorAction SilentlyContinue }
  if (-not `$cmd) { throw "Could not find claude CLI command in PATH." }
  & `$cmd.Source @args
}

function coderouter {
  if (`$args.Count -eq 0) {
    Invoke-CodeRouterEnsure
    Invoke-ClaudeOriginal
    return
  }

  `$action = [string]`$args[0]
  switch (`$action.ToLower()) {
    "status" {
      try {
        `$data = Invoke-RestMethod -Uri `$global:CodeRouterHealthUrl -Method Get -TimeoutSec 2
        Write-Host "CodeRouter: running (`$(`$data.service)) on port `$(`$data.port)" -ForegroundColor Green
      } catch {
        Write-Host "CodeRouter: not running" -ForegroundColor Yellow
      }
    }
    "logs" { Get-Content `$global:CodeRouterLogPath -Tail 100 }
    default {
      Invoke-CodeRouterEnsure
      Invoke-ClaudeOriginal @args
    }
  }
}

function claude {
  Invoke-CodeRouterEnsure
  Invoke-ClaudeOriginal @args
}
$markerEnd
"@

foreach ($profilePath in $profilePaths) {
  $profileDir = Split-Path -Parent $profilePath
  if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
  }
  if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
  }

  $existing = Get-Content $profilePath -Raw
  if ($null -eq $existing) { $existing = "" }
  if ($existing -match [regex]::Escape($markerStart) -and -not $Force) {
    Write-Host "CodeRouter hook already installed in $profilePath" -ForegroundColor Yellow
    continue
  }

  if ($existing -match [regex]::Escape($markerStart)) {
    $pattern = "(?s)$([regex]::Escape($markerStart)).*?$([regex]::Escape($markerEnd))"
    $updated = [regex]::Replace($existing, $pattern, $block)
  } else {
    $updated = $existing.TrimEnd() + "`r`n`r`n$block`r`n"
  }

  Set-Content -Path $profilePath -Value $updated
  Write-Host "Installed CodeRouter hook in $profilePath" -ForegroundColor Green
}

# --- Persist env vars at the User level ---
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://127.0.0.1:3000", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-api03-coderouter-1234567890", "User")
# Remove ANTHROPIC_AUTH_TOKEN so OAuth doesn't override API key auth
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $null, "User")

# Set for current session as well so user doesn't get prompted if they run claude immediately
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:3000"
$env:ANTHROPIC_API_KEY = "sk-ant-api03-coderouter-1234567890"
Remove-Item env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue
Write-Host "Saved user env vars: ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY" -ForegroundColor Green

# --- Logout Claude Code OAuth so it uses API key auth ---
Write-Host ""
Write-Host "Logging out Claude Code OAuth (required for proxy routing)..." -ForegroundColor Cyan
$claudeExe = $null
$candidates = @(
  "$env:USERPROFILE\.local\bin\claude.exe",
  "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
)
foreach ($c in $candidates) {
  if (Test-Path $c) { $claudeExe = $c; break }
}
if ($claudeExe) {
  try {
    & $claudeExe auth logout 2>$null
    Write-Host "Claude Code OAuth logout successful." -ForegroundColor Green
  } catch {
    Write-Host "OAuth logout skipped (not logged in or error)." -ForegroundColor Yellow
  }
} else {
  Write-Host "Could not find claude.exe for OAuth logout. Please run 'claude auth logout' manually." -ForegroundColor Yellow
}

# --- Install coderouter.cmd for cmd.exe ---
$npmPath = "$env:APPDATA\npm"
if (Test-Path $npmPath) {
    $cmdPath = Join-Path $npmPath "coderouter.cmd"
    $cmdContent = @"
@echo off
setlocal

set ANTHROPIC_BASE_URL=http://127.0.0.1:3000
set ANTHROPIC_API_KEY=sk-ant-api03-coderouter-1234567890

:: Ensure proxy is running
curl -s http://127.0.0.1:3000/health >nul 2>&1
if errorlevel 1 (
    if not exist "%USERPROFILE%\.coderouter" mkdir "%USERPROFILE%\.coderouter"
    start /b /d "$projectRoot" node proxy.js > "%USERPROFILE%\.coderouter\router.log" 2>&1
    timeout /t 2 /nobreak >nul
)

if /I "%~1"=="status" (
    curl -s http://127.0.0.1:3000/health
    echo.
    goto :eof
)
if /I "%~1"=="logs" (
    type "%USERPROFILE%\.coderouter\router.log"
    goto :eof
)

claude %*
"@
    Set-Content -Path $cmdPath -Value $cmdContent
    Write-Host "Installed coderouter.cmd for cmd.exe globally." -ForegroundColor Green
}

# --- Start proxy ---
Write-Host ""
Write-Host "Starting CodeRouter proxy..." -ForegroundColor Cyan
$logDir = "$env:USERPROFILE\.coderouter"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

# Stop any existing proxy process
Get-Process -Name "node" -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -match "proxy" -or $_.Path -match "node" } |
  ForEach-Object {
    # Only kill node processes running our proxy.js
    try { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue } catch {}
  }

Start-Process -FilePath "node" -ArgumentList "proxy.js" -WorkingDirectory $projectRoot `
  -RedirectStandardOutput "$logDir\router.log" -RedirectStandardError "$logDir\router_err.log" `
  -NoNewWindow

Start-Sleep -Seconds 2

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method Get -TimeoutSec 3
  Write-Host "CodeRouter proxy is RUNNING on port $($health.port)" -ForegroundColor Green
} catch {
  Write-Host "WARNING: Proxy may not have started. Check logs: $logDir\router.log" -ForegroundColor Red
}

# =====================================================
# --- Install Bundled Skills as Slash Commands ---
# =====================================================
Write-Host ""
Write-Host "Installing bundled skills..." -ForegroundColor Cyan

$skillsSource = Join-Path $projectRoot "bundled-skills\skills"
$commandsDir = Join-Path $env:USERPROFILE ".claude\commands"

if (Test-Path $skillsSource) {
  # Create commands directory
  if (-not (Test-Path $commandsDir)) {
    New-Item -ItemType Directory -Path $commandsDir -Force | Out-Null
  }

  $skillCount = 0
  Get-ChildItem $skillsSource -Directory | ForEach-Object {
    $skillName = $_.Name
    $skillFile = Join-Path $_.FullName "SKILL.md"
    if (Test-Path $skillFile) {
      $destFile = Join-Path $commandsDir "$skillName.md"
      Copy-Item $skillFile $destFile -Force
      $skillCount++
    }
  }
  Write-Host "Installed $skillCount skills as slash commands in $commandsDir" -ForegroundColor Green
  Write-Host "Use /skill-name in Claude Code to activate (e.g. /frontend-design, /code-reviewer)" -ForegroundColor Gray
} else {
  Write-Host "No bundled-skills directory found, skipping." -ForegroundColor Yellow
}

# =====================================================
# --- Register MCP Servers (Interactive) ---
# =====================================================
Write-Host ""
Write-Host "======= MCP Server Setup =======" -ForegroundColor Cyan
Write-Host ""

# --- Stitch MCP ---
Write-Host "[1/2] Stitch MCP (Google UI Design)" -ForegroundColor Yellow
Write-Host "  Stitch MCP provides UI design tools powered by Google." -ForegroundColor Gray
Write-Host "  It does NOT require an API key for basic usage." -ForegroundColor Gray
Write-Host ""
$stitchChoice = Read-Host "  Install Stitch MCP? (Y/n, press Enter for Yes)"
if ($stitchChoice -eq "" -or $stitchChoice -match "^[yY]") {
  Write-Host "  Installing Stitch MCP..." -ForegroundColor Cyan
  try { cmd /c "claude mcp remove stitch-mcp -s user" 2>&1 | Out-Null } catch {}
  try {
    $out = cmd /c "claude mcp add -s user stitch-mcp -- npx stitch-mcp@latest" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [OK] Stitch MCP installed!" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] Stitch MCP failed: $out" -ForegroundColor Red
    }
  } catch {
    Write-Host "  [FAIL] Stitch MCP failed: $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host "  -> Skipped Stitch MCP" -ForegroundColor DarkGray
}

Write-Host ""

# --- 21st.dev Magic MCP ---
Write-Host "[2/2] 21st.dev Magic MCP (UI Component Library)" -ForegroundColor Yellow
Write-Host "  Magic MCP provides beautiful pre-built React components." -ForegroundColor Gray
Write-Host "  Requires an API key from https://21st.dev" -ForegroundColor Gray
Write-Host ""

# Check if already in .env
$magicApiKey = ""
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
  foreach ($line in (Get-Content $envFile)) {
    if ($line -match "^MAGIC_API_KEY=(.+)$") {
      $magicApiKey = $Matches[1].Trim()
    }
  }
}

if ($magicApiKey -and $magicApiKey -ne "your-21st-dev-key-here") {
  Write-Host "  Found API key in .env: $($magicApiKey.Substring(0, [Math]::Min(8, $magicApiKey.Length)))..." -ForegroundColor Gray
  $useSaved = Read-Host "  Use this key? (Y/n, press Enter for Yes)"
  if ($useSaved -match "^[nN]") { $magicApiKey = "" }
}

if (-not $magicApiKey -or $magicApiKey -eq "your-21st-dev-key-here") {
  $magicApiKey = Read-Host "  Enter your 21st.dev Magic API key (or press Enter to skip)"
  $magicApiKey = $magicApiKey.Trim()
}

if ($magicApiKey -and $magicApiKey -ne "" -and $magicApiKey -ne "your-21st-dev-key-here") {
  Write-Host "  Installing 21st.dev Magic MCP..." -ForegroundColor Cyan
  try { cmd /c "claude mcp remove magic-21st -s user" 2>&1 | Out-Null } catch {}
  try {
    $out = cmd /c "claude mcp add -s user magic-21st -e `"TWENTY_FIRST_API_KEY=$magicApiKey`" -- npx @21st-dev/magic@latest" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [OK] 21st.dev Magic MCP installed!" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] 21st.dev Magic MCP failed: $out" -ForegroundColor Red
    }
  } catch {
    Write-Host "  [FAIL] 21st.dev Magic MCP failed: $($_.Exception.Message)" -ForegroundColor Red
  }

  # Save key to .env if not already there
  if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "MAGIC_API_KEY=your-21st-dev-key-here") {
      $envContent = $envContent -replace "MAGIC_API_KEY=your-21st-dev-key-here", "MAGIC_API_KEY=$magicApiKey"
      Set-Content -Path $envFile -Value $envContent -NoNewline
      Write-Host "  [OK] API key saved to .env" -ForegroundColor Green
    } elseif ($envContent -notmatch "MAGIC_API_KEY=") {
      Add-Content -Path $envFile -Value "`nMAGIC_API_KEY=$magicApiKey"
      Write-Host "  [OK] API key saved to .env" -ForegroundColor Green
    }
  }
} else {
  Write-Host "  -> Skipped 21st.dev Magic MCP (no API key)" -ForegroundColor DarkGray
}

# --- Show MCP status ---
Write-Host ""
Write-Host "Registered MCP servers:" -ForegroundColor Cyan
claude mcp list 2>&1

# =====================================================
# --- Final Summary ---
# =====================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "         CODEROUTER SETUP COMPLETE           " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proxy:  http://127.0.0.1:3000" -ForegroundColor White
Write-Host "Skills: $skillCount slash commands installed" -ForegroundColor White
Write-Host ""
Write-Host "Open a NEW terminal and run 'claude' or 'coderouter' from any directory." -ForegroundColor Cyan
Write-Host ""
Write-Host "Quick reference:" -ForegroundColor Yellow
Write-Host "  Default model:   Any Claude model -> nvidia/nemotron (auto)" -ForegroundColor Gray
Write-Host "  Custom shortcuts: /model -> Custom -> m1, m2, m4, m5" -ForegroundColor Gray
Write-Host "  Custom aliases:   /model -> Custom -> nemotron, gpt, gemma, minimax, glm" -ForegroundColor Gray
Write-Host "  Skills:           Type /frontend-design, /code-reviewer, etc." -ForegroundColor Gray
