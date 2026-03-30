# 🤖 Claude Code + OpenRouter

> **Run Claude Code with ANY AI model — no Anthropic account needed.**

Use [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (Anthropic's official AI coding agent) powered by [OpenRouter](https://openrouter.ai/), giving you access to **hundreds of models** including free ones — all through a single config file.

---

## ✨ Why?

| Feature | Direct Anthropic | This Setup |
|---|---|---|
| Models available | Claude only | **200+ models** (GPT, Gemini, Llama, etc.) |
| Free models | ❌ | ✅ Many free options |
| Anthropic account | Required | **Not needed** |
| Provider failover | ❌ | ✅ Automatic |
| Switch models | Hard | **Edit one line** in `.env` |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/claude-code-openrouter.git
cd claude-code-openrouter
npm install
```

### 2. Get an OpenRouter API Key

1. Go to [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Create a free account
3. Generate an API key

### 3. Configure

```bash
# Copy the example config
copy .env.example .env          # Windows CMD
cp .env.example .env            # Linux / macOS / WSL
```

Open `.env` and paste your API key:

```env
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
CLAUDE_MODEL=stepfun/step-3.5-flash:free
```

### 4. Run!

**Windows (PowerShell):**
```powershell
.\run-claude.ps1
```

**Windows (CMD):**
```cmd
run-claude.bat
```

**Linux / macOS / WSL:**
```bash
chmod +x run-claude.sh
./run-claude.sh
```

That's it! Claude Code will start using your chosen model via OpenRouter. 🎉

---

## 🔄 Changing Models

Edit the `CLAUDE_MODEL` line in your `.env` file. **No restart needed** — just run the script again.

```env
# Just change this one line:
CLAUDE_MODEL=openrouter/auto
```

### 🆓 Free Models

| Model | `.env` value |
|---|---|
| Step 3.5 Flash | `stepfun/step-3.5-flash:free` |
| Nemotron 120B | `nvidia/nemotron-3-super-120b-a12b:free` |
| Llama 4 Maverick | `meta-llama/llama-4-maverick:free` |
| Gemma 3 27B | `google/gemma-3-27b-it:free` |
| Qwen3 235B | `qwen/qwen3-235b-a22b:free` |
| DeepSeek V3 | `deepseek/deepseek-chat-v3-0324:free` |

### 💎 Paid Models (Pay-per-use)

| Model | `.env` value |
|---|---|
| Auto (best match) | `openrouter/auto` |
| Claude Sonnet 4 | `anthropic/claude-sonnet-4` |
| GPT-4.1 | `openai/gpt-4.1` |
| Gemini 2.5 Pro | `google/gemini-2.5-pro-preview` |

> 📋 Full model list: [openrouter.ai/models](https://openrouter.ai/models)

---

## 📁 Project Structure

```
claude-code-openrouter/
├── .env.example        # Template config (safe to commit)
├── .env                # Your config with API key (gitignored)
├── .gitignore          # Protects your API key
├── run-claude.bat      # Windows CMD launcher
├── run-claude.ps1      # Windows PowerShell launcher
├── run-claude.sh       # Linux/macOS/WSL launcher
├── package.json        # Node.js dependencies
├── LICENSE             # MIT License
└── README.md           # You are here!
```

---

## 🔧 How It Works

```
┌─────────────┐        ┌──────────────┐        ┌──────────────────┐
│  Claude Code │──API──▶│  OpenRouter   │──API──▶│  Your Chosen     │
│  (Terminal)  │◀───────│  (Proxy)     │◀───────│  AI Model        │
└─────────────┘        └──────────────┘        └──────────────────┘
```

1. The launcher script sets environment variables that redirect Claude Code to OpenRouter instead of Anthropic
2. OpenRouter's **Anthropic-compatible API** makes Claude Code think it's talking to Anthropic
3. OpenRouter routes the request to whichever model you configured
4. You get full Claude Code features (file editing, terminal, etc.) with any model!

---

## ❓ Troubleshooting

### Claude asks me to log in
Your `.env` file is missing or not being read. Make sure:
- `.env` exists in the same folder as the run script
- `OPENROUTER_API_KEY` is set correctly
- You're running via the script (`.\run-claude.ps1`), not just `claude` directly

### "API key invalid" error
- Double-check your key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- Make sure there are no extra spaces in your `.env` file

### Model not working / errors
- Some models may not support all Claude Code features (tool use, thinking, etc.)
- Try `openrouter/auto` for best compatibility
- Check model status on [openrouter.ai/models](https://openrouter.ai/models)

### PowerShell Execution Policy
If PowerShell blocks the `.ps1` script:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📊 Track Usage

Monitor your API usage and costs in real-time:
👉 [openrouter.ai/activity](https://openrouter.ai/activity)

---

## 📝 License

MIT — free to use, modify, and share.

---

<p align="center">
  <b>⭐ Star this repo if it helped you!</b>
</p>
