# ============================================================
#  Claude Code + OpenRouter AI Agent Setup Script
#  This script automates the installation and configuration
#  based on ai-agent-config.json.
# ============================================================

$configPath = Join-Path $PSScriptRoot "ai-agent-config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: ai-agent-config.json not found!" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json

Write-Host "🚀 Starting AI Agent Setup for $($config.project.name)..." -ForegroundColor Green

# 1. Install Dependencies
Write-Host "📦 Installing local dependencies..." -ForegroundColor Cyan
npm install

# 2. Check for Global Claude Code
Write-Host "🔍 Checking for @anthropic-ai/claude-code..." -ForegroundColor Cyan
if (-not (Get-Command "claude" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Claude Code globally..." -ForegroundColor Yellow
    npm install -g @anthropic-ai/claude-code
}

# 3. Configure .env
Write-Host "⚙️  Configuring environment..." -ForegroundColor Cyan
$envPath = Join-Path $PSScriptRoot ".env"
$envTemplatePath = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envTemplatePath) {
        Copy-Item $envTemplatePath $envPath
        Write-Host "Created .env from .env.example." -ForegroundColor Green
    } else {
        New-Item $envPath -ItemType File -Value ""
        Write-Host "Created new .env file." -ForegroundColor Green
    }
}

# Update .env with values from config
$envContent = Get-Content $envPath
$updatedContent = @()

$apiKey = $config.user_preferences.api_key
$model = $config.user_preferences.model

foreach ($line in $envContent) {
    if ($line -match '^OPENROUTER_API_KEY=') {
        $updatedContent += "OPENROUTER_API_KEY=$apiKey"
    } elseif ($line -match '^CLAUDE_MODEL=') {
        $updatedContent += "CLAUDE_MODEL=$model"
    } else {
        $updatedContent += $line
    }
}

# Handle cases where keys are missing in .env
if (-not ($updatedContent -match '^OPENROUTER_API_KEY=')) {
    $updatedContent += "OPENROUTER_API_KEY=$apiKey"
}
if (-not ($updatedContent -match '^CLAUDE_MODEL=')) {
    $updatedContent += "CLAUDE_MODEL=$model"
}

$updatedContent | Set-Content $envPath
Write-Host "✅ .env updated with your preferences." -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "You can now run Claude Code using: .\run-claude.ps1" -ForegroundColor Cyan
Write-Host ""
