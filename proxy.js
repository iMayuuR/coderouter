const http = require('http');
const https = require('https');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = 3000;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/messages';

// User configured models
const defaultModel = process.env.CLAUDE_MODEL || 'openrouter/free';
let fallbackVisionModel = process.env.VISION_MODEL || 'qwen/qwen-2.5-vl-72b-instruct:free';
let dynamicVisionModel = null;
const fs = require('fs');
const apiKey = (process.env.OPENROUTER_API_KEY || '').trim().replace(/^["'](.*)["']$/, '$1');

// Final debug check to a file (since console is cleared by Claude CLI)
fs.writeFileSync(path.join(__dirname, 'proxy-debug.log'), `[${new Date().toISOString()}] Started. Key length: ${apiKey.length}\n`);

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
      const bodyBuffer = Buffer.concat(bodyChunks);
      let requestBodyStr = bodyBuffer.toString('utf8');
      
      try {
        const payload = JSON.parse(requestBodyStr);
        
        // Smart Routing: Check for images in the messages
        const requiresVision = hasImageParam(payload.messages);
        
        // Override the model intelligently
        if (requiresVision) {
          const selectedVisionModel = dynamicVisionModel || fallbackVisionModel;
          payload.model = selectedVisionModel;
        } else {
          payload.model = defaultModel;
        }

        // STRIP CACHE_CONTROL to prevent OpenRouter 400 errors (context management features not available)
        function stripCacheControl(obj) {
          if (Array.isArray(obj)) {
            obj.forEach(stripCacheControl);
          } else if (obj !== null && typeof obj === 'object') {
            if ('cache_control' in obj) {
              delete obj['cache_control'];
            }
            Object.values(obj).forEach(stripCacheControl);
          }
        }
        stripCacheControl(payload);

        requestBodyStr = JSON.stringify(payload);
      } catch (err) {
        console.error("Error parsing JSON body", err);
      }

      // Forward request to OpenRouter
      // Make sure we always prepend '/api' to force OpenRouter's Anthropic compatibility layer
      let finalPath = req.url || '/v1/messages';
      if (!finalPath.startsWith('/api')) {
        finalPath = '/api' + finalPath;
      }
      
      const options = {
        hostname: 'openrouter.ai',
        port: 443,
        path: finalPath,
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'Content-Length': Buffer.byteLength(requestBodyStr),
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/iMayuuR/coderouter', 
          'X-Title': 'CodeRouter',
          'User-Agent': 'CodeRouter Proxy/1.0'
        }
      };

      // Pass along anthropic-version if Claude provided it
      if (req.headers['anthropic-version']) {
         options.headers['anthropic-version'] = req.headers['anthropic-version'];
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
