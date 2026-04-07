# ⚡ CodeRouter Quickstart

Get Claude Code running with **OpenRouter (Free Models)** and **200+ Agentic Skills** in 60 seconds.

---

### 1️⃣ Clone & Install
```bash
git clone https://github.com/iMayuuR/coderouter.git
cd coderouter
npm install
```

### 2️⃣ Configure API Key
Copy the example file to `.env` (same folder as `install-global-skills.js`):
- **Windows:** `copy .env.example .env` — or `copy install-global-skills.example.env .env`
- **Mac/Linux:** `cp .env.example .env` — or `cp install-global-skills.example.env .env`

Edit `.env` and paste your [OpenRouter API Key](https://openrouter.ai/settings/keys):
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
CLAUDE_MODEL=openrouter/free
```

### 3️⃣ One-Shot Setup
Run the automation script to install the global `claude` launcher, proxy wiring, and all 200+ skills. On Windows it also sets **User environment variables** (API key, model) and adds `~/.coderouter/bin` to your **User PATH**.

- **All platforms (recommended):** `node install-global-skills.js` (reads `.env` in the repo folder).
- **Windows optional:** `.\setup-agent.ps1` — **only if** `ai-agent-config.json` is present; it copies `user_preferences` into `.env`, runs `npm install`, installs global Claude Code if missing, then runs `install-global-skills.js`.

> [!NOTE]
> If you ever move the `coderouter` folder, just run this command again to update your paths automatically.

### 🔌 Optional: @21st-dev/magic MCP

1. **Prerequisite:** `~/.claude.json` must exist. If the installer prints “skipping MCP” because the file is missing, **open Claude Code once** (any folder), quit, then run `node install-global-skills.js` again.
2. Get an API key at [21st.dev](https://21st.dev).
3. From the repo folder: **`npm run setup:21st`** (paste when prompted) **or** `node setup-21st.js YOUR_KEY`, **or** add `MAGIC_API_KEY=...` to `.env` manually.
4. Run **`node install-global-skills.js`**. This writes **user-scope** MCP: **`~/.claude.json` → top-level `mcpServers`** (so **every project** sees `@21st-dev/magic`, not only one folder). On Windows the command uses `cmd /c npx …` per Claude Code guidance.
5. **Restart Claude Code** (and the IDE if you use the integrated agent) so `/mcp` and the MCP list refresh.
6. Optional check: `claude mcp list` — you should see `@21st-dev/magic`.

Remove the key from `.env` with `node setup-21st.js --remove`, then run `node install-global-skills.js` again to drop the server from config.

### 4️⃣ ⚠️ Restart Terminal
**IMPORTANT:** Close your current terminal/PowerShell window completely and open a new one. This reloads your profile and environment variables so the `claude` command works from anywhere.

---

### 🚀 Launch!
From **any folder** on your computer, after a **full terminal restart**:
```bash
claude
# or (same launcher)
coderouter
```

Inside the **coderouter** repo only, you can also run `npm run claude` (same launcher as `run-claude.ps1` / `run-claude.sh`). Avoid plain `npx claude` there — it bypasses the local proxy.

### 🧠 Using Your 200+ Skills
Your terminal is now hyper-charged. Try these:
- `claude "use the brainstorming skill to plan a new feature"`
- `claude "run a security audit on this folder"`
- `claude "help me with UI/UX for this page"`

> [!TIP]
> Even if the `/skills` menu shows "0", don't worry! It's a display bug in the CLI. Your skills ARE installed and will work when you ask for them by name.

---

### 🤖 Agent setup prompt (IDE AI agents)

This is the **same text** as the **Copy setup prompt for AI** button on [docs/index.html](docs/index.html). If you edit one, update the other so they stay identical.

Paste everything in the block below into Cursor, Windsurf, Copilot Chat, or any coding agent:

```text
=== CodeRouter install (run commands; do not only summarize) ===
Official repo: https://github.com/iMayuuR/coderouter — canonical copy: QUICKSTART.md § Agent setup prompt (keep in sync with docs/index.html).

GOAL
Install CodeRouter so Claude Code uses OpenRouter through the local proxy: global commands `claude` and `coderouter` (same launcher), or `npm run claude` from the repo.

PREREQUISITES (check first; install if missing)
- Node.js LTS + npm
- Claude Code CLI (https://docs.anthropic.com/en/docs/claude-code/setup) — e.g. `npm install -g @anthropic-ai/claude-code` or Anthropic native installer
- OpenRouter API key: https://openrouter.ai/settings/keys

DEFINITIONS
- REPO ROOT = folder that contains package.json, install-global-skills.js, run-claude.ps1, proxy.js. Every shell command below uses REPO ROOT as cwd unless stated otherwise.

RULES
- Never git-add or commit .env. Never echo full API keys back unless the user explicitly needs them.
- Inside this repo, do NOT use plain `npx claude` for normal runs — it bypasses the CodeRouter proxy. Use `npm run claude` or `npm run coderouter` from REPO ROOT, or after setup use global `claude` / `coderouter`.

STEP 1 — Source + dependencies
- If the coderouter tree is not present: `git clone https://github.com/iMayuuR/coderouter.git` then `cd coderouter`. If git unavailable, download the repo ZIP from GitHub and extract, then `cd` into the extracted folder.
- From REPO ROOT: `npm install`

STEP 2 — Secrets file (.env at REPO ROOT)
- Copy a template to `.env`:
  CMD:        copy .env.example .env
  PowerShell: Copy-Item .env.example .env
  macOS/Linux: cp .env.example .env
  (Equivalent alternative template: install-global-skills.example.env → copy to .env the same way.)
- Edit `.env`: set OPENROUTER_API_KEY=<ask user if unknown>. Set CLAUDE_MODEL=openrouter/free unless the user names another OpenRouter model id.
- If `ai-agent-config.json` exists in REPO ROOT with user_preferences: map api_key → OPENROUTER_API_KEY and model → CLAUDE_MODEL in `.env` before STEP 3.

STEP 3 — Global installer (required once per machine / after moving the repo folder)
- From REPO ROOT: `node install-global-skills.js`
  This reads `.env`, installs bundled skills under ~/.claude/skills, wires launchers. On Windows it also sets User env and adds ~/.coderouter/bin (claude.cmd + coderouter.cmd) to User PATH; on Unix it adds shell aliases.
- Windows-only optional path: `.\setup-agent.ps1` ONLY if `ai-agent-config.json` exists in REPO ROOT (script exits if missing). It runs npm install, merges config into .env, then runs install-global-skills.js. If that JSON file is absent, skip setup-agent.ps1 and use `node install-global-skills.js` only.

STEP 4 — Restart (mandatory for PATH / profile changes)
- Instruct the user to fully close every terminal tab/window (including IDE integrated terminals), then open a new terminal. Partial reload is not enough.

STEP 5 — Verify (run after restart)
- From an arbitrary directory (new shell): `claude` OR `coderouter` — expect CodeRouter banner then Claude Code.
- If PATH not updated yet: from REPO ROOT run `npm run claude` or `npm run coderouter` (same as run-claude.ps1 / run-claude.sh).
- Success = no immediate API 400 about context-management on first message; if it appears, confirm launch used run-claude / global launcher, not raw npx claude in repo.

NOTES
- MAGIC_API_KEY in .env is optional. With it set, `node install-global-skills.js` adds @21st-dev/magic to ~/.claude.json top-level mcpServers (user scope). Requires ~/.claude.json to exist (run Claude Code once first). Restart Claude Code after MCP changes; verify with `claude mcp list`.
- If Claude Code UI shows /skills count 0, skills may still load when invoked by name.
- PowerShell: if scripts are blocked, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once or call powershell -ExecutionPolicy Bypass -File .\setup-agent.ps1

DELIVERABLE
Reply with: (1) exact commands run + cwd for each, (2) full stderr if anything failed, (3) whether `claude`/`coderouter` or `npm run claude` succeeded.
```
