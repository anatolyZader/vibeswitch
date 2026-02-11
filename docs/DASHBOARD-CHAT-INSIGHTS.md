# Dashboard Chat: Insights Creation

The dashboard chat is **almost read-only** with one powerful exception: it can create markdown insight/review files in a designated `insights/` directory.

## Overview

While the dashboard chat cannot edit your code, run commands, or modify git, it **CAN** save comprehensive analysis to markdown files. This is perfect for:

- Architecture reviews
- Code quality assessments
- Technical debt analysis
- Metric correlation findings
- Best practice recommendations
- Detailed code audits

## How It Works

### 1. **Claude-Only Feature**

Insights creation is currently **only available with Claude** provider (uses tool/function calling).

OpenAI support may be added in the future.

### 2. **Safe, Restricted Writing**

The chat agent can ONLY write to:
```
business_modules/dashboard-chat/insights/
```

**Safety features:**
- ✅ Cannot write outside insights directory
- ✅ Cannot overwrite existing files
- ✅ Filename validation (alphanumeric, dash, underscore only)
- ✅ Content size limit (500KB max)
- ✅ Malicious content detection (blocks scripts, javascript:, etc.)
- ✅ Atomic writes (temp file → rename, never partial writes)

### 3. **When Claude Creates Insights**

Claude will offer to create an insight when:
- ✅ You explicitly ask: "save this", "create a file", "document this"
- ✅ You request a "review", "report", or "assessment"
- ✅ Claude completes a comprehensive analysis worth preserving
- ❌ For simple Q&A exchanges (too trivial)
- ❌ For quick metric lookups (not substantial enough)

### 4. **Automatic Naming**

Files are automatically timestamped:
```
insight_2026-02-11_14-30-45.md
review_2026-02-11_15-22-10.md
architecture-analysis_2026-02-11_16-05-33.md
```

You can also specify a custom filename.

## Usage Examples

### Example 1: Architecture Review

**You:**
> "Can you do a comprehensive architecture review of this project and save it?"

**Claude:**
> "I'll analyze the architecture and create a detailed review for you.
>
> [Comprehensive analysis here...]
>
> ✅ **Insight Created Successfully**
>
> I've saved the analysis to:
> `business_modules/dashboard-chat/insights/architecture-review_2026-02-11_14-30-45.md`
>
> You can find it in your workspace under the dashboard-chat insights directory."

---

### Example 2: Technical Debt Assessment

**You:**
> "My debt score is 65/100. Can you analyze why and create a report?"

**Claude:**
> "Let me analyze your technical debt...
>
> [Analysis of files, patterns, metrics...]
>
> Would you like me to save this analysis as an insight file?"

**You:**
> "Yes, please"

**Claude:**
> "✅ **Insight Created Successfully**
>
> I've saved the technical debt analysis to:
> `business_modules/dashboard-chat/insights/technical-debt-analysis_2026-02-11_15-10-22.md`"

---

### Example 3: Code Quality Findings

**You:**
> "Review the code quality across all open files and document your findings"

**Claude:**
> "[Detailed code quality analysis...]
>
> ✅ **Insight Created Successfully**
>
> I've saved the code quality review to:
> `business_modules/dashboard-chat/insights/code-quality-review_2026-02-11_16-45-10.md`"

## What Gets Saved

### File Structure

Insights are saved as markdown with YAML frontmatter:

```markdown
---
title: Architecture Review
created: 2026-02-11T14:30:45.123Z
provider: claude
autoSelected: true
createdBy: dashboard-chat
---

# Architecture Review

## Overview

[Content here...]

## Key Findings

1. **Module Organization**: The project uses...
2. **Design Patterns**: Several patterns are employed...

## Recommendations

- Consider refactoring...
- Improve separation of concerns...

## File References

- `business_modules/awareness/app/awarenessEngine.js` - Core scoring logic
- `business_modules/dashboard-chat/app/DashboardChatService.js` - Chat orchestration
```

### Content Characteristics

Claude writes comprehensive, well-structured insights with:

