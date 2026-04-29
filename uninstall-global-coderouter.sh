#!/usr/bin/env bash
# ============================================
# CodeRouter — macOS / Linux Global Uninstaller
# ============================================
set -e

MARKER_START="# >>> CodeRouter Auto Hook >>>"
MARKER_END="# <<< CodeRouter Auto Hook <<<"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; GRAY='\033[0;90m'; NC='\033[0m'

log()  { echo -e "${CYAN}$1${NC}"; }
ok()   { echo -e "${GREEN}  [OK] $1${NC}"; }
warn() { echo -e "${YELLOW}  -> $1${NC}"; }

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}      Uninstalling CodeRouter Globally       ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# 1. Stop background proxy
echo -e "${GRAY}[1/5] Stopping background proxy...${NC}"
pkill -f "node.*proxy.js" 2>/dev/null || true
ok "Proxy stopped."

# 2. Remove Profile Hooks
echo -e "${GRAY}[2/5] Removing shell profile hooks...${NC}"
PROFILES=("$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile")
HOOKS_REMOVED=0

for p in "${PROFILES[@]}"; do
  if [ -f "$p" ]; then
    if grep -q "$MARKER_START" "$p" 2>/dev/null; then
      sed -i.bak "/$MARKER_START/,/$MARKER_END/d" "$p"
      rm -f "${p}.bak"
      ok "Cleaned $p"
      HOOKS_REMOVED=1
    fi
  fi
done
if [ "$HOOKS_REMOVED" -eq 0 ]; then warn "No hooks found."; fi

# 3. Clean up ENV
echo -e "${GRAY}[3/5] Removing environment variables...${NC}"
unset ANTHROPIC_BASE_URL 2>/dev/null || true
unset ANTHROPIC_API_KEY 2>/dev/null || true
ok "Removed variables from current session"
info "Note: You will need to restart your terminal to fully clear them."

# 4. Remove wrappers
echo -e "${GRAY}[4/5] Removing coderouter command wrappers...${NC}"
INSTALL_DIR="$HOME/.local/bin"
if [ -f "$INSTALL_DIR/coderouter" ]; then
  rm -f "$INSTALL_DIR/coderouter"
  ok "Removed $INSTALL_DIR/coderouter"
else
  warn "No bash wrapper found."
fi

# 5. Cleanup logs
echo -e "${GRAY}[5/5] Cleaning up log files...${NC}"
if [ -d "$HOME/.coderouter" ]; then
  rm -rf "$HOME/.coderouter"
  ok "Removed $HOME/.coderouter folder"
else
  warn "No .coderouter folder found."
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}         UNINSTALL COMPLETE                  ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "CodeRouter routing has been removed from your system."
echo -e "${GRAY}Any Claude Code skills and MCP servers were kept as they are native Claude features.${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: You need to log back into Anthropic to use Claude Code:${NC}"
echo -e "  ${CYAN}claude auth login${NC}"
echo ""
echo -e "Please ${YELLOW}restart your terminal${NC} for changes to take effect."
echo ""
