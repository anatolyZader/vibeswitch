# LLM Dashboard Chat + CI Agents Integration Plan

**Date:** 2026-02-10  
**Purpose:** Expand VibeSwitch with enhanced LLM dashboard chat and Google Cloud Run agents integrated into CI pipelines.

---

## Executive Summary

VibeSwitch **already has both foundations implemented**:

| Feature | Current Status | What Needs Enhancement |
|---------|----------------|------------------------|
| **Dashboard LLM Chat** | ✅ Implemented | Add metric-specific context, streaming responses, conversation history |
| **Cloud Run Agents** | ✅ Architecture done | Add CI integration, webhook endpoints, GitHub Actions integration |

**Implementation effort:** 2-3 weeks for enhancements (both features already 70% complete)

---

## Part 1: Enhanced Dashboard LLM Chat

### Current Implementation

**What's already there:**

```
business_modules/dashboard-chat/
├── app/
│   ├── ContextBuilder.js          ✅ Builds system prompt + user content
│   └── DashboardChatService.js    ✅ Orchestrates LLM calls
├── infrastructure/adapters/
│   ├── OpenAILLMAdapter.js        ✅ OpenAI API integration
│   └── WorkspaceContextAdapter.js ✅ Reads workspace files
└── domain/contracts.js

dashboard-app/src/
├── App.jsx                         ✅ Renders ChatSection
└── ChatSection.jsx                 ✅ Chat UI component
```

**Current capabilities:**
- ✅ OpenAI integration (gpt-4o-mini default)
- ✅ Dashboard data context (scores, antipatterns, token usage)
- ✅ Optional workspace context (key files)
- ✅ React chat UI in dashboard webview
- ✅ Configuration via VS Code settings

### Enhancement 1: Metric-Specific Explanations

**Goal:** Make the LLM an expert on VibeSwitch's eval mechanisms and research backing.

**Implementation:**

```javascript
// business_modules/dashboard-chat/app/MetricExplainerService.js

class MetricExplainerService {
  constructor({ contextBuilder, researchDocsReader }) {
    this.contextBuilder = contextBuilder;
    this.researchDocs = researchDocsReader;
  }

  /**
   * Build enhanced context for specific metric questions
   * @param {string} userMessage - User's question
   * @param {Object} payload - Current dashboard data
   * @returns {Object} Enhanced context with relevant research + formulas
   */
  buildMetricContext(userMessage, payload) {
    const mentionedMetrics = this._detectMentionedMetrics(userMessage);
    
    const context = {
      dashboardData: payload,
      activeMetrics: mentionedMetrics,
      relevantResearch: [],
      formulas: [],
      examples: []
    };

    // Add specific metric context
    mentionedMetrics.forEach(metric => {
      switch (metric) {
        case 'churn':
          context.relevantResearch.push(this._getChurnResearch());
          context.formulas.push(this._getChurnFormula());
          context.examples.push(this._getChurnExample(payload));
          break;
        
        case 'flooding':
        case 'response_drill':
          context.relevantResearch.push(this._getInteractionQualityResearch());
          context.formulas.push(this._getFloodingFormula());
          context.examples.push(this._getFloodingExample(payload));
          break;
        
        case 'blind_acceptance':
        case 'ownership':
          context.relevantResearch.push(this._getOwnershipResearch());
          context.formulas.push(this._getBlindAcceptanceFormula());
          context.examples.push(this._getOwnershipExample(payload));
          break;
        
        // ... other metrics
      }
    });

    return context;
  }

  _detectMentionedMetrics(message) {
    const metricKeywords = {
      'churn': ['churn', 'deleted', 'rewritten', 'unstable'],
      'flooding': ['flooding', 'too many', 'batches', 'prompts'],
      'response_drill': ['response drill', 'accepting', 'rubber stamp'],
      'blind_acceptance': ['blind accept', 'review', 'scrutiny'],
      'ownership': ['ownership', 'engagement'],
      'drift': ['drift', 'debt', 'unreviewed'],
      'verification': ['verification', 'test', 'validate']
    };

    const mentioned = new Set();
    const lowerMessage = message.toLowerCase();

    for (const [metric, keywords] of Object.entries(metricKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        mentioned.add(metric);
      }
    }

    return Array.from(mentioned);
  }

  _getChurnResearch() {
    return {
      title: 'Churn Spike Risk',
      source: 'GitClear AI Code Quality Research v2025.2.5',
      summary: 'Churn = code revised/reverted within 2 weeks. Correlates with unstable design.',
      citation: '211M lines analyzed (2020-2024); churn rose in 2024',
      dora: 'Google DORA 2024: ~7.2% delivery stability decrease per 25% AI adoption increase'
    };
  }

  _getChurnFormula() {
    return {
      metric: 'Churn Rate',
      formula: 'churnedLines / totalAIAttributedLines',
      threshold: '> 30% = high risk',
      window: '14 days (2 weeks)',
      implementation: 'Track AI-attributed line ranges; detect deletes/rewrites via git history'
    };
  }

  _getChurnExample(payload) {
    const files = payload.scoreData?.fileDebts || [];
    return {
      scenario: 'Example from current workspace',
      files: files.slice(0, 3).map(f => f.uri),
      interpretation: 'These files have unreviewed changes that may become churn if reverted later'
    };
  }

  // Similar methods for other metrics...
}

module.exports = MetricExplainerService;
```