- ✅ **Clear headers and sections**
- ✅ **Specific file references** (with paths)
- ✅ **Code examples** where relevant
- ✅ **Actionable recommendations**
- ✅ **Bullet lists and numbered lists**
- ✅ **Professional, technical tone**
- ✅ **Markdown formatting** (bold, italic, code blocks)

## Configuration

### Enable Insights (Default)

Insights creation is enabled by default when using Claude:

```json
{
  "vibeswitch.dashboardChat.provider": "claude",
  "vibeswitch.dashboardChat.claude.apiKey": "sk-ant-..."
}
```

or with auto mode:

```json
{
  "vibeswitch.dashboardChat.provider": "auto",
  "vibeswitch.dashboardChat.claude.apiKey": "sk-ant-...",
  "vibeswitch.dashboardChat.openai.apiKey": "sk-..."
}
```

### Disable Insights

There's currently no setting to disable insights creation. If you don't want Claude to create files:
- Use OpenAI provider instead
- Simply don't ask for reviews/reports
- Claude won't create files without your request or permission

## Accessing Your Insights

### In VS Code

1. Open the Explorer sidebar
2. Navigate to: `business_modules/dashboard-chat/insights/`
3. Click on any `.md` file to view
4. Files are sorted by creation date (newest first)

### Via File System

Insights are stored at:
```
<workspace-root>/business_modules/dashboard-chat/insights/
```

### In Git

The insights directory is tracked by git:
- `.gitkeep` ensures the directory exists
- Insight files are committed like any other markdown file
- You can commit/push them to share with your team

## Use Cases

### 1. **Onboarding Documentation**

When you start on a new codebase:
```
You: "Explain the architecture and save it for the team"
→ Creates architecture-overview.md for new developers
```

### 2. **Code Review Records**

Document your findings:
```
You: "Review these changes and document concerns"
→ Creates code-review-YYYY-MM-DD.md with specific issues
```

### 3. **Technical Debt Tracking**

Regular assessments:
```
You: "Analyze technical debt and create a monthly report"
→ Creates debt-report-february-2026.md
```

### 4. **Metric Correlation Analysis**

Understand why metrics changed:
```
You: "My awareness score dropped from 30 to 65. Investigate and document"
→ Creates metric-analysis-YYYY-MM-DD.md explaining correlations
```

### 5. **Best Practices Checklist**

Generate actionable lists:
```
You: "Create a code quality checklist based on current antipatterns"
→ Creates quality-checklist.md with specific improvements
```

### 6. **Audit Trail**

Keep records of AI assistance:
```
→ All insights automatically timestamped and attributed
→ Frontmatter includes provider, auto-selection status
→ Creates audit trail of AI-assisted analysis
```

## Limitations

### Current Limitations

1. **Claude Only**: OpenAI doesn't support this yet (function calling not implemented)
2. **No Editing**: Cannot modify existing insights (create new ones instead)
3. **No Deletion**: Cannot delete insights via chat (delete manually)
4. **Single Directory**: All insights go to one location
5. **No Subdirectories**: Cannot organize insights into folders
6. **500KB Limit**: Large analyses may be truncated

### Security Limitations

1. **No Path Traversal**: Cannot write outside insights directory
2. **No Overwrites**: Cannot replace existing files
3. **Filename Restrictions**: Alphanumeric, dash, underscore, .md only
4. **Content Validation**: Blocks potentially malicious content

## Best Practices

### When to Create Insights

**✅ DO create insights for:**
- Comprehensive analysis that took significant time
- Findings you want to reference later
- Reports to share with your team
- Documentation of complex issues
- Regular assessment records (monthly reviews)

**❌ DON'T create insights for:**
- Simple question/answer exchanges
- Quick metric lookups
- Temporary conversations
- Information easily found elsewhere
- Trivial findings

### How to Ask

**Explicit requests work best:**
- "Review X and save your findings"
- "Create a report on Y"
- "Document this analysis"
- "Save this as an insight"

