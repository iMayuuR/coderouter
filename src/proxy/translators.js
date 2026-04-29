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
    return item;
  }).filter(Boolean);
}

/**
 * Translates Anthropic request body to OpenAI-compatible request body.
 */
function translateAnthropicToOpenAI(anthropicBody, modelForProvider) {
  const messages = [];
  
  if (anthropicBody.system) {
    messages.push({ role: "system", content: anthropicBody.system });
  }

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

      if (textParts.length > 0) {
        if (textParts.length === 1 && textParts[0].type === "text") {
          messages.push({ role, content: textParts[0].text });
        } else {
          messages.push({ role, content: textParts });
        }
      }

      if (toolResults.length > 0) {
        toolResults.forEach(tr => messages.push(tr));
      } else if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: null, 
          tool_calls: toolCalls
        });
      }
    } else {
      messages.push({ role, content });
    }
  });

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
 * @param {string} openAiLine - Raw SSE line from OpenAI.
 * @param {string} messageId - ID to use for the message.
 * @param {string} model - Model name to report.
 * @param {Object} state - Persistent state for the current stream.
 */
function translateOpenAIToAnthropicStream(openAiLine, messageId, model, state = {}) {
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
  
  // 1. Initialize state for this stream
  if (!state.toolCalls) state.toolCalls = {}; // index -> { id, name, started }
  if (!state.textStarted) state.textStarted = false;

  let events = "";

  // 2. Role / Message Start
  if (delta.role && !state.messageStarted) {
    state.messageStarted = true;
    events += `event: message_start\ndata: {"type":"message_start","message":{"id":"${messageId}","type":"message","role":"assistant","content":[],"model":"${model}","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n`;
  }

  // 3. Text Content Delta
  if (typeof delta.content === "string") {
    if (!state.textStarted) {
      events += `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`;
      state.textStarted = true;
    }
    events += `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(delta.content)}}}\n\n`;
  }

  // 4. Tool Calls Delta
  if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
    delta.tool_calls.forEach(tc => {
      const idx = tc.index;
      const blockIdx = idx + 1; // Content block 0 is text, tools follow

      if (!state.toolCalls[idx]) {
        state.toolCalls[idx] = { 
          id: tc.id || `tc_${Math.random().toString(36).slice(2, 9)}`,
          name: tc.function?.name || "",
          started: false 
        };
      }

      const call = state.toolCalls[idx];
      
      // Update name if it arrives in a later chunk (unlikely but possible)
      if (tc.function?.name) call.name = tc.function.name;

      // Start the tool block if we have a name and haven't started yet
      if (call.name && !call.started) {
        events += `event: content_block_start\ndata: {"type":"content_block_start","index":${blockIdx},"content_block":{"type":"tool_use","id":"${call.id}","name":"${call.name}","input":{}}}\n\n`;
        call.started = true;
      }

      // Pass arguments delta
      if (tc.function?.arguments) {
        events += `event: content_block_delta\ndata: {"type":"content_block_delta","index":${blockIdx},"delta":{"type":"input_json_delta","partial_json":${JSON.stringify(tc.function.arguments)}}}\n\n`;
      }
    });
  }

  // 5. Message Finish
  if (choice.finish_reason) {
    // Stop all active blocks
    if (state.textStarted) {
      events += `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`;
    }
    Object.keys(state.toolCalls).forEach(idx => {
      if (state.toolCalls[idx].started) {
        events += `event: content_block_stop\ndata: {"type":"content_block_stop","index":${Number(idx) + 1}}\n\n`;
      }
    });

    const stopReason = choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn";
    events += `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${stopReason}","stop_sequence":null},"usage":{"output_tokens":${parsed.usage?.completion_tokens || 0}}}\n\n`;
  }

  return events || null;
}

module.exports = {
  translateAnthropicToOpenAI,
  translateOpenAIToAnthropicStream
};