**Update ContextBuilder.js:**

```javascript
// business_modules/dashboard-chat/app/ContextBuilder.js

class ContextBuilder {
  static getSystemPrompt() {
    return `You are an expert assistant for VibeSwitch, a VS Code extension that measures AI-assisted coding quality.

Your knowledge base includes:

1. **Research-backed antipatterns** (10 patterns):
   - Blind Acceptance (automation bias, fluency trust)
   - Verification Debt (output volume outruns review)
   - Silent Drift (debt accrues faster with AI)
   - Context Dilution (model priors override architecture)
   - Over-delegation (cognitive offloading)
   - Prompt Thrash (spec-by-conversation)
   - Test Theater (shallow tests, false confidence)
   - Security-by-Omission (insecure defaults)
   - Observability Neglect (no telemetry)
   - Diff Flooding (review bandwidth swamped)

2. **Current eval mechanisms** (7 core + 2 composites):
   - Blind Acceptance, Review Engagement, Over-delegation → Ownership & Engagement
   - Silent Drift → Unreviewed accumulation
   - Flooding, Response Drill → Interaction Quality
   - Context Spread → Resource Discipline
   - Comprehension Debt (composite: low review + high drill)
   - Verification Debt (composite: accept without test/save/navigate)

3. **Recommended additions** (3 high-priority):
   - Churn Spike Risk (GitClear 2025: code revised within 2 weeks)
   - Dependency Integrity Risk (supply-chain, slopsquatting)
   - Context Hijack Risk (prompt injection via repo files)

4. **Key differences**:
   - Flooding = excessive initiation (too many AI batches)
   - Response Drill = mechanical resolution (rubber-stamping output)
   - Both feed Interaction Quality meter

When explaining metrics:
- Cite research sources (GitClear, DORA, HiddenLayer, Trend Micro)
- Show formulas and thresholds
- Use current dashboard data for examples
- Explain "why AI intensifies" the pattern
- Suggest actionable mitigations

Be concise, technical, and evidence-based.`;
  }

  static buildUserContent(payload, codebaseContext, userMessage, metricContext = null) {
    let content = `# Current Dashboard State\n\n`;
    
    // Mode and risk
    content += `**Mode:** ${payload.currentMode || 'unknown'}\n`;
    content += `**Total Risk:** ${payload.scoreData?.total ?? 0}/100\n\n`;

    // Meters breakdown
    if (payload.antipatternBreakdown) {
      content += `## Active Meters\n\n`;
      for (const [meter, data] of Object.entries(payload.antipatternBreakdown)) {
        content += `### ${meter}\n`;
        content += `- Risk: ${data.risk ?? 0}%\n`;
        if (data.subSignals) {
          content += `- Sub-signals: ${JSON.stringify(data.subSignals, null, 2)}\n`;
        }
        content += `\n`;
      }
    }

    // Metric-specific context (if available)
    if (metricContext) {
      content += `## Relevant Research Context\n\n`;
      if (metricContext.relevantResearch.length > 0) {
        metricContext.relevantResearch.forEach(research => {
          content += `**${research.title}**\n`;
          content += `- Source: ${research.source}\n`;
          content += `- Summary: ${research.summary}\n`;
          if (research.citation) content += `- Citation: ${research.citation}\n`;
          if (research.dora) content += `- DORA: ${research.dora}\n`;
          content += `\n`;
        });
      }

      if (metricContext.formulas.length > 0) {
        content += `## Formulas\n\n`;
        metricContext.formulas.forEach(formula => {
          content += `**${formula.metric}**\n`;
          content += `- Formula: \`${formula.formula}\`\n`;
          content += `- Threshold: ${formula.threshold}\n`;
          if (formula.window) content += `- Time Window: ${formula.window}\n`;
          content += `\n`;
        });
      }
    }

    // Token usage
    if (payload.tokenUsage) {
      content += `## Token Usage\n`;
      content += `- Total: ${payload.tokenUsage.totalTokens ?? 0}\n`;
      content += `- Input: ${payload.tokenUsage.totalInput ?? 0}\n`;
      content += `- Output: ${payload.tokenUsage.totalOutput ?? 0}\n\n`;
    }

    // Codebase context
    if (codebaseContext) {
      content += `## Workspace Context\n\n${codebaseContext}\n\n`;
    }

    // User's question
    content += `# User Question\n\n${userMessage}`;

    return content;
  }
}