**Claude will also offer:**
- After completing substantial analysis
- When findings are significant
- If you ask "why" questions that lead to deep investigation

### Organizing Insights

**Naming conventions:**
```
architecture-review_2026-02-11.md
debt-assessment_february-2026.md
code-quality-sprint-23.md
security-audit_2026-Q1.md
```

**Manual organization:**
- Create subdirectories if needed (manually)
- Use consistent prefixes
- Date-based naming for series
- Tag in frontmatter metadata

## Technical Details

### Tool Definition

Claude sees this tool description:

```json
{
  "name": "create_insight",
  "description": "Creates a markdown insight/review file in the insights directory...",
  "input_schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Title for the insight document"
      },
      "content": {
        "type": "string",
        "description": "Markdown content for the insight"
      },
      "filename": {
        "type": "string",
        "description": "Optional custom filename"
      }
    },
    "required": ["title", "content"]
  }
}
```

### Implementation

1. **Request**: You ask for a review/report
2. **Analysis**: Claude analyzes using its full codebase context
3. **Tool Use**: Claude decides to use `create_insight` tool
4. **Validation**: `InsightsWriter` validates filename and content
5. **Write**: Atomic write (temp → rename) to insights directory
6. **Confirmation**: User sees success message with file path

### Safety Mechanisms

```javascript
// Path resolution prevents traversal
const insightsDir = path.join(extensionPath, 'business_modules', 'dashboard-chat', 'insights');

// Filename validation
/^[a-zA-Z0-9_-]+\.md$/.test(filename)

// Content validation
if (content.includes('<script>') || content.includes('javascript:')) {
  return { error: 'unsafe content' };
}

// Size limits
if (content.length > 500000) {
  return { error: 'too large' };
}

// No overwrites
if (fs.existsSync(fullPath)) {
  return { error: 'already exists' };
}
```

## Troubleshooting

### "Failed to create insight"

**Possible causes:**
- File already exists with that name
- Invalid filename (use only alphanumeric, dash, underscore)
- Content too large (>500KB)
- Disk space issues

**Solutions:**
- Use auto-generated filename (don't specify custom name)
- Reduce content size
- Check disk space

### "Tool not available"

**Cause:** Using OpenAI provider

**Solution:** Switch to Claude or auto mode with Claude API key:
```json
{
  "vibeswitch.dashboardChat.provider": "claude"
}
```

### Insights directory missing

**Cause:** First-time use, directory not created yet

**Solution:** Directory is auto-created on first insight. If it doesn't exist, create manually:
```bash
mkdir -p business_modules/dashboard-chat/insights
```

### Claude doesn't offer to save

**Possible reasons:**
- Analysis too simple/trivial
- You didn't ask explicitly
- Claude didn't think it was substantial enough

**Solutions:**
- Ask explicitly: "save this analysis"
- Complete more comprehensive questions
- Ask for a "report" or "review" specifically

## Future Enhancements

Potential future features:

- [ ] OpenAI function calling support
- [ ] Custom subdirectory organization
- [ ] Insight templates
- [ ] Automatic insight suggestions
- [ ] Insight search/indexing
- [ ] Export formats (PDF, HTML)
- [ ] Collaborative insights (team annotations)
- [ ] Insight history/versioning
- [ ] Custom metadata fields
- [ ] Insight scheduling (weekly reports)

## Summary

**Insights creation gives you:**
- ✅ Persistent documentation of AI analysis
- ✅ Audit trail of code reviews
- ✅ Shareable reports for your team
- ✅ Safe, restricted file writing
- ✅ Professional, well-structured markdown
- ✅ Zero risk to your codebase

**While keeping safety:**
- ✅ Cannot edit existing code
- ✅ Cannot run commands
- ✅ Cannot access files outside insights directory
- ✅ All writes validated and restricted

**Perfect for:**
- Regular code quality assessments
- Architecture documentation
- Technical debt tracking
- Team knowledge sharing
- Onboarding documentation

Just ask Claude to "create a review" or "document this analysis" and it will save comprehensive, professional insights to your workspace!
