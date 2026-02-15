# Summary: Eval Mechanisms Review & Integration Plans

**Date:** 2026-02-10  
**Scope:** Review of eval mechanisms + integration plans for LLM chat and CI agents

---

## What Was Delivered

### 1. Eval Mechanisms Implementation Recommendations
**Document:** [2026-02-10_eval-mechanisms-implementation-recommendations.md](2026-02-10_eval-mechanisms-implementation-recommendations.md)

**Key findings:**
- ✅ **Strong foundation**: 7 core eval mechanisms already implemented (~70% coverage)
- 🎯 **3 high-priority additions recommended**: Churn Spike, Dependency Integrity, Context Hijack
- ❌ **2 mechanisms to skip**: Architecture & Responsibility, AI Mental Model (not measurable without prompt access)

**Current implemented mechanisms:**
1. Blind Acceptance, Review Engagement, Over-delegation → Ownership & Engagement
2. Silent Drift → Unreviewed accumulation
3. Flooding, Response Drill → Interaction Quality
4. Context Spread → Resource Discipline
5. Comprehension Debt (composite)
6. Verification Debt (composite)
7. Test Theater (experimental)

**Recommended additions (9-week roadmap):**

| Priority | Mechanism | Research Backing | Implementation |
|----------|-----------|------------------|----------------|
| 1 | **Churn Spike Risk** | GitClear 2025 (211M lines), DORA 2024 | Git adapter + line history + churn pattern detection |
| 2 | **Dependency Integrity Risk** | Trend Micro (supply-chain), slopsquatting | Lockfile watchers + allowlist + registry validation |
| 3 | **Context Hijack Risk** | HiddenLayer (prompt injection) | File access tracker + pattern detection |

---

### 2. LLM Dashboard Chat & CI Agents Integration
**Document:** [2026-02-10_llm-dashboard-chat-and-ci-agents-integration.md](2026-02-10_llm-dashboard-chat-and-ci-agents-integration.md)

**Key findings:**
- ✅ **Both features already 70% implemented** in codebase
- 🚀 **2-3 week implementation** to production-ready
- 💰 **Cost estimate**: ~$380/month for moderate usage

#### Part 1: Enhanced Dashboard LLM Chat

**Current status:**
```
✅ DashboardChatService with OpenAI integration
✅ ChatSection React component
✅ Workspace context adapter
✅ Configuration via VS Code settings
```

**Needs enhancement:**
1. **Metric-specific explanations** - Add research context (GitClear, DORA) to responses
2. **Streaming responses** - Show LLM output as it's generated (better UX)
3. **Conversation history** - Multi-turn conversations with context retention

**Example interaction:**
```
User: "Why is my churn risk high?"

Assistant (streaming): "Your churn risk is high because 35% of your AI-attributed 
code has been deleted or significantly modified within 2 weeks. According to 
GitClear AI Code Quality Research v2025.2.5 (211M lines analyzed), churn 
correlates with unstable design and weak comprehension.

Looking at your current workspace:
- file1.js: 12 lines added then deleted within 4 days
- file2.js: Major rewrite after initial AI completion

Recommendation: Increase review time before accepting AI suggestions (currently 
averaging 3s, recommend >10s). Consider enabling DEV mode for architectural changes."
```

**Implementation:**
- Week 1: Metric-specific context + streaming + conversation history

#### Part 2: CI Integration for Cloud Run Agents

**Current status:**
```
✅ AgentOrchestrator (job submission + polling)
✅ AgentGateway (HTTP client for Cloud Run)
✅ FindingsStore + FindingsDiagnostics
✅ Job/Finding/Response contracts
```

**Needs implementation:**
1. **GitHub Actions workflow** - Trigger agents on push/PR
2. **Webhook endpoint** - Receive GitHub webhooks in Cloud Run gateway
3. **Specialized agents** - 3 Cloud Run services (QA, Security, Architecture)
4. **VS Code integration** - Poll CI results, show notifications

**Architecture:**
```
GitHub Push/PR
    ↓
GitHub Webhook → Cloud Run Gateway
    ↓
Enqueue jobs for agents:
    ├─→ qa-agent (tests, lint, typecheck)
    ├─→ security-agent (SAST, SCA, secrets)
    └─→ architecture-agent (boundaries, cycles, layers)
    ↓
Results → VS Code extension (polling or webhook)
    ↓
Display in Problems Panel + notifications
```

**3 Specialized Agents:**

| Agent | Checks | Tools |
|-------|--------|-------|
| **QA Agent** | Tests, linting, typecheck, coverage | Jest, ESLint, TypeScript, Vitest |
| **Security Agent** | SAST, SCA, secrets detection | Semgrep, TruffleHog, npm audit |
| **Architecture Agent** | Boundary violations, cycles, layer breaks | Custom AST analysis, dependency graph |

**Implementation:**
- Week 2: GitHub Actions + webhook endpoint + gateway integration
- Week 3: Specialized agents + VS Code CI results integration

---

## Key Questions Answered

### Q: "What is the difference between flooding and response drill?"

