# VibeSwitch Eval Mechanisms: Implementation Recommendations

**Date:** 2026-02-10  
**Purpose:** Review research-backed eval mechanisms and provide prioritized implementation roadmap for VibeSwitch extension.

---

## Executive Summary

The VibeSwitch extension currently implements **7 core eval mechanisms** covering the most critical AI-assisted coding antipatterns. This document reviews the research taxonomy of 10 behavioral antipatterns and recommends **3 high-value additions** that can be implemented within current technical constraints (no prompt access, editor + repo signals only).

### Current Implementation Status: Strong Foundation ✅

The extension already covers the most defensible, high-signal antipatterns:

| Status | Mechanism | Coverage |
|--------|-----------|----------|
| ✅ **Production** | Blind Acceptance, Review Engagement, Over-delegation | Core ownership signals |
| ✅ **Production** | Silent Drift (Debt) | Unreviewed accumulation |
| ✅ **Production** | Flooding, Response Drill | Interaction loop quality |
| ✅ **Production** | Context Spread | Resource discipline |
| ✅ **Production** | Comprehension Debt | Composite risk (low review + high drill) |
| ✅ **Production** | Verification Debt | Accept without test/save/navigate |
| ✅ **Experimental** | Test Theater | Shallow test quality (snapshot/trivial-assert ratios) |

**Verdict:** The current 7 core mechanisms + 2 composites cover ~70% of research-backed antipatterns and the most critical failure modes.

---

## Recommended Additions: Prioritized by ROI

Based on research evidence (GitClear 2025, DORA 2024, security literature) and technical feasibility, implement these **3 mechanisms next**:

### Priority 1: Churn Spike Risk 🎯

**Why:** Strongest research backing; directly measures "looks good → gets deleted" pattern.

**Research evidence:**
- GitClear AI Code Quality Research v2025.2.5: Churn (code revised/reverted within 2 weeks) rose significantly in 2024
- DORA 2024: ~7.2% delivery stability decrease per 25% AI adoption increase
- Direct proxy for unstable design and weak comprehension

**What to measure:**
- % of AI-attributed lines deleted within N hours/days (recommend 2-week window to match GitClear)
- "Accept → large edit batch → delete batch" patterns
- Repeated edits to same region shortly after acceptance

**Implementation approach:**

```javascript
// New module: business_modules/awareness/app/churn/churnDetectionService.js

class ChurnDetectionService {
  constructor({ gitAdapter, suggestionRepository }) {
    this.gitAdapter = gitAdapter;
    this.suggestionRepository = suggestionRepository;
  }

  async detectChurnForFile(filePath, timeWindowDays = 14) {
    // 1. Get AI-attributed line ranges from suggestions
    const aiAttributedRanges = await this.suggestionRepository
      .getAcceptedForFile(filePath);
    
    // 2. Get git blame/history for the file
    const lineHistory = await this.gitAdapter.getLineHistory(
      filePath, 
      timeWindowDays
    );
    
    // 3. Calculate churn: lines added then deleted/modified within window
    const churnedLines = this.calculateChurnedLines(
      aiAttributedRanges, 
      lineHistory
    );
    
    return {
      totalAILines: aiAttributedRanges.length,
      churnedLines: churnedLines.length,
      churnRate: churnedLines.length / aiAttributedRanges.length,
      patterns: this.detectChurnPatterns(churnedLines)
    };
  }

  calculateChurnedLines(aiRanges, history) {
    // Lines that were:
    // 1. Added by AI (in aiRanges)
    // 2. Deleted or substantially modified within timeWindow
    return history.filter(change => 
      this.isAIAttributed(change, aiRanges) &&
      this.isChurn(change)
    );
  }

  detectChurnPatterns(churnedLines) {
    // Detect: accept→edit→delete, repeated rewrites, etc.
    return {
      acceptThenDelete: this.countAcceptThenDelete(churnedLines),
      repeatedRewrites: this.countRepeatedRewrites(churnedLines)
    };
  }
}
```

**Data requirements:**
- New adapter: `IGitAdapter` with methods: `getLineHistory(filePath, days)`, `getBlame(filePath)`
- Extend `Suggestion` entity to track line ranges for accepted suggestions
- Store timestamp of acceptance for churn window calculation

