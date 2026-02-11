# Dashboard Chat with Claude API

The VibeSwitch dashboard chat now supports both **OpenAI** and **Claude (Anthropic)** as LLM providers.

## Quick Start

### Using Claude API

1. **Get your API key** from [Anthropic Console](https://console.anthropic.com/)

2. **Configure in VS Code Settings:**
   - Open Settings (Cmd/Ctrl + ,)
   - Search for "VibeSwitch Dashboard Chat"
   - Set `vibeswitch.dashboardChat.provider` to `claude`
   - Set `vibeswitch.dashboardChat.claude.apiKey` to your Anthropic API key
   - (Optional) Set `vibeswitch.dashboardChat.claude.model` (default: `claude-3-5-sonnet-20241022`)

3. **Open the dashboard** and start chatting!

### Using OpenAI API

1. **Get your API key** from [OpenAI Platform](https://platform.openai.com/)

2. **Configure in VS Code Settings:**
   - Open Settings (Cmd/Ctrl + ,)
   - Search for "VibeSwitch Dashboard Chat"
   - Set `vibeswitch.dashboardChat.provider` to `openai` (default)
   - Set `vibeswitch.dashboardChat.openai.apiKey` to your OpenAI API key
   - (Optional) Set `vibeswitch.dashboardChat.openai.model` (default: `gpt-4o-mini`)

## Configuration Options

### Provider Selection

```json
{
  "vibeswitch.dashboardChat.provider": "claude"  // or "openai"
}
```

### Claude Settings

```json
{
  "vibeswitch.dashboardChat.claude.apiKey": "sk-ant-api03-...",
  "vibeswitch.dashboardChat.claude.model": "claude-3-5-sonnet-20241022"
}
```

**Available Claude models:**
- `claude-3-5-sonnet-20241022` (default, recommended for most use cases)
- `claude-3-opus-20240229` (most capable, higher cost)
- `claude-3-sonnet-20240229` (balanced)
- `claude-3-haiku-20240307` (fast and cost-effective)

### OpenAI Settings

```json
{
  "vibeswitch.dashboardChat.openai.apiKey": "sk-...",
  "vibeswitch.dashboardChat.openai.model": "gpt-4o-mini"
}
```

**Note:** If `dashboardChat.openai.apiKey` is empty, the extension will fall back to `llm.openai.apiKey`.

### Shared Settings

```json
{
  "vibeswitch.dashboardChat.enabled": true,
  "vibeswitch.dashboardChat.useWorkspaceContext": true,
  "vibeswitch.dashboardChat.includeKeyFiles": true,
  "vibeswitch.dashboardChat.timeoutMs": 15000
}
```

## Architecture

### Adapter Pattern

Both providers implement the same interface:

```javascript
interface LLMAdapter {
  chat(systemContent: string, userContent: string): Promise<string | null>
}
```

This allows seamless switching between providers without changing the core chat service logic.

### Files

- **Service:** `business_modules/dashboard-chat/app/DashboardChatService.js`
- **OpenAI Adapter:** `business_modules/dashboard-chat/infrastructure/adapters/OpenAILLMAdapter.js`
- **Claude Adapter:** `business_modules/dashboard-chat/infrastructure/adapters/ClaudeLLMAdapter.js`

## API Comparison

| Feature | OpenAI | Claude |
|---------|--------|--------|
| Endpoint | `/v1/chat/completions` | `/v1/messages` |
| Auth Header | `Authorization: Bearer <key>` | `x-api-key: <key>` |
| System Message | In messages array | Separate `system` field |
| Default Model | `gpt-4o-mini` | `claude-3-5-sonnet-20241022` |
| Max Tokens | 1024 | 1024 |
| Temperature | 0.3 | 0.3 |

## Troubleshooting

### "No API key set" error

Make sure you've set the API key for your selected provider:
- For Claude: `vibeswitch.dashboardChat.claude.apiKey`
- For OpenAI: `vibeswitch.dashboardChat.openai.apiKey`

### Rate limits

If you hit rate limits, consider:
- Increasing `vibeswitch.dashboardChat.timeoutMs`
- Using a different model tier
- Checking your API plan limits

### API errors

Check the VS Code developer console (Help > Toggle Developer Tools) for detailed error messages.

## Benefits of Claude API

1. **Code Understanding:** Claude excels at understanding and explaining code
2. **Context Window:** Large context windows for complex codebases
3. **Safety:** Built-in safety features and content filtering
4. **Pricing:** Competitive pricing, especially for Haiku models

## Privacy

Both OpenAI and Claude API calls:
- Are sent directly from your VS Code instance
- Include only the context you've configured
- Can be disabled by setting `vibeswitch.dashboardChat.enabled` to `false`
- Workspace context can be disabled with `vibeswitch.dashboardChat.useWorkspaceContext`
