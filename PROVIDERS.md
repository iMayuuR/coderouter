# Multi-Provider Architecture (Jan-Style)

Following the design of [Jan](https://jan.ai), CodeRouter now supports multiple direct AI providers. You are no longer limited to OpenRouter; you can add direct API keys for major providers to reduce latency and access provider-specific features.

## 🛠️ Supported Direct Providers
You can now add the following providers in your `ai-agent-config.json`:

| Provider | Config Key | API URL |
| :--- | :--- | :--- |
| **OpenRouter** | `openrouter` | `https://openrouter.ai/api/v1` |
| **Anthropic** | `anthropic` | `https://api.anthropic.com/v1` |
| **OpenAI** | `openai` | `https://api.openai.com/v1` |
| **Mistral** | `mistral` | `https://api.mistral.ai/v1` |
| **Groq** | `groq` | `https://api.groq.com/openai/v1` |
| **Google** | `google` | `https://generativelanguage.googleapis.com/v1beta` |

## ⚙️ How it Works
1. **Direct Access**: If an API key is provided for a specific provider (e.g., `anthropic`), CodeRouter will hit that provider's API directly.
2. **Translation Layer**: Requests from Claude Code (Anthropic format) are automatically translated to the target provider's format (e.g., OpenAI format) by the proxy.
3. **Smart Fallback**: If a direct key is missing, CodeRouter falls back to OpenRouter.

## 🚀 Configuration
Update your `ai-agent-config.json` like this:

```json
"providers": {
  "anthropic": {
    "enabled": true,
    "api_key": "sk-ant-..."
  },
  "openai": {
    "enabled": true,
    "api_key": "sk-proj-..."
  }
}
```

---
*Inspired by the Jan (janhq/jan) provider configuration system.*
