const zlib = require("zlib");

function hasImageInput(messages) {
  if (!Array.isArray(messages)) return false;
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "image" || part.type === "image_url") return true;
    }
  }
  return false;
}

function decompressBody(buffer, contentEncoding) {
  if (!contentEncoding || !buffer.length) return buffer;
  const enc = String(contentEncoding).toLowerCase();
  try {
    if (enc.includes("gzip")) return zlib.gunzipSync(buffer);
    if (enc.includes("deflate")) return zlib.inflateSync(buffer);
    if (enc.includes("br")) return zlib.brotliDecompressSync(buffer);
  } catch {
    return buffer;
  }
  return buffer;
}

function stripUnsupportedAnthropicFields(payload) {
  const clean = (obj) => {
    if (Array.isArray(obj)) {
      obj.forEach(clean);
      return;
    }
    if (!obj || typeof obj !== "object") return;
    delete obj.cache_control;
    delete obj.betas;
    delete obj.context_management;
    delete obj.contextManagement;
    Object.values(obj).forEach(clean);
  };
  clean(payload);
}

function modelWithoutProviderPrefix(modelId) {
  if (!modelId || typeof modelId !== "string") return modelId;
  const parts = modelId.split("/");
  if (parts.length === 1) return modelId;
  if (parts[0] === "nvidia" || parts[0] === "google" || parts[0] === "openai" || parts[0] === "groq" || parts[0] === "mistral") {
    // These providers usually require their prefixes if they are the direct upstream,
    // or if the proxy handles them directly instead of through openrouter.
    // However, wait. If they are direct, the model name might actually be the full string.
    // For openrouter, openrouter expects `anthropic/claude-...` etc., so stripping openrouter/ is correct.
    if (parts[0] === "openrouter") return parts.slice(1).join("/");
    return modelId;
  }
  return parts.slice(1).join("/");
}

module.exports = {
  hasImageInput,
  decompressBody,
  stripUnsupportedAnthropicFields,
  modelWithoutProviderPrefix
};
