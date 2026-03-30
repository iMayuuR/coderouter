#!/bin/bash
# ============================================================
#  Claude Code Launcher (Bash - Linux/macOS/WSL)
#  Reads config from .env file in the same directory
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Load .env file
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
else
    echo ""
    echo "  ERROR: .env file not found!"
    echo "  Copy .env.example to .env and add your API key:"
    echo "    cp .env.example .env"
    echo ""
    exit 1
fi

# Configure OpenRouter
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""
export ANTHROPIC_DEFAULT_OPUS_MODEL="$CLAUDE_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$CLAUDE_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$CLAUDE_MODEL"
export CLAUDE_CODE_SUBAGENT_MODEL="$CLAUDE_MODEL"

echo ""
echo "  Claude Code + OpenRouter"
echo "  Model: $CLAUDE_MODEL"
echo "  ========================"
echo ""

# Launch Claude Code
npx claude "$@"