**Integration points:**
- Feed into **Silent Drift** meter (debt accumulation)
- Feed into **Interaction Quality** meter (loop outcome)
- New composite: "Instability Risk" = high churn + low review

**Display:**
- Add "Churn Rate" sub-signal to Silent Drift breakdown
- Show warning when churn rate > 30% for recent AI changes
- Tooltip: "X% of AI-attributed code was revised/deleted within 2 weeks"

---

### Priority 2: Dependency Integrity Risk 🎯

**Why:** Supply-chain risks are critical; highly measurable without prompt access.

**Research evidence:**
- Trend Micro: Package hallucination & slopsquatting attacks
- "Accepting AI-suggested dependencies without provenance validation" is a documented vulnerability vector
- Low implementation complexity with high security value

**What to measure:**
- New dependencies added immediately after AI-attributed batch
- Dependency names not in baseline/allowlist
- First-time packages without audit step

**Implementation approach:**

```javascript
// New module: business_modules/awareness/app/dependencies/dependencyIntegrityService.js

class DependencyIntegrityService {
  constructor({ fileSystemAdapter, suggestionRepository, dependencyRegistry }) {
    this.fs = fileSystemAdapter;
    this.suggestionRepo = suggestionRepository;
    this.registry = dependencyRegistry; // optional: npm/pypi/etc. validation
  }

  async detectSuspiciousDependencies(timeWindowMinutes = 10) {
    // 1. Get recent AI batches
    const recentBatches = this.suggestionRepo.getBatchesSince(
      Date.now() - timeWindowMinutes * 60 * 1000
    );
    
    // 2. Monitor lockfile changes after each batch
    const suspiciousChanges = [];
    
    for (const batch of recentBatches) {
      const lockfileChanges = await this.detectLockfileChangesAfterBatch(
        batch,
        timeWindowMinutes
      );
      
      if (lockfileChanges.length > 0) {
        const analysis = await this.analyzeDependencyChanges(
          lockfileChanges,
          batch
        );
        suspiciousChanges.push(...analysis);
      }
    }
    
    return suspiciousChanges;
  }

  async analyzeDependencyChanges(changes, batch) {
    const suspicious = [];
    
    for (const dep of changes.newDependencies) {
      const risk = {
        name: dep.name,
        version: dep.version,
        addedAfterBatch: batch.id,
        riskFactors: []
      };
      
      // Risk factor 1: Not in allowlist
      if (!this.isInAllowlist(dep.name)) {
        risk.riskFactors.push('not_in_allowlist');
      }
      
      // Risk factor 2: First time in project
      if (!this.wasInBaselineLockfile(dep.name)) {
        risk.riskFactors.push('first_time_dependency');
      }
      
      // Risk factor 3: No registry validation (optional)
      if (this.registry && !await this.registry.verify(dep.name)) {
        risk.riskFactors.push('registry_validation_failed');
      }
      
      // Risk factor 4: Suspicious naming patterns
      if (this.hasSuspiciousNaming(dep.name)) {
        risk.riskFactors.push('suspicious_naming');
      }
      
      if (risk.riskFactors.length > 0) {
        suspicious.push(risk);
      }
    }
    
    return suspicious;
  }

  hasSuspiciousNaming(depName) {
    // Common typosquatting/slopsquatting patterns
    const suspiciousPatterns = [
      /\d{6,}/, // random numbers
      /[il1]{3,}/, // repeated confusable chars
      /-(test|temp|tmp)$/, // suspicious suffixes
    ];
    return suspiciousPatterns.some(pattern => pattern.test(depName));
  }
}
```

**Data requirements:**
- File watcher for `package.json`, `package-lock.json`, `requirements.txt`, `Cargo.lock`, etc.
- Baseline lockfile snapshot (on session start or mode switch)
- Optional: Allowlist file `~/.vibeswitch/state/dependency-allowlist.json`
- Optional: Registry validation adapter (npm, PyPI, cargo.io APIs)

**Integration points:**
- Feed into **Context & Resource Discipline** meter
- New sub-signal: "Dependency Risk"
- Alert/notification when suspicious dependency is detected in DEV mode

**Display:**
- Add "Dependency Changes" to Context & Resource breakdown
- Warning banner when unvalidated dependency is added after AI batch
- Suggest action: "Review new dependency: [package-name] (first time, not in allowlist)"

