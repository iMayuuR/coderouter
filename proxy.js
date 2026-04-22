const http = require('http');
const https = require('https');
const zlib = require('zlib');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = 3000;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/messages';

// User configured models
const defaultModel = process.env.CLAUDE_MODEL || 'openrouter/free';
let fallbackVisionModel = process.env.VISION_MODEL || 'qwen/qwen-2.5-vl-72b-instruct:free';
let dynamicVisionModel = null;
const fs = require('fs');
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');
const MISTRAL_API_KEY = (process.env.MISTRAL_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');
const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');
const GOOGLE_API_KEY = (process.env.GOOGLE_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');

const PRIMARY_PROVIDER = process.env.PRIMARY_PROVIDER || 'openrouter';

const PROXY_DEBUG =
  process.env.CODEROUTER_PROXY_DEBUG === '1' ||
  process.env.CODEROUTER_PROXY_DEBUG === 'true';
const proxyDebugLogPath = path.join(__dirname, 'proxy-debug.log');
function proxyDebugLog(message) {
  if (!PROXY_DEBUG) return;
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(proxyDebugLogPath, line);
  } catch (_) {
    /* ignore disk errors */
  }
}
if (PROXY_DEBUG) {
  try {
    fs.writeFileSync(
      proxyDebugLogPath,
      `[${new Date().toISOString()}] Started. Key length: ${apiKey.length}\n`
    );
  } catch (_) {}
}

if (!apiKey) {
  console.error("❌ ERROR: OPENROUTER_API_KEY is not set in .env");
  process.exit(1);
}

// Ignore Ctrl+C (SIGINT) so the proxy doesn't die when the user interrupts Claude Code
process.on('SIGINT', () => {
  // Graceful handling handled by run-claude script's finally block
});

// Smart Model Picker function
function updateDynamicModels() {
  https.get('https://openrouter.ai/api/v1/models', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const freeVision = json.data.filter(m => 
          (m.pricing.prompt === "0" || m.pricing.prompt === 0 || Number(m.pricing.prompt) === 0) &&
          (m.pricing.completion === "0" || m.pricing.completion === 0 || Number(m.pricing.completion) === 0) &&
          m.architecture && 
          ((m.architecture.modality && m.architecture.modality.includes('image')) ||
           (m.architecture.input_modalities && m.architecture.input_modalities.includes('image')))
        );
        if (freeVision.length > 0) {
          // Select the first available free vision model
          dynamicVisionModel = freeVision[0].id;
        }
      } catch (err) {
        console.error("Error parsing OpenRouter models:", err.message);
      }
    });
  }).on('error', err => {
    console.error("Failed to fetch OpenRouter models:", err.message);
  });
}

// Fetch models immediately and then every 2 hours
updateDynamicModels();
setInterval(updateDynamicModels, 2 * 60 * 60 * 1000);

// Check if the payload contains any image content
function hasImageParam(messages) {
  if (!messages || !Array.isArray(messages)) return false;
  
  for (const msg of messages) {
    if (msg.content && Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === 'image' || item.type === 'image_url') {
          return true;
        }
      }
    }
  }
  return false;
}

