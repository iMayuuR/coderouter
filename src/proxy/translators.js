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
  });
}

function translateAnthropicToOpenAI(anthropicBody, modelForProvider) {
  const messages = [];
  if (anthropicBody.system) {
    messages.push({ role: "system", content: anthropicBody.system });
  }

  (anthropicBody.messages || []).forEach((msg) => {
    messages.push({
      role: msg.role,
      content: anthropicContentToOpenAI(msg.content)
    });
  });

  return {
    model: modelForProvider,
    messages,
    stream: Boolean(anthropicBody.stream),
    temperature: anthropicBody.temperature,
    top_p: anthropicBody.top_p,
    max_tokens: anthropicBody.max_tokens,
    stop: anthropicBody.stop_sequences
  };
}

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

  if (choice.finish_reason) {
    return `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":${parsed.usage?.completion_tokens || 0}}}\n\n`;
  }

  if (choice.delta && choice.delta.role) {
    return `event: message_start\ndata: {"type":"message_start","message":{"id":"${messageId}","type":"message","role":"assistant","content":[],"model":"${model}","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\nevent: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`;
  }

  if (choice.delta && typeof choice.delta.content === "string") {
    return `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(choice.delta.content)}}}\n\n`;
  }

  return null;
}

module.exports = {
  translateAnthropicToOpenAI,
  translateOpenAIToAnthropicStream
};