module.exports = ContextBuilder;
```

### Enhancement 2: Streaming Responses

**Goal:** Show LLM responses as they're generated (better UX for long explanations).

```javascript
// business_modules/dashboard-chat/infrastructure/adapters/OpenAILLMAdapter.js

class OpenAILLMAdapter {
  // ... existing code ...

  /**
   * Stream chat response (SSE-style)
   * @param {string} systemPrompt
   * @param {string} userContent
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<string>} Full response
   */
  async chatStream(systemPrompt, userContent, onChunk) {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      stream: true // Enable streaming
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                onChunk(content); // Stream to UI
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }
}
```

**Update ChatSection.jsx for streaming:**

```jsx
// dashboard-app/src/ChatSection.jsx

function ChatSection({ payload, sendChat, vscode }) {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);

  React.useEffect(() => {
    if (!vscode) return;

    const onMessage = (event) => {
      const msg = event.data;
      
      if (msg.command === 'chat-chunk') {
        // Append streaming chunk to last message
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.streaming) {
            lastMsg.content += msg.chunk;
          }
          return updated;
        });
      } else if (msg.command === 'chat-complete') {
        // Mark streaming as complete
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.streaming = false;
          }
          return updated;
        });
        setIsStreaming(false);
      } else if (msg.command === 'chat-response') {
        // Non-streaming response (fallback)
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: msg.text || msg.error, error: !!msg.error }
        ]);
        setIsStreaming(false);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [vscode]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', streaming: true } // Placeholder for streaming
    ]);
    
    setIsStreaming(true);
    vscode.postMessage({ command: 'chat', text: input.trim(), stream: true });
    setInput('');
  };

  return (
    <div className="chat-section">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-message-${msg.role}`}>
            <div className="chat-role">{msg.role === 'user' ? 'You' : 'VibeSwitch'}</div>
            <div className="chat-content">
              {msg.error ? (
                <span className="chat-error">{msg.content}</span>
              ) : (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              )}
              {msg.streaming && <span className="chat-cursor">▋</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <input
          className="chat-input"
          type="text"
          placeholder="Ask about metrics, antipatterns, or your current risk..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          disabled={isStreaming}
        />
        <button 
          className="chat-send-button" 
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

### Enhancement 3: Conversation History

**Goal:** Maintain chat context across messages (multi-turn conversations).

```javascript
// business_modules/dashboard-chat/app/ConversationManager.js

class ConversationManager {
  constructor({ maxTurns = 10, maxTokens = 8000 }) {
    this.conversations = new Map(); // webviewId -> messages[]
    this.maxTurns = maxTurns;
    this.maxTokens = maxTokens;
  }

  addMessage(webviewId, role, content) {
    if (!this.conversations.has(webviewId)) {
      this.conversations.set(webviewId, []);
    }

    const messages = this.conversations.get(webviewId);
    messages.push({ role, content, timestamp: Date.now() });

    // Trim old messages if exceeding limits
    while (messages.length > this.maxTurns * 2) { // user + assistant = 2 messages per turn
      messages.shift();
    }

    // Estimate token count and trim if needed
    while (this._estimateTokens(messages) > this.maxTokens && messages.length > 2) {
      messages.shift();
    }
  }

  getMessages(webviewId) {
    return this.conversations.get(webviewId) || [];
  }

  clearConversation(webviewId) {
    this.conversations.delete(webviewId);
  }

  _estimateTokens(messages) {
    // Rough estimate: 1 token ≈ 4 characters
    return messages.reduce((sum, msg) => sum + (msg.content.length / 4), 0);
  }
}

module.exports = ConversationManager;
```

**Update DashboardChatService.js:**

```javascript
async function reply(vscode, payload, userMessage, logger, webviewId, conversationManager) {
  // ... existing code ...

  // Add user message to conversation
  conversationManager.addMessage(webviewId, 'user', userMessage);

  // Build messages array with history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  const history = conversationManager.getMessages(webviewId);
  history.forEach(msg => {
    if (msg.role !== 'system') {
      messages.push({ role: msg.role, content: msg.content });
    }
  });

  // Call LLM with full conversation context
  const llm = createOpenAILLMAdapter({ ... });
  const text = await llm.chatWithHistory(messages);

  // Add assistant response to conversation
  conversationManager.addMessage(webviewId, 'assistant', text);

  return { text };
}
```

---

## Part 2: CI Integration for Cloud Run Agents

### Current Implementation

**What's already there:**

```
business_modules/agents/
├── app/
│   └── agentOrchestrator.js       ✅ Job submission + polling
├── domain/contracts/
│   ├── jobRequest.js              ✅ Job schema
│   ├── finding.js                 ✅ Finding schema
│   └── agentResponse.js           ✅ Response schema
├── infrastructure/
│   ├── gateway/agentGateway.js    ✅ HTTP client for Cloud Run
│   └── store/findingsStore.js     ✅ Local findings cache
└── ui/
    └── findingsDiagnostics.js     ✅ VS Code diagnostics integration
```

**Current capabilities:**
- ✅ Submit jobs to Cloud Run gateway
- ✅ Poll for results (2-second interval, 5-minute max)
- ✅ Store findings locally
- ✅ Display findings in Problems Panel
- ✅ Git integration (detect changed files, create patches)

**Current trigger points:**
- Save (debounced, DEV mode)
- Before commit
- Before push

### Enhancement 1: CI Pipeline Integration

**Goal:** Trigger agents from GitHub Actions, GitLab CI, or any CI system.

**Architecture:**

```
GitHub Actions Workflow
  ↓
  git push
  ↓
GitHub webhook → Cloud Run Gateway
  ↓
Enqueue jobs for specialized agents:
  ├─→ qa-agent (tests, lint, typecheck)
  ├─→ security-agent (SAST, SCA, secrets)
  └─→ architecture-agent (boundaries, cycles)
  ↓
Agents process in parallel
  ↓
Results stored in Cloud Run DB
  ↓
VS Code extension polls for results (via correlationId)
  OR
GitHub check runs updated (status API)
```

**Implementation:**

#### Step 1: GitHub Actions Workflow

```yaml
# .github/workflows/vibeswitch-agents.yml

name: VibeSwitch Agents

on:
  push:
    branches: [ main, develop, 'feature/**' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  trigger-agents:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for git diff

      - name: Trigger VibeSwitch Agents
        env:
          VIBESWITCH_GATEWAY_URL: ${{ secrets.VIBESWITCH_GATEWAY_URL }}
          VIBESWITCH_AUTH_TOKEN: ${{ secrets.VIBESWITCH_AUTH_TOKEN }}
        run: |
          # Get changed files
          if [ "${{ github.event_name }}" == "pull_request" ]; then
            BASE_SHA="${{ github.event.pull_request.base.sha }}"
            HEAD_SHA="${{ github.event.pull_request.head.sha }}"
          else
            BASE_SHA="${{ github.event.before }}"
            HEAD_SHA="${{ github.sha }}"
          fi

          # Generate patches for changed files
          CHANGED_FILES=$(git diff --name-only $BASE_SHA $HEAD_SHA)
          
          # Build job request payload
          cat > job-request.json <<EOF
          {
            "correlationId": "${{ github.run_id }}-${{ github.run_attempt }}",
            "repoId": "${{ github.repository }}",
            "branch": "${{ github.ref_name }}",
            "commit": "${{ github.sha }}",
            "changedFiles": [
              $(for file in $CHANGED_FILES; do
                echo "{"
                echo "  \"path\": \"$file\","
                echo "  \"patch\": \"$(git diff $BASE_SHA $HEAD_SHA -- $file | jq -Rs .)\","
                echo "  \"language\": \"${file##*.}\""
                echo "},"
              done | sed '$ s/,$//')
            ],
            "context": {
              "mode": "ci",
              "trigger": "${{ github.event_name }}",
              "actor": "${{ github.actor }}",
              "prNumber": ${{ github.event.pull_request.number || 'null' }}
            },
            "capabilities": {
              "canSuggestFixes": true,
              "maxTokens": 8000,
              "timeBudgetMs": 120000
            }
          }
          EOF

          # Submit job to Cloud Run gateway
          RESPONSE=$(curl -X POST "$VIBESWITCH_GATEWAY_URL/jobs" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $VIBESWITCH_AUTH_TOKEN" \
            -d @job-request.json)

          echo "Agent job submitted: $RESPONSE"
          
          JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
          echo "JOB_ID=$JOB_ID" >> $GITHUB_ENV

      - name: Wait for agents to complete
        env:
          VIBESWITCH_GATEWAY_URL: ${{ secrets.VIBESWITCH_GATEWAY_URL }}
          VIBESWITCH_AUTH_TOKEN: ${{ secrets.VIBESWITCH_AUTH_TOKEN }}
          CORRELATION_ID: ${{ github.run_id }}-${{ github.run_attempt }}
        run: |
          # Poll for results (max 5 minutes)
          MAX_POLLS=150
          POLL_COUNT=0
          
          while [ $POLL_COUNT -lt $MAX_POLLS ]; do
            RESPONSE=$(curl -s "$VIBESWITCH_GATEWAY_URL/jobs?correlationId=$CORRELATION_ID" \
              -H "Authorization: Bearer $VIBESWITCH_AUTH_TOKEN")
            
            STATUS=$(echo $RESPONSE | jq -r '.[0].status')
            
            if [ "$STATUS" == "completed" ] || [ "$STATUS" == "failed" ]; then
              echo "Agents completed with status: $STATUS"
              echo $RESPONSE | jq . > findings.json
              break
            fi
            
            sleep 2
            POLL_COUNT=$((POLL_COUNT + 1))
          done

      - name: Post findings as PR comments
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const findings = JSON.parse(fs.readFileSync('findings.json', 'utf8'));
            
            const body = findings
              .flatMap(job => job.findings || [])
              .map(f => `### ${f.category}: ${f.message}\n\n` +
                        `**File:** \`${f.filePath}\` (line ${f.range?.start?.line || '?'})\n` +
                        `**Severity:** ${f.severity}\n\n` +
                        (f.suggestedFix ? `**Suggested fix:**\n\`\`\`\n${f.suggestedFix}\n\`\`\`\n` : ''))
              .join('\n---\n\n');
            
            if (body) {
              await github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `## VibeSwitch Agent Findings\n\n${body}`
              });
            }

      - name: Update check status
        if: always()
        run: |
          # Update GitHub check runs with findings
          # (implementation depends on GitHub Checks API)
```

#### Step 2: Cloud Run Gateway Webhook Endpoint

**Add webhook endpoint to receive GitHub webhooks directly:**

```javascript
// cloud-run-gateway/src/webhooks/githubWebhook.js

class GitHubWebhookHandler {
  constructor({ jobQueue, secretKey }) {
    this.jobQueue = jobQueue;
    this.secretKey = secretKey;
  }

  async handlePush(payload) {
    const { repository, ref, after, before, pusher, commits } = payload;

    // Extract changed files from commits
    const changedFiles = new Set();
    commits.forEach(commit => {
      commit.added?.forEach(f => changedFiles.add(f));
      commit.modified?.forEach(f => changedFiles.add(f));
    });

    if (changedFiles.size === 0) {
      return { message: 'No files changed, skipping' };
    }

    // Create job request
    const jobRequest = {
      correlationId: `github-${repository.full_name}-${after}`,
      repoId: repository.full_name,
      branch: ref.replace('refs/heads/', ''),
      commit: after,
      changedFiles: Array.from(changedFiles).map(path => ({
        path,
        patch: '', // Will be fetched by agents from GitHub API
        language: this._detectLanguage(path)
      })),
      context: {
        mode: 'ci',
        trigger: 'push',
        actor: pusher.name,
        githubEvent: 'push'
      },
      capabilities: {
        canSuggestFixes: true,
        maxTokens: 8000,
        timeBudgetMs: 120000
      },
      metadata: {
        repository: repository.html_url,
        compareUrl: payload.compare
      }
    };

    // Enqueue job
    const jobId = await this.jobQueue.enqueue(jobRequest);
    
    return { jobId, correlationId: jobRequest.correlationId };
  }

  async handlePullRequest(payload) {
    const { action, pull_request, repository } = payload;

    // Only trigger on opened, synchronize, reopened
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return { message: `Skipping action: ${action}` };
    }

    // Create job request
    const jobRequest = {
      correlationId: `github-pr-${repository.full_name}-${pull_request.number}`,
      repoId: repository.full_name,
      branch: pull_request.head.ref,
      commit: pull_request.head.sha,
      changedFiles: [], // Will be fetched from PR files API
      context: {
        mode: 'ci',
        trigger: 'pull_request',
        action,
        prNumber: pull_request.number,
        prUrl: pull_request.html_url
      },
      capabilities: {
        canSuggestFixes: true,
        maxTokens: 10000,
        timeBudgetMs: 180000 // 3 minutes for PRs
      },
      metadata: {
        repository: repository.html_url,
        prTitle: pull_request.title,
        prAuthor: pull_request.user.login
      }
    };

    const jobId = await this.jobQueue.enqueue(jobRequest);
    
    // Create GitHub check run
    await this._createCheckRun(repository, pull_request.head.sha, jobRequest.correlationId);

    return { jobId, correlationId: jobRequest.correlationId };
  }

  async _createCheckRun(repository, sha, correlationId) {
    // Use GitHub Checks API to create a check run
    const octokit = this._getOctokit();
    
    await octokit.checks.create({
      owner: repository.owner.login,
      repo: repository.name,
      name: 'VibeSwitch Agents',
      head_sha: sha,
      status: 'in_progress',
      external_id: correlationId,
      output: {
        title: 'Running VibeSwitch agents...',
        summary: 'Analyzing changes with QA, Security, and Architecture agents'
      }
    });
  }

  _detectLanguage(filePath) {
    const ext = filePath.split('.').pop();
    const languageMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java'
    };
    return languageMap[ext] || 'plaintext';
  }

  _getOctokit() {
    const { Octokit } = require('@octokit/rest');
    return new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
}

