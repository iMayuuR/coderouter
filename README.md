# Universal CodeRouter 🚀

CodeRouter is a high-performance, lightweight local proxy designed for **Claude Code CLI**. It enables seamless multi-provider AI routing (NVIDIA NIM, OpenRouter, OpenAI, etc.) with robust error translation and multi-session support.

## Key Features

- **🚀 Multi-Provider Routing:** Route requests to NVIDIA NIM, OpenRouter, Groq, Mistral, and more.
- **🛡️ Error Translation:** Automatically converts provider errors (502, 404, etc.) into Anthropic-compliant JSON to prevent CLI hangs.
- **🔄 Persistent Sessions:** Standardized API key injection allows multiple terminal sessions to share the same authenticated context.
- **⚡ Quick Presets:** Switch models instantly using `m1`, `m2`, etc., or custom aliases like `gpt`, `nemotron`.
- **📦 Global Installer:** One-click install for Windows (PowerShell) and Linux/macOS (Bash/Zsh).

## Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/iMayuuR/coderouter.git
cd coderouter
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```
*Tip: For NVIDIA NIM, set `PRIMARY_PROVIDER=nvidia` and add your `NIM_API_KEY`.*

### 3. Run Global Installer
This script hooks into your shell profile, logs out existing Claude OAuth, and registers the `coderouter` command.

**Windows (PowerShell):**
```powershell
.\install-global-coderouter.ps1
```

**macOS / Linux (Bash/Zsh):**
```bash
./install-global-coderouter.sh
```

### 4. Start Coding
Open a **new terminal** and simply run:
```bash
coderouter
```

## Model Switching

You can switch models within Claude Code using the `/model` command:

- **Presets:** Type `Custom model` -> `m1`, `m2`, `m3`, `m4`, or `m5`.
- **Aliases:** Type `Custom model` -> `gpt`, `gemma`, `kimi`, `nemotron`, `glm`.
- **Direct ID:** Type `Custom model` -> `nvidia::meta/llama-3.1-405b-instruct`.

## Commands

- `coderouter` — Starts Claude Code with proxy auto-check.
- `coderouter status` — Check if the proxy is healthy.
- `coderouter logs` — View the last few lines of the router log.
- `claude` — Original command still works and is auto-hooked to the proxy.

## Troubleshooting

Logs are stored locally at:
- **Windows:** `%USERPROFILE%\.coderouter\router.log`
- **macOS/Linux:** `~/.coderouter/router.log`

---
Built with ❤️ for the AI Developer community.
