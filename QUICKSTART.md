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
Copy the example file to `.env`:
- **Windows:** `copy .env.example .env`
- **Mac/Linux:** `cp .env.example .env`

Edit `.env` and paste your [OpenRouter API Key](https://openrouter.ai/settings/keys):
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
CLAUDE_MODEL=openrouter/free
```

### 3️⃣ One-Shot Setup
Run the automation script to install the global alias, proxy, and all 200+ skills:
- **Windows (PowerShell):** `.\setup-agent.ps1`
- **Alternative (All OS):** `node install-global-skills.js`

### 4️⃣ ⚠️ Restart Terminal
**IMPORTANT:** Close your current terminal/PowerShell window completely and open a new one. This reloads your profile so the `claude` command works from anywhere.

---

### 🚀 Launch!
From **any folder** on your computer, just type:
```bash
claude
```

### 🧠 Using Your 200+ Skills
Your terminal is now hyper-charged. Try these:
- `claude "use the brainstorming skill to plan a new feature"`
- `claude "run a security audit on this folder"`
- `claude "help me with UI/UX for this page"`

> [!TIP]
> Even if the `/skills` menu shows "0", don't worry! It's a display bug in the CLI. Your skills ARE installed and will work when you ask for them by name.