module.exports = GitHubWebhookHandler;
```

**Express route:**

```javascript
// cloud-run-gateway/src/routes/webhooks.js

const express = require('express');
const crypto = require('crypto');
const GitHubWebhookHandler = require('../webhooks/githubWebhook');

const router = express.Router();

// Verify GitHub webhook signature
function verifyGitHubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(body).digest('hex');
  
  if (signature !== digest) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

router.post('/github', verifyGitHubSignature, async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  const handler = new GitHubWebhookHandler({
    jobQueue: req.app.locals.jobQueue,
    secretKey: process.env.GITHUB_WEBHOOK_SECRET
  });

  let result;
  
  switch (event) {
    case 'push':
      result = await handler.handlePush(payload);
      break;
    case 'pull_request':
      result = await handler.handlePullRequest(payload);
      break;
    default:
      return res.status(200).json({ message: `Event ${event} not handled` });
  }

  res.status(200).json(result);
});

module.exports = router;
```

### Enhancement 2: Specialized Agent Implementations

**Goal:** Implement the 3 specialized agents running on Cloud Run.

#### QA Agent (Cloud Run Service)

```javascript
// cloud-run-agents/qa-agent/src/index.js

const express = require('express');
const { runTests, runLinter, runTypecheck } = require('./tools');

