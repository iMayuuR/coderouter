# 🤖 CodeRouter

> **Run Claude Code with ANY AI model — no Anthropic account needed.**

[CodeRouter](https://github.com/iMayuuR/coderouter) is a configuration wrapper for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (Anthropic's official AI coding agent) powered by [OpenRouter](https://openrouter.ai/). It gives you access to **hundreds of models** — including free ones — all through a single setup.

---

## ✨ Features

- **200+ Models:** GPT-4.1, Gemini 3.1 Pro, Llama 4, and more.
- **Zero Account Needed:** Use your OpenRouter API key.
- **Free Options:** Many powerful free models available.
- **AI-Agent Ready:** Includes a `ai-agent-config.json` for automatic setup by AI assistants.
- **Easy Launcher:** Cross-platform scripts for Windows, Mac, and Linux.

---

## 🚀 Quick Start (AI Agent Method)

The easiest way to get started is to let your AI assistant (Cursor, Claude, Antigravity) handle it:

1. **Download/Edit [ai-agent-config.json](ai-agent-config.json)**: Enter your OpenRouter API key and preferred model.
2. **Give it to your AI Agent**: Say *"Please set up this project for me using the config file."*
3. **Run**: Once finished, execute `.\run-claude.ps1` (Windows) or `./run-claude.sh` (Unix).

---

## 🛠️ Manual Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example config:
- **Windows:** `copy .env.example .env`
- **Unix:** `cp .env.example .env`

Edit `.env` and add your [OpenRouter API Key](https://openrouter.ai/settings/keys):

```env
OPENROUTER_API_KEY=sk-or-v1-your-key
CLAUDE_MODEL=google/gemini-3.1-pro
```

### 3. Launch

- **Windows (PowerShell):** `.\run-claude.ps1`
- **Unix (Bash):** `./run-claude.sh`

---

## 🧠 Recommended Models

| Category | Model Name | `.env` Value |
|---|---|---|
| **Best Coding** | Claude 4.6 Sonnet | `anthropic/claude-4.6-sonnet` |
| **Most Powerful** | Claude 4.6 Opus | `anthropic/claude-4.6-opus` |
| **Top Tier** | Gemini 3.1 Pro | `google/gemini-3.1-pro` |
| **Fast & Free** | Step 3.5 Flash | `stepfun/step-3.5-flash:free` |
| **Large & Free** | Nemotron 120B | `nvidia/nemotron-3-super-120b-a12b:free` |

> ⚠️ **Disclaimer:** Please be aware that free models may use your inputs and interaction data for their own training purposes. Exercise caution and avoid sending sensitive or proprietary information when using free tiers.

---

## 🔧 How It Works

CodeRouter acts as a proxy layer, redirecting Claude Code's requests to OpenRouter's Anthropic-compatible API.

```
┌─────────────┐        ┌──────────────┐        ┌──────────────────┐
│  Claude Code │──API──▶│  OpenRouter   │──API──▶│  Your Chosen     │
│  (Terminal)  │◀───────│  (Proxy)     │◀───────│  AI Model        │
└─────────────┘        └──────────────┘        └──────────────────┘
```

---

## 📝 License

MIT — Free to use, modify, and share. Built with 💜 for the AI community.
