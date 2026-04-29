/**
 * Provider registry used by router.
 * Provider `path` is for OpenAI-compatible chat completions unless noted.
 */
const providers = {
  openrouter: {
    hostname: "openrouter.ai",
    path: "/api/v1/chat/completions",
    envKey: "OPENROUTER_API_KEY",
    isOpenAI: true,
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://github.com/iMayuuR/coderouter",
      "X-Title": "CodeRouter"
    })
  },
  openai: {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    envKey: "OPENAI_API_KEY",
    isOpenAI: true,
    headers: (key) => ({ Authorization: `Bearer ${key}` })
  },
  groq: {
    hostname: "api.groq.com",
    path: "/openai/v1/chat/completions",
    envKey: "GROQ_API_KEY",
    isOpenAI: true,
    headers: (key) => ({ Authorization: `Bearer ${key}` })
  },
  mistral: {
    hostname: "api.mistral.ai",
    path: "/v1/chat/completions",
    envKey: "MISTRAL_API_KEY",
    isOpenAI: true,
    headers: (key) => ({ Authorization: `Bearer ${key}` })
  },
  nvidia: {
    hostname: "integrate.api.nvidia.com",
    path: "/v1/chat/completions",
    envKey: "NIM_API_KEY",
    isOpenAI: true,
    headers: (key) => ({ Authorization: `Bearer ${key}` })
  },
  google: {
    hostname: "generativelanguage.googleapis.com",
    path: "/v1beta/openai/chat/completions",
    envKey: "GOOGLE_API_KEY",
    isOpenAI: true,
    headers: (key) => ({ Authorization: `Bearer ${key}` })
  },
  anthropic: {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    envKey: "ANTHROPIC_API_KEY",
    isOpenAI: false,
    headers: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    })
  }
};

module.exports = providers;
