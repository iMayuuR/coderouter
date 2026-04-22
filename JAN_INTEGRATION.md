# Jan-Style Configuration Integration

We have adopted the [janhq/jan](http://github.com/janhq/jan) configuration patterns to give CodeRouter a more premium, "standardized" feel.

## 1. Assistant Personas
Just like Jan, CodeRouter now supports individual assistant configurations in the `assistants/` directory. Each assistant follows the Jan `assistant.json` schema.

- **Main Assistant**: [assistants/coderouter/assistant.json](file:///d:/coderouter/assistants/coderouter/assistant.json)
- **Skill-based Assistant**: [assistants/code-reviewer/assistant.json](file:///d:/coderouter/assistants/code-reviewer/assistant.json)

## 2. Config Schema
Each `assistant.json` includes:
- `id`: Unique identifier
- `object`: Always "assistant"
- `name`: Display name
- `description`: Persona summary
- `instructions`: The system prompt/personality
- `avatar`: Visual representation (Emoji/URL)

## 3. Metadata Updates
The `ai-agent-config.json` has been updated with `avatar` and `assistant_id` fields to bridge the gap between simple project setup and a full assistant identity.

---
*Research conducted via janhq/jan repository analysis (Core v1.0.0).*
