# Quick Start: Claude with Dashboard Chat

Get started with Claude's codebase-aware dashboard chat in under 5 minutes.

## Step 1: Get Your Claude API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

## Step 2: Configure VibeSwitch

Open VS Code Settings (Cmd/Ctrl + ,) and search for "VibeSwitch Dashboard Chat":

### Required Settings:

```json
{
  "vibeswitch.dashboardChat.provider": "claude",
  "vibeswitch.dashboardChat.claude.apiKey": "sk-ant-api03-YOUR-KEY-HERE"
}
```

### Optional Settings (Recommended Defaults):

```json
{
  "vibeswitch.dashboardChat.claude.model": "claude-3-5-sonnet-20241022",
  "vibeswitch.dashboardChat.enhancedCodebaseAwareness": true,
  "vibeswitch.dashboardChat.useWorkspaceContext": true,
  "vibeswitch.dashboardChat.includeKeyFiles": true,
  "vibeswitch.dashboardChat.timeoutMs": 15000
}
```

## Step 3: Open the Dashboard

1. Open Command Palette (Cmd/Ctrl + Shift + P)
2. Type "VibeSwitch: Open VibeSwitch Dashboard"
3. Press Enter

The dashboard will open in a new editor tab.

## Step 4: Start Chatting

In the chat section at the bottom of the dashboard, try these questions:

### Basic Questions:
- "What is my current risk score and what does it mean?"
- "Why do I have high blind acceptance?"
- "What antipatterns are present?"

### Codebase-Aware Questions (Enhanced Mode):
- "What is the architecture of this project?"
- "Which files are contributing to my debt score?"
- "Explain how the awareness engine works"
- "What recent changes might have affected my metrics?"
- "Show me which modules depend on the LLM system"

## What Claude Can See (Enhanced Mode)

With enhanced codebase awareness enabled, Claude has access to:

✅ **Complete project structure** (directory tree with up to 500 files)  
✅ **Git status** (current branch, modified files, staged changes)  
✅ **Project metadata** (package.json, dependencies, scripts)  
✅ **Open files** (up to 20 files you're currently working on)  
✅ **Key source files** (up to 50 important files from your codebase)  
✅ **Dashboard metrics** (awareness scores, antipatterns, events)  

**Total context:** Up to 150,000 characters (~37K tokens)

## Example Conversation

**You:** "What is the architecture of this project?"

**Claude:** "Based on the project structure and code, this is a VS Code extension called VibeSwitch organized in a domain-driven design pattern:

**Core Modules** (in `business_modules/`):
- `awareness/` - Tracks AI suggestions and calculates risk scores
- `dashboard-chat/` - Read-only chat interface (where I operate)
- `llm/` - LLM service abstraction for OpenAI/Claude
- `agents/` - Multi-agent architecture support
- `mode/` - Mode switching (VIBE vs DEV)
- `mode-enforcement/` - Capability restrictions

**UI Layer**:
- `ui/` - Status bar, dashboard display components
- `dashboard-app/` - React-based dashboard web view

The awareness module appears to be the heart of the system, monitoring file changes and computing risk metrics based on review behavior patterns."

---

**You:** "Why is my debt score high?"

**Claude:** "Your debt score is 45/100, which comes from two main sources:

**Unopened Files (3 files):**
- `business_modules/dashboard-chat/infrastructure/adapters/ClaudeLLMAdapter.js`
- `tests/business_modules/dashboard-chat/adapters.test.js`
- `docs/DASHBOARD-CHAT-CLAUDE-API.md`

These files were recently created or modified but haven't been opened for review yet.

**Unreviewed Suggestions:**
Looking at your recent events, you accepted 2 AI suggestions without navigating to or testing the affected code. The awareness system flags this as 'blind acceptance' which contributes to debt.

**Recommendation:** Open and review the files listed above, especially the new Claude adapter implementation, to reduce your debt score."

## Features of Enhanced Mode

### 1. Code-Level Understanding
Claude can see your actual code and explain:
- How functions work
- Module dependencies
- Design patterns used
- Potential issues or improvements

### 2. Architecture Analysis
Claude can map your project structure and explain:
- Overall architecture
- Module relationships
- Where different features live
- How components interact

### 3. Metric Correlation
Claude can correlate dashboard metrics with actual code:
- Why scores are high/low
- Which files contribute to antipatterns
- How recent changes affected metrics
- What to focus on for improvement

### 4. Git-Aware Responses
Claude sees your git status and can:
- Identify recently modified files
- Correlate changes with metric changes
- Suggest which changes to review first
- Understand your current work context

## Privacy & Security

### What's Sent to Anthropic:
- Project structure (file/folder names)
- Contents of open and key source files (up to 150K chars)
- Dashboard metrics and events
- Your questions

### What's NOT Sent:
- node_modules contents
- Build artifacts
- .git directory contents
- Environment variables
- Secrets or API keys
- Binary files

### To Reduce Context (More Private):

```json
{
  // Only send dashboard metrics, no code
  "vibeswitch.dashboardChat.useWorkspaceContext": false
}
```

or

```json
{
  // Send only open files, not key files
  "vibeswitch.dashboardChat.includeKeyFiles": false
}
```

or

```json
{
  // Use standard mode (16K context instead of 150K)
  "vibeswitch.dashboardChat.enhancedCodebaseAwareness": false
}
```

## Cost Estimates

With Claude 3.5 Sonnet and enhanced mode:

- **Input:** ~37K tokens per query (~$0.011)
- **Output:** ~500-1000 tokens per response (~$0.007-0.015)
- **Total per query:** ~$0.018-0.026

**For perspective:**
- 100 queries = ~$1.80-2.60
- Daily use (10 queries) = ~$0.18-0.26
- Monthly (200 queries) = ~$3.60-5.20

Standard mode uses ~75% less input tokens, reducing costs to ~$0.005-0.010 per query.

## Troubleshooting

### "No API key set"
Make sure you've set `vibeswitch.dashboardChat.claude.apiKey` in your settings.

### "Request failed" or timeout
- Increase timeout: `"vibeswitch.dashboardChat.timeoutMs": 30000`
- Check your API key is valid
- Verify you have API credits

### Claude doesn't see my code
- Ensure `useWorkspaceContext` is `true`
- Open some source files in the editor
- Enable `includeKeyFiles`

### Responses are too generic
- Make sure `enhancedCodebaseAwareness` is `true`
- Ask more specific questions referencing files or modules
- Open the relevant files in your editor first

## Next Steps

1. ✅ Configure Claude API
2. ✅ Open dashboard
3. ✅ Ask questions about your code
4. 📖 Read [Full Documentation](./DASHBOARD-CHAT-CLAUDE-API.md)
5. 📖 Learn about [Codebase Awareness](./DASHBOARD-CHAT-CODEBASE-AWARENESS.md)

## Support

- **Documentation:** See `/docs` folder
- **Issues:** GitHub Issues
- **Settings:** Search "VibeSwitch" in VS Code Settings

Enjoy your codebase-aware AI assistant! 🚀