**Answer:**

**Flooding** = Excessive initiation (INPUT side)
- Too many AI batches created in short time
- "Prompt thrashing" - keep asking without processing
- Measures: batch count in 5-minute window
- Risk formula: `min(100, batchCount × 33)`

**Response Drill** = Mechanical resolution (OUTPUT side)
- Blindly accepting everything without review
- "Rubber stamping" - no critical engagement
- Measures: "keep-all" batches (≥3 suggestions, 0 modifications)
- Risk formula: `min(100, keepAllCount × 50)`

**Both feed Interaction Quality meter** because they indicate unproductive loops.

---

### Q: "Why didn't you mention AI/LLM evals?"

**Answer:**

**You were right to call this out!** The extension **already has LLM capabilities** in two places:

1. **`business_modules/llm/`** - LLM insight service for batch analysis
   - Already implemented: OpenAI integration, rate limiting, caching
   - Used for: Semantic labeling of code change batches
   
2. **`business_modules/dashboard-chat/`** - Dashboard LLM chat
   - Already implemented: Chat service, context builder, workspace adapter
   - Used for: Explaining metrics and answering questions

**The eval mechanisms doc focused on behavioral/empirical signals** (editor events, git history, file patterns) because those are:
- Always available (no API keys needed)
- Deterministic and defensible
- Low latency and cost
- Privacy-preserving (no code leaves device)

**LLM evals complement these** by providing:
- Natural language explanations of metrics
- Contextual recommendations
- Semantic code analysis (when enabled)

**Integration strategy:**
- Core eval mechanisms = behavioral signals (always on)
- LLM insights = optional enhancement (user-enabled)
- Dashboard chat = UI layer for explanations

---

## Implementation Timeline

### Phase 1: Core Eval Mechanisms (9 weeks)
- Weeks 1-3: **Churn Spike Risk** (git adapter, line tracking, pattern detection)
- Weeks 4-6: **Dependency Integrity Risk** (lockfile watchers, allowlist, validation)
- Weeks 7-9: **Context Hijack Risk** (file access tracker, pattern detection, alerts)

### Phase 2: LLM Chat & CI Integration (3 weeks, can run in parallel)
- Week 1: **Enhanced Dashboard Chat** (metric context, streaming, conversation history)
- Week 2: **CI Foundation** (GitHub Actions, webhook endpoint, gateway integration)
- Week 3: **Specialized Agents** (QA, Security, Architecture agents + VS Code integration)

**Total implementation time:** 9 weeks for Phase 1, 3 weeks for Phase 2 (can overlap)

---

## Cost Breakdown

### LLM Dashboard Chat
- **Model:** gpt-4o-mini ($0.15/1M input, $0.60/1M output)
- **Usage:** ~100 queries/day, 2K input + 500 output tokens each
- **Monthly cost:** ~$18

### Cloud Run Agents (CI)
- **Instances:** 3 agents × 1 vCPU × 2GB RAM
- **Usage:** 5 min/job × 50 jobs/day
- **Monthly cost:** ~$360

**Total estimated monthly cost:** ~$380 (moderate usage)

---

## Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| **Churn Detection** | % high-churn cases flagged | > 80% |
| **Dependency Integrity** | Suspicious deps detected | Baseline in 3 months |
| **Context Hijack** | False positive rate | < 10% |
| **Dashboard Chat** | Response time (streaming) | < 3s to first token |
| **Dashboard Chat** | User satisfaction | > 80% helpful |
| **CI Agents** | Job completion time | < 2 min (p90) |
| **CI Agents** | False positive rate | < 15% |
| **CI Agents** | PR findings adoption | > 40% |

---

## Conclusion

**Current State:**
- ✅ Solid foundation: 7 eval mechanisms + LLM infrastructure already implemented
- ✅ Multi-agent architecture for Cloud Run already 70% complete
- ✅ Dashboard chat service already functional

**Recommended Next Steps:**
1. **Short term (3 weeks)**: Enhance dashboard chat + CI integration (both 70% done)
2. **Medium term (9 weeks)**: Add 3 high-priority eval mechanisms (Churn, Dependency, Context Hijack)
3. **Skip**: Architecture & Responsibility, AI Mental Model (not measurable)

**Expected Outcome:**
- Coverage increases from ~70% to ~90% of research-backed antipatterns
- Developers get real-time AI-powered metric explanations
- Specialized agents catch issues in CI before merge
- Full integration: IDE ↔ CI ↔ Cloud agents

---

**Related Documents:**
1. [Eval Mechanisms Implementation Recommendations](2026-02-10_eval-mechanisms-implementation-recommendations.md)
2. [LLM Dashboard Chat & CI Agents Integration](2026-02-10_llm-dashboard-chat-and-ci-agents-integration.md)
3. [AI Agent Behavioral Anti-Patterns: Research Taxonomy](2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md)
4. [Antipattern Meters Review](ANTIPATTERN-METERS-REVIEW.md)
5. [Research-Backed Antipatterns: Future Instrumentation](ANTIPATTERN-RESEARCH-FUTURE.md)