const app = express();
app.use(express.json());

app.post('/analyze', async (req, res) => {
  const { jobId, repoId, branch, commit, changedFiles, context } = req.body;

  const findings = [];

  try {
    // Clone repo (or use pre-cloned workspace)
    const repoPath = await cloneRepo(repoId, branch, commit);

    // Run tests
    const testResults = await runTests(repoPath, changedFiles);
    findings.push(...testResults.findings);

    // Run linter
    const lintResults = await runLinter(repoPath, changedFiles);
    findings.push(...lintResults.findings);

    // Run typecheck
    const typecheckResults = await runTypecheck(repoPath, changedFiles);
    findings.push(...typecheckResults.findings);

    res.json({
      jobId,
      status: 'completed',
      findings: findings.map(f => ({
        category: 'QA',
        severity: f.severity,
        message: f.message,
        filePath: f.filePath,
        range: f.range,
        suggestedFix: f.suggestedFix,
        ruleId: f.ruleId
      }))
    });
  } catch (error) {
    res.status(500).json({
      jobId,
      status: 'failed',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`QA Agent listening on port ${PORT}`));
```

#### Security Agent (Cloud Run Service)

```javascript
// cloud-run-agents/security-agent/src/index.js

const express = require('express');
const { runSemgrep, runSecretScanning, runSCA } = require('./tools');

const app = express();
app.use(express.json());

app.post('/analyze', async (req, res) => {
  const { jobId, repoId, branch, commit, changedFiles } = req.body;

  const findings = [];

  try {
    const repoPath = await cloneRepo(repoId, branch, commit);

    // Run Semgrep (SAST)
    const semgrepResults = await runSemgrep(repoPath, changedFiles);
    findings.push(...semgrepResults.findings);

    // Run secret scanning
    const secretResults = await runSecretScanning(repoPath, changedFiles);
    findings.push(...secretResults.findings);

    // Run SCA (dependency scanning)
    const scaResults = await runSCA(repoPath);
    findings.push(...scaResults.findings);

    res.json({
      jobId,
      status: 'completed',
      findings: findings.map(f => ({
        category: 'Security',
        severity: f.severity || 'high',
        message: f.message,
        filePath: f.filePath,
        range: f.range,
        cweId: f.cweId,
        cveId: f.cveId,
        suggestedFix: f.suggestedFix
      }))
    });
  } catch (error) {
    res.status(500).json({
      jobId,
      status: 'failed',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Security Agent listening on port ${PORT}`));
```

#### Architecture Agent (Cloud Run Service)

```javascript
// cloud-run-agents/architecture-agent/src/index.js

const express = require('express');
const { detectBoundaryViolations, detectCycles, detectLayerBreaks } = require('./tools');

const app = express();
app.use(express.json());

app.post('/analyze', async (req, res) => {
  const { jobId, repoId, branch, commit, changedFiles } = req.body;

  const findings = [];

  try {
    const repoPath = await cloneRepo(repoId, branch, commit);

    // Detect boundary violations
    const boundaryResults = await detectBoundaryViolations(repoPath, changedFiles);
    findings.push(...boundaryResults.findings);

    // Detect cyclic dependencies
    const cycleResults = await detectCycles(repoPath, changedFiles);
    findings.push(...cycleResults.findings);

    // Detect layering breaks (e.g., domain depending on infra)
    const layerResults = await detectLayerBreaks(repoPath, changedFiles);
    findings.push(...layerResults.findings);

    res.json({
      jobId,
      status: 'completed',
      findings: findings.map(f => ({
        category: 'Architecture',
        severity: f.severity || 'medium',
        message: f.message,
        filePath: f.filePath,
        range: f.range,
        suggestedFix: f.suggestedFix,
        ruleId: f.ruleId
      }))
    });
  } catch (error) {
    res.status(500).json({
      jobId,
      status: 'failed',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Architecture Agent listening on port ${PORT}`));
```

### Enhancement 3: VS Code Extension Integration

**Update extension to show CI agent results:**

```javascript
// business_modules/agents/integration/extensionIntegration.js

class AgentsExtensionIntegration {
  // ... existing code ...

  /**
   * Poll for CI job results by correlation ID
   * (for GitHub Actions jobs triggered externally)
   */
  async pollCIJob(correlationId) {
    const maxPolls = 150; // 5 minutes
    let pollCount = 0;

    while (pollCount < maxPolls) {
      try {
        const jobs = await this.agentGateway.getJobsByCorrelationId(correlationId);
        
        const allCompleted = jobs.every(j => 
          j.status === 'completed' || j.status === 'failed'
        );

        if (allCompleted) {
          const findings = jobs.flatMap(j => j.findings || []);
          
          if (findings.length > 0) {
            this.findingsStore.storeFindings(
              correlationId,
              findings
            );
            this.showCIFindingsNotification(findings.length);
          }

          return findings;
        }
      } catch (error) {
        this.log(`Poll CI job error: ${error.message}`, true);
      }

      await this._sleep(2000);
      pollCount++;
    }

    throw new Error('CI job polling timeout');
  }

  showCIFindingsNotification(count) {
    const vscode = require('vscode');
    vscode.window.showInformationMessage(
      `VibeSwitch Agents: ${count} findings from CI`,
      'View Findings'
    ).then(selection => {
      if (selection === 'View Findings') {
        vscode.commands.executeCommand('workbench.panel.markers.view.focus');
      }
    });
  }
}
```

---

## Configuration

### VS Code Settings

```json
{
  // Dashboard Chat
  "vibeswitch.dashboardChat.enabled": true,
  "vibeswitch.dashboardChat.openai.apiKey": "sk-...",
  "vibeswitch.dashboardChat.openai.model": "gpt-4o-mini",
  "vibeswitch.dashboardChat.streaming": true,
  "vibeswitch.dashboardChat.useWorkspaceContext": true,
  "vibeswitch.dashboardChat.includeKeyFiles": true,
  "vibeswitch.dashboardChat.maxConversationTurns": 10,

  // Cloud Run Agents
  "vibeswitch.agents.enabled": true,
  "vibeswitch.agents.gatewayUrl": "https://vibeswitch-gateway-xxx.run.app",
  "vibeswitch.agents.authToken": "...",
  "vibeswitch.agents.triggerOnSave": false,
  "vibeswitch.agents.triggerOnCommit": true,
  "vibeswitch.agents.triggerOnPush": true,
  "vibeswitch.agents.ciIntegration": {
    "enabled": true,
    "pollForCIResults": true,
    "showNotifications": true
  }
}
```

### GitHub Secrets

```bash
# Add to repository secrets
gh secret set VIBESWITCH_GATEWAY_URL --body "https://vibeswitch-gateway-xxx.run.app"
gh secret set VIBESWITCH_AUTH_TOKEN --body "your-auth-token"
gh secret set GITHUB_WEBHOOK_SECRET --body "your-webhook-secret"
```

---

## Implementation Roadmap

### Week 1: Enhanced Dashboard Chat
- [ ] Add MetricExplainerService with research context
- [ ] Update ContextBuilder with eval mechanism explanations
- [ ] Implement streaming responses (OpenAI SSE)
- [ ] Add ConversationManager for multi-turn chat
- [ ] Update ChatSection.jsx for streaming UI

### Week 2: CI Integration Foundation
- [ ] Create GitHub Actions workflow template
- [ ] Add webhook endpoint to Cloud Run gateway
- [ ] Implement GitHubWebhookHandler
- [ ] Add GitHub Checks API integration
- [ ] Test end-to-end webhook → gateway flow

### Week 3: Specialized Agents + VS Code Integration
- [ ] Implement QA agent (tests, lint, typecheck)
- [ ] Implement Security agent (Semgrep, secrets, SCA)
- [ ] Implement Architecture agent (boundaries, cycles, layers)
- [ ] Update VS Code extension to poll CI results
- [ ] Add CI findings notification
- [ ] End-to-end testing

---

## Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| Dashboard Chat | Response time (streaming) | < 3s to first token |
| Dashboard Chat | User satisfaction | > 80% helpful responses |
| CI Agents | Job completion time | < 2 minutes (90th percentile) |
| CI Agents | False positive rate | < 15% |
| CI Agents | PR findings adoption rate | > 40% |

---

## Cost Estimates

### LLM Dashboard Chat
- **Model:** gpt-4o-mini ($0.15/1M input, $0.60/1M output)
- **Avg query:** 2K input + 500 output tokens
- **Cost per query:** ~$0.0006
- **Monthly (100 queries/day):** ~$18

### Cloud Run Agents
- **Instance:** 1 vCPU, 2GB RAM
- **Cost:** ~$0.05/hour active
- **Estimated:** 3 agents × 5 min/job × 50 jobs/day = ~$12/day = ~$360/month

**Total estimated cost:** ~$380/month for moderate usage

---

## Conclusion

**Both features are already 70% implemented:**

1. **Dashboard LLM Chat** needs:
   - Metric-specific context builder
   - Streaming responses
   - Conversation history
   
2. **CI Agent Integration** needs:
   - GitHub Actions workflow
   - Webhook endpoint
   - Specialized agent implementations

**Total implementation time:** 2-3 weeks

**Expected outcome:** 
- Developers get real-time AI-powered explanations of metrics in the dashboard
- Specialized agents run automatically on every push/PR, catching issues before merge
- Full integration between local IDE and CI pipeline

---

**Related documents:**
- [Multi-Agent Architecture](MULTI-AGENT-ARCHITECTURE.md)
- [Eval Mechanisms Implementation Recommendations](2026-02-10_eval-mechanisms-implementation-recommendations.md)
