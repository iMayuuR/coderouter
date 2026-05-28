# 🚀 How to Run Coderouter

Coderouter is an Anthropic-compatible proxy that routes traffic from Claude Code to various AI providers (NVIDIA NIM, OpenRouter, Ollama, etc.).

## 1. Install Prerequisites

First, ensure you have **Python 3.14** and **uv** installed.

### Install `uv` (Windows PowerShell)
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
uv self update
```

### Install Python 3.14
```powershell
uv python install 3.14
```

### 1.1 Install Bundled Claude Skills
Copy the bundled skills to your Claude configuration directory:
```powershell
New-Item -ItemType Directory -Path "$HOME\.claude\skills" -Force
robocopy bundled-skills\skills "$HOME\.claude\skills" /E
```

## 2. Setup Configuration

You need to create a `.env` file to store your API keys and configuration.

### Create `.env` from example
```powershell
cp .env.example .env
```

### Configure Keys
Open `.env` and add your provider API key (e.g., `NVIDIA_NIM_API_KEY`, `OPENROUTER_API_KEY`, etc.).

## 3. Launch Claude Code (Auto-Starts Proxy)

The easiest way to use Coderouter is to just run the launcher:

```powershell
uv run coderouter-claude
```

**It's that easy!** This single command:
1. Automatically sets all necessary environment variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`).
2. Smartly detects if the proxy server is running.
3. Automatically starts the proxy server in the background if it's off.
4. Smoothly shuts down the background proxy when you exit Claude.

Alternatively, if you want to run the proxy manually in a separate terminal, use:
```powershell
uv run coderouter-server
```
Once started, you can access the **Admin UI** at: `http://127.0.0.1:8082/admin`

Alternatively, you can manually set the environment variables:
```powershell
$env:ANTHROPIC_BASE_URL="http://localhost:8082"
$env:ANTHROPIC_AUTH_TOKEN="freecc" # Or whatever you set in .env
claude
```

## 5. Running Always (Background Mode)

If you want the server to keep running even after closing the terminal or restarting your computer, use **PM2**.

### Install PM2
```powershell
npm install -g pm2
```

### Start the Server in Background
```powershell
pm2 start "uv run coderouter-server" --name coderouter
```

### Manage the Background Process
- **View Logs**: `pm2 logs coderouter`
- **Check Status**: `pm2 status`
- **Stop Server**: `pm2 stop coderouter`
- **Restart Server**: `pm2 restart coderouter`

### Run on System Startup (Windows)
To make it start automatically when Windows boots:
1. Install startup helper: `npm install -g pm2-windows-startup`
2. Configure it: `pm2-startup install`
3. Save current processes: `pm2 save`
