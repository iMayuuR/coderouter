#!/usr/bin/env bash
# ============================================
# CodeRouter - macOS / Linux Global Installer
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKER_START="# >>> CodeRouter Auto Hook >>>"
MARKER_END="# <<< CodeRouter Auto Hook <<<"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; GRAY='\033[0;90m'; NC='\033[0m'

log()  { echo -e "${CYAN}$1${NC}"; }
ok()   { echo -e "${GREEN}  [OK] $1${NC}"; }
warn() { echo -e "${YELLOW}  -> $1${NC}"; }
err()  { echo -e "${RED}  [FAIL] $1${NC}"; }
info() { echo -e "${GRAY}  $1${NC}"; }

# =====================================================
# --- Install Shell Profile Hook ---
# =====================================================
HOOK_BLOCK="$MARKER_START
export ANTHROPIC_BASE_URL=\"http://127.0.0.1:3000\"
export ANTHROPIC_API_KEY="sk-ant-api03-coderouter-1234567890"
unset ANTHROPIC_AUTH_TOKEN 2>/dev/null

coderouter() {
  # Ensure proxy is running
  if ! curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
    mkdir -p \"\$HOME/.coderouter\"
    nohup node \"$SCRIPT_DIR/proxy.js\" >> \"\$HOME/.coderouter/router.log\" 2>&1 &
    echo \"[CodeRouter] Starting proxy...\"
    sleep 2
  fi

  if [ \"\$1\" = \"status\" ]; then
    curl -s http://127.0.0.1:3000/health
    echo
    return
  fi
  if [ \"\$1\" = \"logs\" ]; then
    cat \"\$HOME/.coderouter/router.log\"
    return
  fi

  command claude \"\$@\"
}

claude() {
  coderouter \"\$@\"
}
$MARKER_END"

install_hook() {
  local profile_file="$1"
  # Create file if it doesn't exist
  [ -f "$profile_file" ] || touch "$profile_file"

  # Remove old hook if present
  if grep -q "$MARKER_START" "$profile_file" 2>/dev/null; then
    sed -i.bak "/$MARKER_START/,/$MARKER_END/d" "$profile_file"
    rm -f "${profile_file}.bak"
  fi

  # Append new hook
  echo "" >> "$profile_file"
  echo "$HOOK_BLOCK" >> "$profile_file"
  ok "Installed hook in $profile_file"
}

log "Installing shell hooks..."

# Detect which shell profiles to install to
PROFILES=()
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
  PROFILES+=("$HOME/.zshrc")
fi
if [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ] || [ "$SHELL" = "/usr/bin/bash" ]; then
  PROFILES+=("$HOME/.bashrc")
  [ -f "$HOME/.bash_profile" ] && PROFILES+=("$HOME/.bash_profile")
fi
# Fallback: if nothing detected, install to both
if [ ${#PROFILES[@]} -eq 0 ]; then
  PROFILES=("$HOME/.zshrc" "$HOME/.bashrc")
fi

for p in "${PROFILES[@]}"; do
  install_hook "$p"
done

# =====================================================
# --- Set persistent env vars ---
# =====================================================
log ""
log "Setting environment variables..."
# These are already set in the hook above, but export for current session
export ANTHROPIC_BASE_URL="http://127.0.0.1:3000"
export ANTHROPIC_API_KEY="sk-ant-api03-coderouter-1234567890"
unset ANTHROPIC_AUTH_TOKEN 2>/dev/null
ok "ANTHROPIC_BASE_URL=http://127.0.0.1:3000"

# =====================================================
# --- Claude Code OAuth logout ---
# =====================================================
log ""
log "Logging out Claude Code OAuth (required for proxy routing)..."
CLAUDE_BIN=$(command -v claude 2>/dev/null || echo "")
if [ -n "$CLAUDE_BIN" ]; then
  $CLAUDE_BIN auth logout 2>/dev/null && ok "Claude OAuth logout successful." || warn "OAuth logout skipped (may not be logged in)."
else
  warn "claude command not found. Install with: npm install -g @anthropic-ai/claude-code"
fi

# =====================================================
# --- Install coderouter alias for PATH ---
# =====================================================
log ""
log "Installing 'coderouter' command..."
INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

cat > "$INSTALL_DIR/coderouter" << 'SCRIPT'
#!/usr/bin/env bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3000"
export ANTHROPIC_API_KEY="sk-ant-api03-coderouter-1234567890"
unset ANTHROPIC_AUTH_TOKEN 2>/dev/null

# Ensure proxy is running
if ! curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
  mkdir -p "$HOME/.coderouter"
SCRIPT
echo "  nohup node \"$SCRIPT_DIR/proxy.js\" >> \"\$HOME/.coderouter/router.log\" 2>&1 &" >> "$INSTALL_DIR/coderouter"
cat >> "$INSTALL_DIR/coderouter" << 'SCRIPT'
  sleep 2
fi

case "$1" in
  status) curl -s http://127.0.0.1:3000/health; echo ;;
  logs)   cat "$HOME/.coderouter/router.log" ;;
  *)      command claude "$@" ;;
esac
SCRIPT
chmod +x "$INSTALL_DIR/coderouter"
ok "Installed coderouter to $INSTALL_DIR/coderouter"

# Ensure ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  for p in "${PROFILES[@]}"; do
    if ! grep -q "$INSTALL_DIR" "$p" 2>/dev/null; then
      echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$p"
    fi
  done
  export PATH="$INSTALL_DIR:$PATH"
  ok "Added $INSTALL_DIR to PATH"
fi

# =====================================================
# --- Start proxy ---
# =====================================================
log ""
log "Starting CodeRouter proxy..."
mkdir -p "$HOME/.coderouter"

# Kill existing proxy
pkill -f "node.*proxy.js" 2>/dev/null || true
sleep 1

# Start proxy in background
cd "$SCRIPT_DIR"
nohup node proxy.js >> "$HOME/.coderouter/router.log" 2>&1 &
sleep 2

if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
  ok "CodeRouter proxy is RUNNING on port 3000"
else
  err "Proxy may not have started. Check: $HOME/.coderouter/router.log"
fi

# =====================================================
# --- Install Bundled Skills ---
# =====================================================
log ""
log "Installing bundled skills..."

SKILLS_SOURCE="$SCRIPT_DIR/bundled-skills/skills"
COMMANDS_DIR="$HOME/.claude/commands"
SKILL_COUNT=0

if [ -d "$SKILLS_SOURCE" ]; then
  mkdir -p "$COMMANDS_DIR"
  for skill_dir in "$SKILLS_SOURCE"/*/; do
    skill_name=$(basename "$skill_dir")
    skill_file="$skill_dir/SKILL.md"
    if [ -f "$skill_file" ]; then
      cp "$skill_file" "$COMMANDS_DIR/$skill_name.md"
      SKILL_COUNT=$((SKILL_COUNT + 1))
    fi
  done
  ok "Installed $SKILL_COUNT skills as slash commands"
  info "Use /skill-name in Claude Code (e.g. /frontend-design, /code-reviewer)"
else
  warn "No bundled-skills directory found, skipping."
fi

# =====================================================
# --- Register MCP Servers (Interactive) ---
# =====================================================
echo ""
log "======= MCP Server Setup ======="
echo ""

# --- Stitch MCP ---
echo -e "${YELLOW}[1/2] Stitch MCP (Google UI Design)${NC}"
info "Stitch MCP provides UI design tools powered by Google."
info "It does NOT require an API key for basic usage."
echo ""
read -p "  Install Stitch MCP? (Y/n): " STITCH_CHOICE
STITCH_CHOICE=${STITCH_CHOICE:-Y}
if [[ "$STITCH_CHOICE" =~ ^[yY] ]]; then
  log "  Installing Stitch MCP..."
  claude mcp remove stitch-mcp -s user 2>/dev/null || true
  if claude mcp add -s user stitch-mcp -- npx stitch-mcp@latest 2>/dev/null; then
    ok "Stitch MCP installed!"
  else
    err "Stitch MCP failed to install"
  fi
else
  warn "Skipped Stitch MCP"
fi

echo ""

# --- 21st.dev Magic MCP ---
echo -e "${YELLOW}[2/2] 21st.dev Magic MCP (UI Component Library)${NC}"
info "Magic MCP provides beautiful pre-built React components."
info "Requires an API key from https://21st.dev"
echo ""

# Check .env for existing key
MAGIC_KEY=""
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  MAGIC_KEY=$(grep "^MAGIC_API_KEY=" "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
fi

if [ -n "$MAGIC_KEY" ] && [ "$MAGIC_KEY" != "your-21st-dev-key-here" ]; then
  echo -e "${GRAY}  Found API key in .env: ${MAGIC_KEY:0:8}...${NC}"
  read -p "  Use this key? (Y/n): " USE_SAVED
  USE_SAVED=${USE_SAVED:-Y}
  if [[ "$USE_SAVED" =~ ^[nN] ]]; then MAGIC_KEY=""; fi
fi

if [ -z "$MAGIC_KEY" ] || [ "$MAGIC_KEY" = "your-21st-dev-key-here" ]; then
  read -p "  Enter your 21st.dev Magic API key (or press Enter to skip): " MAGIC_KEY
  MAGIC_KEY=$(echo "$MAGIC_KEY" | xargs) # trim
fi

if [ -n "$MAGIC_KEY" ] && [ "$MAGIC_KEY" != "your-21st-dev-key-here" ]; then
  log "  Installing 21st.dev Magic MCP..."
  claude mcp remove magic-21st -s user 2>/dev/null || true
  if claude mcp add -s user magic-21st -e "TWENTY_FIRST_API_KEY=$MAGIC_KEY" -- npx @21st-dev/magic@latest 2>/dev/null; then
    ok "21st.dev Magic MCP installed!"
  else
    err "21st.dev Magic MCP failed"
  fi

  # Save key to .env
  if [ -f "$ENV_FILE" ]; then
    if grep -q "MAGIC_API_KEY=your-21st-dev-key-here" "$ENV_FILE"; then
      sed -i.bak "s/MAGIC_API_KEY=your-21st-dev-key-here/MAGIC_API_KEY=$MAGIC_KEY/" "$ENV_FILE"
      rm -f "${ENV_FILE}.bak"
      ok "API key saved to .env"
    elif ! grep -q "MAGIC_API_KEY=" "$ENV_FILE"; then
      echo "MAGIC_API_KEY=$MAGIC_KEY" >> "$ENV_FILE"
      ok "API key saved to .env"
    fi
  fi
else
  warn "Skipped 21st.dev Magic MCP (no API key)"
fi

# --- Show MCP status ---
echo ""
log "Registered MCP servers:"
claude mcp list 2>&1 || true

# =====================================================
# --- Final Summary ---
# =====================================================
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}         CODEROUTER SETUP COMPLETE           ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Proxy:  http://127.0.0.1:3000"
echo -e "Skills: $SKILL_COUNT slash commands installed"
echo ""
echo -e "${CYAN}Open a NEW terminal and run 'claude' or 'coderouter' from any directory.${NC}"
echo ""
echo -e "${YELLOW}Quick reference:${NC}"
info "Default model:   Any Claude model -> nvidia/nemotron (auto)"
info "Custom shortcuts: /model -> Custom -> m1, m2, m4, m5"
info "Custom aliases:   /model -> Custom -> nemotron, gpt, gemma, minimax, glm"
info "Skills:           Type /frontend-design, /code-reviewer, etc."
echo ""
