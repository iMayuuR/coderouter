# ============================================================
#  Claude Code Launcher (PowerShell)
#  Reads config from .env file in the same directory
# ============================================================

# Load .env file (if it exists) or rely on Global environment variables
$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            Set-Item -Path "env:$($Matches[1].Trim())" -Value $Matches[2].Trim()
        }
    }
}

# Verify we have the required API Key (either from .env or Global Env)
if (-not $env:OPENROUTER_API_KEY) {
    Write-Host ""
    Write-Host "  ERROR: OPENROUTER_API_KEY not found in .env or Global Environment!" -ForegroundColor Red
    Write-Host "  Run 'node install-global-skills.js' in the coderouter directory to set it up." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

if (-not $env:CLAUDE_MODEL) {
    $env:CLAUDE_MODEL = "openrouter/free"
}

# Configure OpenRouter and Proxy
$proxyPath = Join-Path $PSScriptRoot "proxy.js"

$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:3000"
$env:ANTHROPIC_AUTH_TOKEN = $env:OPENROUTER_API_KEY
$env:ANTHROPIC_API_KEY = ""
# Claude Code 2.x adds context-management-2025-06-27 when "experimental betas" are on.
# OpenRouter rejects that beta — disable at source (proxy strip alone is not enough for body/betas).
$env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = $env:CLAUDE_MODEL
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $env:CLAUDE_MODEL
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $env:CLAUDE_MODEL
$env:CLAUDE_CODE_SUBAGENT_MODEL = $env:CLAUDE_MODEL

# Ensure no zombie proxy is hogging port 3000
$existingProxy = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProxy) {
    foreach ($pid_ in $existingProxy) {
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
    }
}

# Start Smart Image Routing Proxy in background
$proxyProcess = Start-Process node -ArgumentList "`"$proxyPath`"" -WindowStyle Hidden -PassThru
Start-Sleep -s 1

Write-Host ""
Write-Host "  Claude Code + OpenRouter" -ForegroundColor Green
Write-Host "  Model: $env:CLAUDE_MODEL" -ForegroundColor Cyan
Write-Host "  ========================" -ForegroundColor DarkGray
Write-Host ""

# Launch Claude Code
try {
    npx claude $args
} finally {
    if ($proxyProcess -and !$proxyProcess.HasExited) {
        Stop-Process -Id $proxyProcess.Id -Force
    }
}
