# ============================================================
#  Claude Code Launcher (PowerShell)
#  Reads config from .env file in the same directory
# ============================================================

# Load .env file
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            Set-Item -Path "env:$($Matches[1].Trim())" -Value $Matches[2].Trim()
        }
    }
} else {
    Write-Host ""
    Write-Host "  ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "  Copy .env.example to .env and add your API key:" -ForegroundColor Yellow
    Write-Host "    copy .env.example .env" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Configure OpenRouter
$env:ANTHROPIC_BASE_URL = "https://openrouter.ai/api"
$env:ANTHROPIC_AUTH_TOKEN = $env:OPENROUTER_API_KEY
$env:ANTHROPIC_API_KEY = ""
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = $env:CLAUDE_MODEL
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $env:CLAUDE_MODEL
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $env:CLAUDE_MODEL
$env:CLAUDE_CODE_SUBAGENT_MODEL = $env:CLAUDE_MODEL

Write-Host ""
Write-Host "  Claude Code + OpenRouter" -ForegroundColor Green
Write-Host "  Model: $env:CLAUDE_MODEL" -ForegroundColor Cyan
Write-Host "  ========================" -ForegroundColor DarkGray
Write-Host ""

# Launch Claude Code
npx claude $args
