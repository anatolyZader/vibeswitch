# Dashboard Chat Codebase Awareness

This document explains how the VibeSwitch dashboard chat maintains codebase awareness and how it differs between providers.

## Overview

The dashboard chat is a **read-only agent** that can answer questions about your:
- VibeSwitch awareness metrics and antipatterns
- Codebase structure and organization
- Recent changes and git status
- Project dependencies and configuration
- Specific files and code patterns

## Standard Mode (OpenAI & Default)

**Context Limit:** 16,000 characters (~4K tokens)

**Includes:**
- Open files (up to 8 files, 2K chars each)
- Key files: package.json, README, main source files (up to 25 files)
- Dashboard metrics and events
- File paths contributing to debt/risk

**Best For:**
- Quick questions about metrics
- Understanding antipatterns
- General codebase questions with limited context

## Enhanced Mode (Claude)

**Context Limit:** 150,000 characters (~37K tokens)

**Includes Everything from Standard Mode Plus:**

### 1. Project Structure Tree
```
├─ business_modules/
│  ├─ agents/
│  ├─ awareness/
│  ├─ dashboard-chat/
│  └─ llm/
├─ dashboard-app/
│  ├─ src/
│  └─ __tests__/
├─ docs/
└─ tests/
```

Shows the complete directory hierarchy (up to 500 files), giving Claude a mental map of your project.

### 2. Git Status & Recent Changes

```
[Git Status]
Branch: cursor/claude-api-dashboard-chat-6b09
Modified files (3):
  M business_modules/dashboard-chat/app/DashboardChatService.js
  M package.json
  A business_modules/dashboard-chat/infrastructure/adapters/ClaudeLLMAdapter.js
```

Claude sees what you're currently working on and recent modifications.

### 3. Project Metadata

```
[Project Metadata]
Name: vibeswitch
Version: 1.0.1
Description: Stop working on autopilot with AI...
Dependencies (2): @modelcontextprotocol/sdk, chokidar
DevDependencies (8): @types/vscode, jest, mocha, ...
Scripts: build, test, test:mvp, package, ...
```

Understanding of your project's dependencies and available commands.

### 4. Extended File Coverage

- **Open files:** Up to 20 (vs 8 in standard)
- **Key files:** Up to 50 (vs 25 in standard)
- **Per-file limit:** 4K chars (vs 2K in standard)

More code = better understanding of implementations.

### 5. Intelligent File Prioritization

Files are selected and prioritized based on:
1. **Configuration files** (package.json, *.config.js, etc.)
2. **Documentation** (README files)
3. **Currently open files** (what you're working on)
4. **Main source files** (*.js, *.ts, *.jsx, *.tsx)

## Context Building Process

```
┌─────────────────────────────────────────────────────┐
│  User Message                                       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  DashboardChatService.reply()                       │
│  - Check provider (OpenAI or Claude)                │
│  - Get configuration settings                       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Context Building                                   │
│  ┌──────────────────┐  ┌──────────────────────────┐│
│  │ Standard Mode    │  │ Enhanced Mode (Claude)   ││
│  │ 16K chars        │  │ 150K chars               ││
│  │ getReadOnly      │  │ getEnhancedReadOnly      ││
│  │ Context()        │  │ Context()                ││
│  └──────────────────┘  └──────────────────────────┘│
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  ContextBuilder.buildUserContent()                  │
│  - Dashboard summary (metrics, events)              │
│  - Codebase context (from above)                    │
│  - User question                                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  LLM API Call                                       │
│  - System prompt (read-only rules + glossary)       │
│  - User content (dashboard + codebase + question)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Response to User                                   │
└─────────────────────────────────────────────────────┘
```

## Example Questions & Responses

### Standard Mode Questions
- "What is my current risk score?"
- "Why do I have high blind acceptance?"
- "What are the recent antipatterns?"
- "How many tokens have I used?"

### Enhanced Mode Questions (Claude)
- "What is the overall architecture of this project?"
- "Which modules depend on the awareness system?"
- "Why might the boundary violations be high? Show me specific files."
- "I have a high debt score. Which recent changes contributed to this?"
- "Explain how the dashboard chat service works in detail."
- "What's the relationship between the awareness engine and the dashboard display?"
- "Are there any code patterns that might be causing the high context spread?"

## Configuration

### Enable Enhanced Mode (Default for Claude)

```json
{
  "vibeswitch.dashboardChat.provider": "claude",
  "vibeswitch.dashboardChat.enhancedCodebaseAwareness": true,
  "vibeswitch.dashboardChat.useWorkspaceContext": true,
  "vibeswitch.dashboardChat.includeKeyFiles": true
}
```

### Disable Context (Privacy Mode)

```json
{
  "vibeswitch.dashboardChat.useWorkspaceContext": false
}
```

In this mode, the agent only sees dashboard metrics but no code.

## Privacy Considerations

### What Gets Sent to the API?

**With Enhanced Mode (Claude):**
- Project structure (file and directory names only)
- Git branch name and modified file paths
- Contents of open files and selected key files (up to 150K chars)
- Dashboard metrics and event data

**NOT Sent:**
- node_modules contents
- Build artifacts (dist, out, build)
- .git directory contents
- Environment variables or secrets
- Binary files

### Controlling Context

1. **Disable workspace context entirely:**
   ```json
   "vibeswitch.dashboardChat.useWorkspaceContext": false
   ```

2. **Disable key files (only open files):**
   ```json
   "vibeswitch.dashboardChat.includeKeyFiles": false
   ```

3. **Use standard mode (less context):**
   ```json
   "vibeswitch.dashboardChat.enhancedCodebaseAwareness": false
   ```

## Performance

### Context Building Time

- **Standard Mode:** <500ms typically
- **Enhanced Mode:** 1-3 seconds for large projects (cached after first build)

### API Response Time

- **OpenAI (gpt-4o-mini):** 2-5 seconds
- **Claude (3.5 Sonnet):** 3-8 seconds (more context to process)

### Cost Considerations

Enhanced mode sends more context to the API, which increases:
- Input tokens (context)
- Potentially output tokens (more detailed responses)

**Estimated cost per query:**
- Standard mode: ~$0.001-0.003 per query
- Enhanced mode: ~$0.005-0.015 per query

Both modes remain very affordable for regular use.

## Troubleshooting

### "Codebase context is empty"

Possible causes:
1. No files open in the editor
2. `useWorkspaceContext` is disabled
3. All open files are excluded (binary, git, node_modules)

**Solution:** Open some source files or enable `includeKeyFiles`

### "Agent doesn't see my recent changes"

Enhanced mode reads git status, but you need to:
1. Save your files
2. Ensure git is initialized in the workspace
3. VS Code git extension must be active

### "Context is truncated"

This is normal. Limits are:
- Standard: 16K chars
- Enhanced: 150K chars

Most important files are prioritized first.

## Future Enhancements

Planned improvements:
- [ ] AST-based code analysis (function signatures, imports)
- [ ] Semantic code search integration
- [ ] Integration with VibeSwitch awareness events
- [ ] Custom context rules per project
- [ ] Multi-repository support
- [ ] Code metrics and complexity analysis
