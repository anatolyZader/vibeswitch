# Dashboard Chat: Claude API & Codebase Awareness

The VibeSwitch dashboard chat supports OpenAI and Claude (Anthropic). Claude provides enhanced codebase awareness and can create insight files.

## Configuration

```json
{
  "vibeswitch.dashboardChat.provider": "auto",
  "vibeswitch.dashboardChat.openai.apiKey": "sk-...",
  "vibeswitch.dashboardChat.claude.apiKey": "sk-ant-..."
}
```

- **provider**: `"auto"` (default), `"openai"`, or `"claude"`
- **auto**: Analyzes prompt complexity and selects the best provider
- Get Claude API key from [console.anthropic.com](https://console.anthropic.com)

## Enhanced Codebase Awareness (Claude)

When using Claude, the system includes:

- **Project structure** – Directory tree (up to 500 files)
- **Git status** – Branch, modified, staged files
- **Project metadata** – package.json (name, version, dependencies, scripts)
- **Open files** – Up to 20 files, 4K chars each
- **Key files** – Up to 50 source files (configs, README, business_modules, src)
- **Context limit** – 150K characters total

## Insights Creation

Claude can create markdown files in `business_modules/dashboard-chat/insights/` when you ask to save a review, report, or assessment. Example prompts:

- "Review the architecture and save your findings"
- "Create a technical debt assessment report"
- "Document this analysis for the team"

Files are created with timestamped names (e.g. `architecture-review_2026-02-11_14-30-45.md`).

## Security

- **Read-only**: Chat cannot edit source code or run commands
- **Insights only**: Single write capability restricted to the insights directory
- **Technical enforcement**: Tool whitelist and validation (not prompt-only)
