/**
 * Translates Anthropic message content parts to OpenAI format.
 */
function anthropicContentToOpenAI(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content;

  return content.map((item) => {
    if (item.type === "text") return { type: "text", text: item.text };
    if (item.type === "image") {
      return {
        type: "image_url",
        image_url: {
          url: `data:${item.source.media_type};base64,${item.source.data}`
        }
      };
    }
    // Tool results (Anthropic -> OpenAI)
    if (item.type === "tool_result") {
      // In OpenAI, tool results are separate messages with role 'tool', 
      // but in Anthropic they are part of a 'user' message.
      // We handle this in the main message loop.
      return null; 
    }
    return item;
  }).filter(Boolean);
}

/**
 * Translates Anthropic request body to OpenAI-compatible request body.
 */
function translateAnthropicToOpenAI(anthropicBody, modelForProvider) {
  const messages = [];
  
  // 1. Handle System Prompt
  if (anthropicBody.system) {
    messages.push({ role: "system", content: anthropicBody.system });
  }

  // 2. Handle Messages (including Tool Use and Tool Results)
  (anthropicBody.messages || []).forEach((msg) => {
    const role = msg.role;
    const content = msg.content;

    if (Array.isArray(content)) {
      const toolCalls = [];
      const textParts = [];
      const toolResults = [];

      content.forEach(part => {
        if (part.type === "tool_use") {
          toolCalls.push({
            id: part.id,
            type: "function",
            function: {
              name: part.name,
              arguments: JSON.stringify(part.input)
            }
          });
        } else if (part.type === "tool_result") {
          toolResults.push({
            role: "tool",
            tool_call_id: part.tool_use_id,
            content: typeof part.content === "string" ? part.content : JSON.stringify(part.content)
          });
        } else if (part.type === "text") {
          textParts.push({ type: "text", text: part.text });
        } else if (part.type === "image") {
          textParts.push({
            type: "image_url",
            image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` }
          });
        }
      });

      if (toolResults.length > 0) {
        // Tool results become separate messages in OpenAI
        toolResults.forEach(tr => messages.push(tr));
      } else if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: textParts.length > 0 ? textParts : null,
          tool_calls: toolCalls
        });
      } else {
        // If only one text part, send as plain string for maximum compatibility
        if (textParts.length === 1 && textParts[0].type === "text") {
          messages.push({ role, content: textParts[0].text });
        } else {
          messages.push({ role, content: textParts });
        }
      }
    } else {
      messages.push({ role, content });
    }
  });

  // 3. Handle Tools
  const tools = (anthropicBody.tools || []).map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }
  }));

  return {
    model: modelForProvider,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    stream: Boolean(anthropicBody.stream),
    temperature: anthropicBody.temperature,
    top_p: anthropicBody.top_p,
    max_tokens: anthropicBody.max_tokens,
    stop: anthropicBody.stop_sequences
  };
}

/**
 * Translates OpenAI SSE lines to Anthropic SSE events.
 * Handles text content and tool calls.
 */
function translateOpenAIToAnthropicStream(openAiLine, messageId, model) {
  if (!openAiLine.startsWith("data: ")) return null;
  const raw = openAiLine.slice(6).trim();
  if (raw === "[DONE]") return "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const choice = parsed.choices && parsed.choices[0];
  if (!choice) return null;

  const delta = choice.delta || {};
  
  // 1. Message Start / Content Block Start
  if (delta.role) {
    return `event: message_start\ndata: {"type":"message_start","message":{"id":"${messageId}","type":"message","role":"assistant","content":[],"model":"${model}","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\nevent: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`;
  }

  // 2. Text Content Delta
  if (typeof delta.content === "string" && delta.content !== "") {
    return `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(delta.content)}}}\n\n`;
  }

  // 3. Tool Calls Delta
  if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
    const tc = delta.tool_calls[0];
    const index = tc.index + 1; // Content block 0 is text, tools are 1, 2...

    let events = "";
    
    // If it's the start of a tool call (has name)
    if (tc.function && tc.function.name) {
      events += `event: content_block_start\ndata: {"type":"content_block_start","index":${index},"content_block":{"type":"tool_use","id":"${tc.id || 'tc_' + Math.random().toString(36).slice(2, 9)}","name":"${tc.function.name}","input":{}}}\n\n`;
    }

    // If it has arguments delta
    if (tc.function && typeof tc.function.arguments === "string") {
      events += `event: content_block_delta\ndata: {"type":"content_block_delta","index":${index},"delta":{"type":"input_json_delta","partial_json":${JSON.stringify(tc.function.arguments)}}}\n\n`;
    }

    return events || null;
  }

  // 4. Message Finish
  if (choice.finish_reason) {
    let stopReason = "end_turn";
    if (choice.finish_reason === "tool_calls") stopReason = "tool_use";
    
    return `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${stopReason}","stop_sequence":null},"usage":{"output_tokens":${parsed.usage?.completion_tokens || 0}}}\n\n`;
  }

  return null;
}

module.exports = {
  translateAnthropicToOpenAI,
  translateOpenAIToAnthropicStream
};
