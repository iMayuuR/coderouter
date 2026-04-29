const http = require("http");
const https = require("https");
const path = require("path");
const { Transform } = require("stream");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { decompressBody, stripUnsupportedAnthropicFields } = require("./src/utils/helpers");
const { getRoutingConfig } = require("./src/proxy/router");
const { translateAnthropicToOpenAI, translateOpenAIToAnthropicStream } = require("./src/proxy/translators");

const PORT = Number(process.env.PORT || 3000);

// Read model configuration from .env
const defaultModel = process.env.DEFAULT_MODEL || process.env.MODEL_1 || "nvidia/nemotron-3-super-120b-a12b";

// Model presets for quick switching (m1..m5)
const modelPresets = {};
for (let i = 1; i <= 5; i++) {
  if (process.env[`MODEL_${i}`]) modelPresets[i] = process.env[`MODEL_${i}`];
}

// Custom aliases (ALIAS_nemotron=nvidia/..., etc.)
const modelAliases = {};
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("ALIAS_") && value) {
    modelAliases[key.replace("ALIAS_", "").toLowerCase()] = value;
  }
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Anthropic-Version, Anthropic-Beta, X-Api-Key");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  console.log(`[REQ] ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check - support multiple patterns Claude Code uses
  if ((req.method === "GET" || req.method === "HEAD") && (req.url === "/health" || req.url === "/")) {
    if (req.method === "HEAD") {
      res.writeHead(200);
      return res.end();
    }
    return json(res, 200, { ok: true, service: "coderouter", port: PORT });
  }

  // Model listing for Claude Code discovery
  if (req.method === "GET" && req.url === "/v1/models") {
    const allModels = [
      // Default model
      { id: defaultModel, object: "model", owned_by: "coderouter", description: "Default model" },
      // Presets (m1..m5)
      ...Object.entries(modelPresets).map(([slot, id]) => ({
        id: `m${slot}`, object: "model", owned_by: "coderouter", description: id
      })),
      // Aliases
      ...Object.entries(modelAliases).map(([alias, id]) => ({
        id: alias, object: "model", owned_by: "coderouter", description: id
      }))
    ];
    return json(res, 200, { object: "list", data: allModels });
  }

  // Support individual model retrieval (often used by clients for validation)
  if (req.method === "GET" && req.url.startsWith("/v1/models/")) {
    const modelId = req.url.replace("/v1/models/", "");
    const allModels = [
      { id: defaultModel, object: "model", owned_by: "coderouter" },
      ...Object.entries(modelPresets).map(([slot, id]) => ({ id: `m${slot}`, object: "model", owned_by: "coderouter" })),
      ...Object.entries(modelAliases).map(([alias, id]) => ({ id: alias, object: "model", owned_by: "coderouter" }))
    ];
    const found = allModels.find(m => m.id === modelId);
    if (found) return json(res, 200, found);
    // If not found in presets, allow it anyway (might be a direct provider model)
    return json(res, 200, { id: modelId, object: "model", owned_by: "external" });
  }

  // Main endpoint: /v1/messages (Anthropic Messages API)
  const urlPath = req.url.split("?")[0];
  if (req.method !== "POST" || urlPath !== "/v1/messages") {
    return json(res, 404, {
      type: "error",
      error: { type: "not_found_error", message: "Route not found. Use POST /v1/messages" }
    });
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const rawBuffer = Buffer.concat(chunks);
    const bodyBuffer = decompressBody(rawBuffer, req.headers["content-encoding"]);

    let payload;
    try {
      payload = JSON.parse(bodyBuffer.toString());
    } catch (err) {
      console.error(`[ERROR] Invalid JSON: ${err.message}`);
      return json(res, 400, {
        type: "error",
        error: { type: "invalid_request_error", message: "Invalid JSON payload" }
      });
    }

    // --- MODEL INTERCEPTION ---
    let selectedModel = payload.model;

    // Intercept Claude models and route to .env DEFAULT_MODEL
    if (!selectedModel || typeof selectedModel !== "string" || selectedModel.startsWith("claude-")) {
      selectedModel = defaultModel;
      console.log(`[ROUTE] Intercepted "${payload.model}" → ${selectedModel}`);
    }
    // Support m1..m5 shortcuts for quick model switching
    else if (/^m[1-5]$/i.test(selectedModel)) {
      const slot = selectedModel.toLowerCase().replace("m", "");
      selectedModel = modelPresets[slot] || defaultModel;
      console.log(`[ROUTE] Shortcut m${slot} → ${selectedModel}`);
    }
    // Support custom aliases (nemotron, gemma, gpt, etc.)
    else if (modelAliases[selectedModel.toLowerCase()]) {
      const alias = selectedModel.toLowerCase();
      selectedModel = modelAliases[alias];
      console.log(`[ROUTE] Alias "${alias}" → ${selectedModel}`);
    }

    // Store original model for response, apply selected model
    const originalModel = payload.model;
    payload.model = selectedModel;

    // --- PROVIDER RESOLUTION ---
    const routing = getRoutingConfig(selectedModel, process.env);
    if (!routing.ok) {
      console.error(`[ERROR] Routing failed: ${routing.error}`);
      return json(res, routing.status || 400, {
        type: "error",
        error: { type: "invalid_request_error", message: routing.error }
      });
    }

    const { provider, apiKey, providerName, actualModel } = routing;
    const streamMode = payload.stream === true;

    // --- TRANSLATE & SEND ---
    let requestBody;
    if (provider.isOpenAI) {
      requestBody = JSON.stringify(translateAnthropicToOpenAI(payload, actualModel));
    } else {
      stripUnsupportedAnthropicFields(payload);
      requestBody = JSON.stringify(payload);
    }

    console.log(`[PROXY] ${providerName} (${selectedModel}) stream=${streamMode}`);

    const options = {
      hostname: provider.hostname,
      port: 443,
      path: provider.path,
      method: "POST",
      headers: {
        ...provider.headers(apiKey),
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody)
      }
    };

    const proxyReq = https.request(options, (upstreamRes) => {
      console.log(`[PROXY] ← ${upstreamRes.statusCode} from ${providerName}`);

      // For native Anthropic providers or non-error native responses, pipe directly
      if (!provider.isOpenAI && upstreamRes.statusCode < 400) {
        res.writeHead(upstreamRes.statusCode || 500, upstreamRes.headers);
        upstreamRes.pipe(res);
        return;
      }

      // For errors (any provider) or OpenAI responses, we need to handle/translate
      if (upstreamRes.statusCode >= 400) {
        const resChunks = [];
        upstreamRes.on("data", (c) => resChunks.push(c));
        upstreamRes.on("end", () => {
          const body = Buffer.concat(resChunks).toString();
          console.error(`[ERROR] Upstream error (${upstreamRes.statusCode}): ${body}`);
          let message = body;
          try {
            const parsed = JSON.parse(body);
            message = parsed.error?.message || parsed.error || body;
          } catch {}
          return json(res, upstreamRes.statusCode, {
            type: "error",
            error: { type: "invalid_request_error", message: `Upstream error: ${message}` }
          });
        });
        return;
      }

      // For OpenAI providers: translate response to Anthropic format
      if (!streamMode) {
        // Non-streaming: collect full response, translate, send
        const resChunks = [];
        upstreamRes.on("data", (c) => resChunks.push(c));
        upstreamRes.on("end", () => {
          const body = Buffer.concat(resChunks).toString();
          console.log(`[PROXY] Upstream body: ${body.slice(0, 100)}...`);
          try {
            const openaiRes = JSON.parse(body);
            if (!openaiRes.choices || openaiRes.choices.length === 0) {
              console.warn(`[WARN] Upstream returned 200 but no choices. Body: ${body}`);
              return json(res, 200, {
                id: `msg_${Math.random().toString(36).slice(2, 11)}`,
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "(Upstream returned empty response)" }],
                model: originalModel || selectedModel,
                usage: { input_tokens: 0, output_tokens: 0 }
              });
            }
            const content = openaiRes.choices[0].message?.content || "";
            const usage = openaiRes.usage || {};
            const anthropicRes = {
              id: `msg_${Math.random().toString(36).slice(2, 11)}`,
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: content }],
              model: originalModel || selectedModel,
              stop_reason: "end_turn",
              stop_sequence: null,
              usage: {
                input_tokens: usage.prompt_tokens || 0,
                output_tokens: usage.completion_tokens || 0
              }
            };
            json(res, 200, anthropicRes);
          } catch (e) {
            console.error(`[ERROR] Response parse failed: ${e.message}`);
            json(res, 502, {
              type: "error",
              error: { type: "api_error", message: "Failed to parse upstream response" }
            });
          }
        });
        return;
      }

      // Streaming: translate SSE events
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });

      const messageId = `msg_${Math.random().toString(36).slice(2, 11)}`;
      let buffer = "";

      const patchStream = new Transform({
        transform(chunk, encoding, callback) {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop();
          const translated = lines
            .map((l) => translateOpenAIToAnthropicStream(l, messageId, originalModel || selectedModel))
            .filter(Boolean);
          callback(null, translated.join(""));
        },
        flush(callback) {
          if (buffer) {
            const translated = translateOpenAIToAnthropicStream(buffer, messageId, originalModel || selectedModel);
            if (translated) this.push(translated);
          }
          callback();
        }
      });

      upstreamRes.pipe(patchStream).pipe(res);
    });

    proxyReq.on("error", (e) => {
      console.error(`[ERROR] Upstream request failed: ${e.message}`);
      json(res, 502, {
        type: "error",
        error: { type: "api_error", message: `Upstream error: ${e.message}` }
      });
    });

    proxyReq.write(requestBody);
    proxyReq.end();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CodeRouter running on http://127.0.0.1:${PORT}`);
  console.log(`Default model: ${defaultModel}`);
  console.log(`Presets: ${JSON.stringify(modelPresets)}`);
  console.log(`Aliases: ${JSON.stringify(modelAliases)}`);
});
