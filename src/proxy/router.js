const providers = require("./providers");

const prefixMap = {
  openrouter: "openrouter",
  openai: "openai",
  groq: "groq",
  mistral: "mistral",
  nvidia: "nvidia",
  google: "google",
  anthropic: "anthropic"
};

function modelProvider(model, primaryProvider) {
  if (!model || typeof model !== "string") return { providerName: primaryProvider, actualModel: model };
  
  // Explicit override: e.g. "nvidia::google/gemma-2-9b-it"
  if (model.includes("::")) {
    const parts = model.split("::");
    const prefix = parts[0].toLowerCase();
    if (prefixMap[prefix]) {
      return { providerName: prefixMap[prefix], actualModel: parts.slice(1).join("::") };
    }
  }

  // Implicit override by slash prefix (legacy)
  const prefix = model.split("/")[0].toLowerCase();
  if (prefixMap[prefix]) {
    return { providerName: prefixMap[prefix], actualModel: model };
  }
  
  return { providerName: primaryProvider, actualModel: model };
}

function getRoutingConfig(model, env) {
  const primary = (env.PRIMARY_PROVIDER || "openrouter").toLowerCase();
  const { providerName: preferredProvider, actualModel } = modelProvider(model, primary);

  if (!providers[preferredProvider]) {
    return {
      ok: false,
      status: 400,
      error: `Unknown provider "${preferredProvider}". Check model prefix or PRIMARY_PROVIDER.`
    };
  }

  const provider = providers[preferredProvider];
  const apiKey = env[provider.envKey];
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      error: `Missing API key for provider "${preferredProvider}". Set ${provider.envKey} in .env.`
    };
  }

  return {
    ok: true,
    provider,
    apiKey,
    providerName: preferredProvider,
    actualModel: actualModel
  };
}

module.exports = { getRoutingConfig };
