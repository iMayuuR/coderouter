const http = require('http');
const https = require('https');

// Load env vars
require('dotenv').config();

const PORT = 3000;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/messages';

// User configured models
const defaultModel = process.env.CLAUDE_MODEL || 'openrouter/free';
let fallbackVisionModel = process.env.VISION_MODEL || 'qwen/qwen-2.5-vl-72b-instruct:free';
let dynamicVisionModel = null;
const apiKey = process.env.OPENROUTER_API_KEY;

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
          console.log(`\n🔄 [Smart Picker] Dynamically selected free vision model: ${dynamicVisionModel}`);
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

if (!apiKey) {
  console.error("❌ ERROR: OPENROUTER_API_KEY is not set in .env");
  process.exit(1);
}

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
          console.log(`\n👁️  [Smart Router] Image detected! Utilizing Vision Model: ${selectedVisionModel}`);
          payload.model = selectedVisionModel;
        } else {
          payload.model = defaultModel;
        }

        requestBodyStr = JSON.stringify(payload);
      } catch (err) {
        console.error("Error parsing JSON body", err);
      }

      // Forward request to OpenRouter
      const options = {
        hostname: 'openrouter.ai',
        port: 443,
        path: req.url || '/api/v1/messages', // Claude posts to whatever endpoint
        method: 'POST',
        headers: {
          ...req.headers,
          'host': 'openrouter.ai',
          'content-length': Buffer.byteLength(requestBodyStr),
          // Ensure we append the correct auth and headers OpenRouter expects
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/iMayuuR/coderouter', 
          'X-Title': 'CodeRouter'
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        // Stream the response back to Claude Code
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
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
  console.log(`\n======================================================`);
  console.log(`🚀 CodeRouter Smart Proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`💬 Default Text Model:  ${defaultModel}`);
  console.log(`👁️  Vision Model Fallback: ${fallbackVisionModel}`);
  console.log(`======================================================\n`);
  console.log(`⏳ Initializing Smart Model Picker...`);
});