---

### Priority 3: Context Hijack Risk 🎯

**Why:** Prompt injection via repo content is a known attack vector; measurable via file access patterns.

**Research evidence:**
- HiddenLayer: Security risks for agentic IDEs
- Hidden instructions in README, issues, docs can hijack agent behavior
- Detection via file access patterns is feasible without prompt access

**What to measure:**
- Developer opens/edits "high-risk ingestion surfaces" (README, AGENTS.MD, .cursor/rules.md, issues) shortly before AI batch
- Tool invocations outside allowlist after ingesting external content
- Suspicious edit patterns (e.g., hidden comments in markdown)

**Implementation approach:**

```javascript
// New module: business_modules/awareness/app/context-hijack/contextHijackDetectionService.js

class ContextHijackDetectionService {
  constructor({ fileAccessTracker, suggestionRepository, toolAllowlist }) {
    this.fileAccess = fileAccessTracker;
    this.suggestionRepo = suggestionRepository;
    this.toolAllowlist = toolAllowlist;
  }

  async detectContextHijackRisk(timeWindowMinutes = 5) {
    const recentBatches = this.suggestionRepo.getBatchesSince(
      Date.now() - timeWindowMinutes * 60 * 1000
    );
    
    const risks = [];
    
    for (const batch of recentBatches) {
      // Check if ingestion surfaces were accessed before batch
      const suspiciousAccess = this.fileAccess.getAccessesBefore(
        batch.timestamp,
        timeWindowMinutes
      );
      
      const ingestionSurfaceAccess = suspiciousAccess.filter(access =>
        this.isIngestionSurface(access.path)
      );
      
      if (ingestionSurfaceAccess.length > 0) {
        risks.push({
          batchId: batch.id,
          accessedFiles: ingestionSurfaceAccess.map(a => a.path),
          riskLevel: this.calculateRiskLevel(ingestionSurfaceAccess),
          reason: 'ingestion_surface_accessed_before_ai_batch'
        });
      }
      
      // Check for suspicious content patterns
      for (const access of ingestionSurfaceAccess) {
        const content = await this.fileAccess.getContent(access.path);
        const suspiciousPatterns = this.detectSuspiciousPatterns(content);
        
        if (suspiciousPatterns.length > 0) {
          risks.push({
            file: access.path,
            patterns: suspiciousPatterns,
            reason: 'suspicious_instruction_patterns'
          });
        }
      }
    }
    
    return risks;
  }

  isIngestionSurface(filePath) {
    const ingestionSurfaces = [
      /README\.md$/i,
      /AGENTS\.MD$/i,
      /\.cursor\/rules.*\.md$/,
      /CONTRIBUTING\.md$/i,
      /INSTRUCTIONS\.md$/i,
      /\.github\/ISSUE_TEMPLATE/,
      /docs\/.+\.md$/
    ];
    
    return ingestionSurfaces.some(pattern => pattern.test(filePath));
  }

  detectSuspiciousPatterns(content) {
    const patterns = [];
    
    // Pattern 1: Hidden instructions in comments
    if (/<!--.*?(ignore|skip|bypass|allow|execute).*?-->/is.test(content)) {
      patterns.push('hidden_html_comment_instructions');
    }
    
    // Pattern 2: Obfuscated instructions
    if (/\[.*?\]\(javascript:|data:|file:|vscode-file:/).test(content)) {
      patterns.push('suspicious_markdown_links');
    }
    
    // Pattern 3: Instructions targeting AI
    const aiTargetedPhrases = [
      /assistant,? please/i,
      /copilot,? ignore/i,
      /you are an? .* model/i,
      /system prompt:/i
    ];
    if (aiTargetedPhrases.some(p => p.test(content))) {
      patterns.push('ai_targeted_instructions');
    }
    
    return patterns;
  }

  calculateRiskLevel(accesses) {
    // Higher risk if multiple ingestion surfaces modified
    if (accesses.length >= 3) return 'high';
    if (accesses.length === 2) return 'medium';
    return 'low';
  }
}
```

**Data requirements:**
- File access tracker: log all file opens/edits with timestamps
- Extend `Suggestion` entity to link to files accessed before batch creation
- Tool allowlist (for detecting out-of-bounds tool invocations)

