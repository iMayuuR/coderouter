# CodeRouter

CodeRouter is a lightweight local router for Claude Code CLI.  
It lets you use multiple providers without any desktop `.exe` install.

## What you get

- One local endpoint for Claude Code: `http://127.0.0.1:3000/v1/messages`
- Multi-provider routing with your own API keys
- Global branded command: `coderouter` (works from any repo)
- Run-once setup, then daily usage is automatic

## Supported providers

- `openrouter` via `OPENROUTER_API_KEY`
- `openai` via `OPENAI_API_KEY`
- `anthropic` via `ANTHROPIC_API_KEY`
- `groq` via `GROQ_API_KEY`
- `mistral` via `MISTRAL_API_KEY`
- `nvidia` via `NIM_API_KEY`
- `google` via `GOOGLE_API_KEY`

## Quick start (minimal)

```bash
git clone https://github.com/iMayuuR/coderouter.git
cd coderouter
npm install
copy .env.example .env
```

Set your model and provider key in `.env`, for example:

```env
DEFAULT_MODEL=openrouter/anthropic/claude-3.5-sonnet
OPENROUTER_API_KEY=your_key_here
```

Run one-time global install:

```powershell
.\install-global-coderouter.ps1
```

Restart terminal, then run from anywhere:

```powershell
coderouter
```

## Commands

- `coderouter` -> opens Claude Code with CodeRouter auto-start/check
- `coderouter status` -> router health
- `coderouter logs` -> last router logs
- `claude` -> still works (also auto-checks router)

## Model format

Use `provider/model`:

- `openrouter/anthropic/claude-3.5-sonnet`
- `openai/gpt-4.1-mini`
- `groq/llama-3.3-70b-versatile`
- `mistral/mistral-large-latest`

You can also set presets in `.env` using `MODEL_1` ... `MODEL_5` and `DEFAULT_MODEL_SLOT`.

## Strict provider mode

No fallback is applied.  
If selected model provider key is missing, request fails with explicit error.

## Health

```bash
curl http://127.0.0.1:3000/health
```

## Docs

- Detailed setup: `SETUP_GUIDE.md`
- Contribution flow: `CONTRIBUTING.md`