/** OpenRouter 400 if any context-management-* beta is present (Anthropic-direct only). */
function filterAnthropicBetaHeader(raw) {
  if (raw == null || raw === '') return null;
  const parts = String(Array.isArray(raw) ? raw.join(',') : raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const filtered = parts.filter((p) => !/^context-management-/i.test(p));
  return filtered.length ? filtered.join(',') : null;
}

function decompressRequestBody(buffer, contentEncoding) {
  if (!contentEncoding || !buffer.length) return buffer;
  const enc = String(contentEncoding).toLowerCase();
  try {
    if (enc.includes('gzip')) return zlib.gunzipSync(buffer);
    if (enc.includes('deflate')) return zlib.inflateSync(buffer);
    if (enc.includes('br')) return zlib.brotliDecompressSync(buffer);
  } catch (e) {
    proxyDebugLog(`decompress failed (${enc}): ${e.message}`);
  }
  return buffer;
}

const server = http.createServer((req, res) => {
  // CORS Headers (just in case Claude Code checks them)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // We only care about proxying POST requests (messages API)
  if (req.method === 'POST') {
    let bodyChunks = [];
    
    req.on('data', chunk => {
      bodyChunks.push(chunk);
    });

    req.on('end', () => {
      const rawBuffer = Buffer.concat(bodyChunks);
      const bodyBuffer = decompressRequestBody(rawBuffer, req.headers['content-encoding']);
      let requestBodyStr = bodyBuffer.toString('utf8');
      let parseOk = false;

      try {
        const payload = JSON.parse(requestBodyStr);
        parseOk = true;
        
        // Smart Routing: Check for images in the messages
        const requiresVision = hasImageParam(payload.messages);
        
        // Override the model intelligently
        if (requiresVision) {
          const selectedVisionModel = dynamicVisionModel || fallbackVisionModel;
          payload.model = selectedVisionModel;
        } else {
          payload.model = defaultModel;
        }

        // STRIP ANTHROPIC-ONLY FEATURES — OpenRouter returns 400 for context-management-2025-06-27 (no Anthropic provider)
        function stripAnthropicBetas(obj) {
          if (Array.isArray(obj)) {
            obj.forEach(stripAnthropicBetas);
          } else if (obj !== null && typeof obj === 'object') {
            if ('cache_control' in obj) {
              delete obj['cache_control'];
            }
            if ('betas' in obj) {
              delete obj['betas'];
            }
            Object.values(obj).forEach(stripAnthropicBetas);
          }
        }
        stripAnthropicBetas(payload);

        function stripContextManagement(obj) {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            obj.forEach(stripContextManagement);
            return;
          }
          for (const k of Object.keys(obj)) {
            const kl = k.toLowerCase().replace(/-/g, '_');
            if (kl === 'context_management' || kl === 'contextmanagement') {
              delete obj[k];
            }
          }
          if (obj.metadata && typeof obj.metadata === 'object') {
            delete obj.metadata.betas;
            delete obj.metadata.context_management;
            delete obj.metadata.contextManagement;
            for (const mk of Object.keys(obj.metadata)) {
              const mkl = mk.toLowerCase().replace(/-/g, '_');
              if (mkl === 'context_management' || mkl === 'contextmanagement') {
                delete obj.metadata[mk];
              }
            }
          }
          for (const k of Object.keys(obj)) {
            stripContextManagement(obj[k]);
          }
        }
        stripContextManagement(payload);

        requestBodyStr = JSON.stringify(payload);
        
        proxyDebugLog(`Outgoing Body: ${requestBodyStr.substring(0, 200)}...`);
      } catch (err) {
        console.error("Error parsing JSON body", err);
        proxyDebugLog(`JSON parse error: ${err.message}`);
      }

      if (!parseOk) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              message:
                'CodeRouter proxy could not parse the request body (invalid JSON or bad compression). Fix: use run-claude.ps1 / run-claude.sh so the proxy receives plain JSON.',
              type: 'proxy_parse_error',
            },
          })
        );
        return;
      }

      // --- Dynamic Routing (Jan-style) ---
      let targetHostname = 'openrouter.ai';
      let targetPath = req.url || '/v1/messages';
      let targetKey = OPENROUTER_API_KEY;
      let targetHeaders = {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Content-Length': Buffer.byteLength(requestBodyStr),
      };

      const requestedModel = payload.model || defaultModel;
      
      if (requestedModel.startsWith('anthropic/') && ANTHROPIC_API_KEY) {
        targetHostname = 'api.anthropic.com';
        targetPath = '/v1/messages';
        targetKey = ANTHROPIC_API_KEY;
        targetHeaders['anthropic-version'] = req.headers['anthropic-version'] || '2023-06-01';
        targetHeaders['anthropic-dangerous-direct-browser-access'] = 'true';
      } else if (requestedModel.startsWith('openai/') && OPENAI_API_KEY) {
        // Basic translation for OpenAI would go here
        // For now, we still use OpenRouter for translation unless direct OpenAI is needed
        targetHostname = 'openrouter.ai'; 
      } else {
        // Default to OpenRouter
        if (!targetPath.startsWith('/api')) {
          targetPath = '/api' + targetPath;
        }
        targetHeaders['HTTP-Referer'] = 'https://github.com/iMayuuR/coderouter';
        targetHeaders['X-Title'] = 'CodeRouter';
      }

      targetHeaders['Authorization'] = `Bearer ${targetKey}`;

      const options = {
        hostname: targetHostname,
        port: 443,
        path: targetPath,
        method: 'POST',
        headers: targetHeaders
      };

      if (safeBeta) {
        options.headers['anthropic-beta'] = safeBeta;
      }

      const proxyReq = https.request(options, (proxyRes) => {
        // Drop content-length because we might modify the payload length
        delete proxyRes.headers['content-length'];
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        const { Transform } = require('stream');
        const patchStream = new Transform({
          transform(chunk, encoding, callback) {
            let chunkStr = chunk.toString('utf8');
            
            // Inject fake usage block if OpenRouter neglects to provide it in Anthropic SSE stream
            if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/event-stream')) {
              if (chunkStr.includes('"type":"message_start"') && !chunkStr.includes('"usage"')) {
                chunkStr = chunkStr.replace(/"message"\s*:\s*\{/, '"message":{"usage":{"input_tokens":0,"output_tokens":0},');
              }
              if (chunkStr.includes('"type":"message_delta"') && !chunkStr.includes('"usage"')) {
                chunkStr = chunkStr.replace(/"type"\s*:\s*"message_delta"/, '"type":"message_delta","usage":{"output_tokens":0}');
              }
            } else if (chunkStr.trim().startsWith('{')) {
              // Non-streaming JSON fallback
              try {
                let obj = JSON.parse(chunkStr);
                if (!obj.usage) {
                  obj.usage = { input_tokens: 0, output_tokens: 0 };
                  chunkStr = JSON.stringify(obj);
                }
              } catch(e) {}
            }
            
            callback(null, Buffer.from(chunkStr, 'utf8'));
          }
        });

        proxyRes.pipe(patchStream).pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error("Proxy error:", err);
        res.writeHead(500);
        res.end("Internal Proxy Error");
      });

      proxyReq.write(requestBodyStr);
      proxyReq.end();
    });
  } else {
    // For GETs or other endpoints
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  // Silent startup
});