**Integration points:**
- Feed into **Context & Resource Discipline** meter
- New alert in DEV mode when ingestion surface is modified before AI batch
- Optional: Block AI actions if high-risk pattern detected in DEV mode

**Display:**
- Add "Context Hijack Risk" to Context & Resource breakdown
- Warning: "High-risk file (README.md) edited before AI batch—review carefully"
- Tooltip: "N ingestion surfaces accessed in last M minutes"

---

## Implementation Roadmap

### Phase 1: Churn Spike (Weeks 1-3)

**Week 1: Infrastructure**
- [ ] Create `IGitAdapter` interface
- [ ] Implement git adapter with `getLineHistory()`, `getBlame()` methods
- [ ] Add line-range tracking to `Suggestion` entity
- [ ] Create `ChurnDetectionService` skeleton

**Week 2: Core Logic**
- [ ] Implement churn calculation logic
- [ ] Add churn pattern detection (accept→delete, repeated rewrites)
- [ ] Create unit tests for churn detection
- [ ] Integration with suggestion repository

**Week 3: Integration & UI**
- [ ] Wire churn detection into awareness engine
- [ ] Add churn sub-signal to Silent Drift meter
- [ ] Update dashboard to show churn breakdown
- [ ] Add tooltips and warnings
- [ ] End-to-end testing

### Phase 2: Dependency Integrity (Weeks 4-6)

**Week 4: Infrastructure**
- [ ] Create file watcher for lockfiles
- [ ] Implement lockfile parsers (npm, pip, cargo)
- [ ] Create baseline lockfile snapshot system
- [ ] Define allowlist data structure

**Week 5: Core Logic**
- [ ] Implement `DependencyIntegrityService`
- [ ] Add suspicious naming pattern detection
- [ ] Optional: Registry validation adapter
- [ ] Unit tests for dependency analysis

**Week 6: Integration & UI**
- [ ] Wire into awareness engine
- [ ] Add to Context & Resource Discipline meter
- [ ] Implement DEV mode alerts/notifications
- [ ] Create allowlist management UI
- [ ] Testing & documentation

### Phase 3: Context Hijack (Weeks 7-9)

**Week 7: Infrastructure**
- [ ] Create file access tracker
- [ ] Define ingestion surface patterns
- [ ] Implement content analysis utilities
- [ ] Store file access history

**Week 8: Core Logic**
- [ ] Implement `ContextHijackDetectionService`
- [ ] Add suspicious pattern detection
- [ ] Create risk level calculation
- [ ] Unit tests for pattern matching

**Week 9: Integration & UI**
- [ ] Wire into awareness engine
- [ ] Add to Context & Resource Discipline meter
- [ ] Implement DEV mode warnings
- [ ] Optional: Add blocking capability
- [ ] Testing & documentation

---

## Do NOT Implement (Low ROI or Technical Infeasibility)

### ❌ Architecture & Responsibility Distribution

**Why skip:**
- Requires role/task routing signals not available without prompt access
- No clear measurable proxy from editor events
- Would require over-interpretation of existing signals

**Current status:** Keep as conceptual placeholder in UI

### ❌ AI Mental Model Alignment

**Why skip:**
- Requires dialogic intent signals (prompt/chat content)
- High risk of over-interpretation
- Not defensible without direct access to conversation

**Current status:** Keep as conceptual-only; document clearly

### ⚠️ Test Theater (Keep Experimental)

**Current status:** Already implemented (UI-only, experimental)

**Why not prioritize expansion:**
- Requires test file parsing (AST)
- Snapshot/trivial-assert detection is heuristic
- Current implementation is "good enough" as experimental signal

**Recommendation:** Keep as experimental; gather telemetry before expanding

### ⚠️ Security Hygiene (Defer)

**Why defer:**
- Requires lightweight static analysis (Semgrep, regex rules)
- High maintenance burden (rule updates)
- Overlap with existing tools (ESLint, Semgrep)

**Recommendation:** Defer until Phases 1-3 are stable; then evaluate integration with existing linters

---

## Technical Architecture Considerations

### Data Model Extensions

