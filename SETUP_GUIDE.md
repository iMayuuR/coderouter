# CodeRouter Setup Guide

Multi-provider AI model router for Claude Code CLI. Route requests to Nvidia, OpenAI, Google, and more — all through a single local proxy.

## 1) Prerequisites

| Requirement | Details |
|-------------|---------|
| **OS** | Windows 10/11, macOS, or Linux |
| **Node.js** | v18+ |
| **Terminal** | PowerShell (Windows) / Terminal (macOS/Linux) |
| **API Key** | At least one provider key (Nvidia, OpenRouter, OpenAI, etc.) |

## 2) Install dependencies

```bash
cd coderouter
npm install
```

## 3) Configure environment

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` and set your provider key(s):

```env
# Default model (all Claude requests route here)
DEFAULT_MODEL=nvidia/nemotron-3-super-120b-a12b

# Provider API key
NIM_API_KEY=your-nvidia-nim-api-key
```

### Optional: Model presets & aliases

Quick-switch between models using shortcuts (`m1`..`m5`) or custom aliases:

```env
# Shortcuts (use as model name: m1, m2, etc.)
MODEL_1=openai/gpt-oss-120b
MODEL_2=google/gemma-4-31b-itile
MODEL_3=groq/llama-3.3-70b-versatile
MODEL_4=minimaxai/minimax-m2.7
MODEL_5=z-ai/glm-5.1

# Aliases (use as model name: nemotron, gemma, etc.)
ALIAS_nemotron=nvidia/nemotron-3-super-120b-a12b
ALIAS_gpt=openai/gpt-oss-120b
ALIAS_gemma=google/gemma-4-31b-itile
```

## 4) One-time global setup (recommended)

Run the installer for your OS:

### Windows (PowerShell)

```powershell
.\install-global-coderouter.ps1
```

### macOS / Linux (bash/zsh)

```bash
chmod +x install-global-coderouter.sh
./install-global-coderouter.sh
```

Then **open a new terminal** for changes to take effect.

### What the installer does:

- ✅ Adds `coderouter` command globally (works from any folder)
- ✅ Auto-starts the proxy in background when you run `claude`
- ✅ Logs out Claude Code OAuth (required for proxy routing)
- ✅ Installs 200+ bundled skills as `/slash-commands`
- ✅ Optionally installs Stitch MCP & 21st.dev Magic MCP (interactive prompts)
- ✅ Saves env vars persistently

### Log files:

| OS | Path |
|----|------|
| Windows | `%USERPROFILE%\.coderouter\router.log` |
| macOS/Linux | `~/.coderouter/router.log` |

## 5) Using Claude Code

After setup, run from any directory:

```bash
# Start Claude Code (auto-routes through CodeRouter)
claude

# Or use the coderouter wrapper
coderouter

# Check proxy status
coderouter status

# View proxy logs
coderouter logs
```

## 6) Switching models

Inside Claude Code, press `/model` → **Custom model** and type:

| Input | Routes to |
|-------|-----------|
| *(any claude model)* | `DEFAULT_MODEL` from `.env` (auto) |
| `m1` | `MODEL_1` from `.env` |
| `m2` | `MODEL_2` from `.env` |
| `nemotron` | `ALIAS_nemotron` from `.env` |
| `gemma` | `ALIAS_gemma` from `.env` |

## 7) Health check

```bash
curl http://127.0.0.1:3000/health
# → {"ok":true,"service":"coderouter","port":3000}

curl http://127.0.0.1:3000/v1/models
# → Lists all available models, shortcuts, and aliases
```

## 8) Skills (slash commands)

219 bundled skills are installed as `/slash-commands`. Examples:

| Command | Description |
|---------|-------------|
| `/frontend-design` | Production-grade UI design guidance |
| `/code-reviewer` | Automated code review |
| `/deep-research` | In-depth research workflow |
| `/security-review` | Security audit |
| `/tdd-workflow` | Test-driven development |
| `/systematic-debugging` | Structured debugging |

## 9) MCP Servers

The installer can optionally configure:

- **Stitch MCP** — Google UI design tools (no API key needed)
- **21st.dev Magic MCP** — Pre-built React components (needs API key from https://21st.dev)

Set your key in `.env`:
```env
MAGIC_API_KEY=your-21st-dev-key-here
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "model does not exist" | Run `claude auth logout` then restart |
| Proxy not starting | Check `coderouter status` and logs |
| Models not routing | Verify `ANTHROPIC_BASE_URL=http://127.0.0.1:3000` is set |
| Skills not showing | Check `~/.claude/commands/` has `.md` files |

## Uninstalling

If you want to fully remove CodeRouter and go back to using native Claude Code, run the uninstaller for your OS.

### Windows (PowerShell)
```powershell
.\uninstall-global-coderouter.ps1
```

### macOS / Linux (bash/zsh)
```bash
chmod +x uninstall-global-coderouter.sh
./uninstall-global-coderouter.sh
```

**Note:** The uninstaller stops the background proxy, removes profile hooks, cleans up environment variables, and deletes proxy logs. It **keeps** your skills and MCP servers intact. To use native Claude Code again, you will need to re-login:
```bash
claude auth login
```