```javascript
// Extend Suggestion entity
class Suggestion {
  // ... existing fields ...
  
  // New for churn detection
  acceptedLineRanges: Array<{ start: number, end: number, filePath: string }>;
  acceptedAt: number; // timestamp
  
  // New for context hijack
  filesAccessedBefore: Array<{ path: string, timestamp: number }>;
}

// New entities
class ChurnRecord {
  constructor({
    suggestionId,
    filePath,
    lineRange,
    churnedAt,
    churnType, // 'deleted' | 'modified' | 'reverted'
    originalContent,
    revisedContent
  }) { ... }
}

class DependencyChange {
  constructor({
    packageName,
    version,
    lockfilePath,
    addedAt,
    relatedBatchId,
    riskFactors
  }) { ... }
}

class ContextAccessRecord {
  constructor({
    filePath,
    accessType, // 'open' | 'edit'
    timestamp,
    suspiciousPatterns
  }) { ... }
}
```

### New Adapters/Ports

```javascript
// domain/ports/IGitAdapter.js
class IGitAdapter {
  async getLineHistory(filePath, days) { throw new Error('Not implemented'); }
  async getBlame(filePath) { throw new Error('Not implemented'); }
  async getDiff(filePath, sinceTimestamp) { throw new Error('Not implemented'); }
}

// domain/ports/IFileAccessTracker.js
class IFileAccessTracker {
  trackAccess(filePath, accessType) { throw new Error('Not implemented'); }
  getAccessesBefore(timestamp, windowMinutes) { throw new Error('Not implemented'); }
  getAccessesInWindow(startTime, endTime) { throw new Error('Not implemented'); }
}

// domain/ports/IDependencyRegistry.js (optional)
class IDependencyRegistry {
  async verify(packageName) { throw new Error('Not implemented'); }
  async getPackageInfo(packageName) { throw new Error('Not implemented'); }
}
```

### Performance Considerations

1. **Git operations are expensive**: Cache blame/history results; use incremental diffs
2. **File watching overhead**: Debounce lockfile change detection; batch analysis
3. **Pattern matching cost**: Precompile regex patterns; limit content scanning to ingestion surfaces

### Configuration

Add to `.vscode/settings.json`:

```json
{
  "vibeswitch.churnDetection": {
    "enabled": true,
    "windowDays": 14,
    "warningThreshold": 0.3
  },
  "vibeswitch.dependencyIntegrity": {
    "enabled": true,
    "allowlistPath": "~/.vibeswitch/state/dependency-allowlist.json",
    "registryValidation": false,
    "alertOnSuspicious": true
  },
  "vibeswitch.contextHijack": {
    "enabled": true,
    "windowMinutes": 5,
    "blockOnHighRisk": false,
    "ingestionSurfaces": [
      "README.md",
      "AGENTS.MD",
      ".cursor/rules*.md"
    ]
  }
}
```

---

## Success Metrics

Track effectiveness of new eval mechanisms:

| Mechanism | Success Metric | Target |
|-----------|----------------|--------|
| Churn Spike | % of high-churn cases flagged before merge | > 80% |
| Churn Spike | False positive rate | < 20% |
| Dependency Integrity | Suspicious deps detected per 1000 AI batches | Baseline in 3 months |
| Dependency Integrity | User-reported false positives | < 5% |
| Context Hijack | High-risk pattern detections per month | Baseline in 3 months |
| Context Hijack | Confirmed attacks prevented | Track case studies |

---

## Conclusion

**Current state:** VibeSwitch has a strong foundation with 7 core eval mechanisms covering the most critical antipatterns.

**Recommended additions:**
1. **Churn Spike Risk** — Strongest research backing; directly measures instability
2. **Dependency Integrity Risk** — High security value; low implementation complexity
3. **Context Hijack Risk** — Addresses emerging threat; measurable without prompt access

**Skip:**
- Architecture & Responsibility Distribution (no measurable signals)
- AI Mental Model Alignment (requires prompt access)

**Implementation timeline:** 9 weeks for all 3 additions (3 weeks per mechanism)

**Expected outcome:** Coverage increases from ~70% to ~90% of research-backed antipatterns while maintaining technical rigor and avoiding over-interpretation of signals.

---

**Related documents:**
- [AI Agent Behavioral Anti-Patterns: Research Taxonomy](2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md)
- [Antipattern Meters: Conceptual and Empirical Review](ANTIPATTERN-METERS-REVIEW.md)
- [Research-Backed Antipatterns: Future Instrumentation](ANTIPATTERN-RESEARCH-FUTURE.md)
