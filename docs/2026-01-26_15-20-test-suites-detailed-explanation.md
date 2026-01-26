# Detailed Explanation of Test Suites

**Date:** January 26, 2026  
**Purpose:** Comprehensive explanation of what each test suite validates

---

## Table of Contents

1. [Awareness Scoring Test Suites](#awareness-scoring-test-suites)
2. [Capability Enforcement Test Suites](#capability-enforcement-test-suites)
3. [MCP Server Test Suites](#mcp-server-test-suites)
4. [Domain Entity Test Suites](#domain-entity-test-suites)

---

## Awareness Scoring Test Suites

### 1. `scoreCalculations.constants.test.js` (6 tests)

**Purpose:** Ensures all constants are properly scoped and exported, preventing "works in extension host but fails in tests" bugs.

**What it tests:**
- ✅ All `SCORING_CONSTANTS` are defined and have correct values:
  - `DEFAULT_RECENT_WINDOW_MS` = 10 seconds
  - `SCORING_HORIZON_MS` = 15 minutes
  - `SCORING_HORIZON_COUNT` = 20 suggestions
  - `EMA_ALPHA` = 0.3 (exponential moving average smoothing)
  - `TARGET_SEC_PER_KCHAR` = 12 seconds per 1000 characters
  - `MINIMUM_REVIEW_TIME_MS` = 5 seconds
  - `MIN_REVIEWED_SIZE` = 200 characters
  - `PENDING_MAX_AGE_MS` = 30 seconds
- ✅ `EFFECTIVE_REVIEW_HELPER` is exported and has `isEffectivelyReviewed` function
- ✅ All calculator functions can be called without throwing `ReferenceError`:
  - `calculateReviewScore()`
  - `calculateBlindAcceptanceScore()`
  - `calculateAdaptationScore()`
  - `calculateRiskBasedDebtScore()`

**Why it matters:** In VS Code extensions, constants might be accessible via global scope, but in tests they must be explicitly imported. This suite catches missing exports.

---

### 2. `scoreCalculations.effectiveReview.test.js` (10 tests)

**Purpose:** Validates the "effective review" logic that determines if a user actually reviewed code before accepting.

**What it tests:**
- ✅ **Review time thresholds:**
  - Reviews under 5 seconds are NOT effective (too fast)
  - Reviews over 5 seconds CAN be effective (if other criteria met)
- ✅ **Size-based review depth:**
  - Small files (< 200 chars): Any review time > 5s is effective
  - Large files (≥ 200 chars): Must review at least 12 seconds per 1000 chars
  - Example: 2000 char file needs ≥ 24 seconds to be effective
- ✅ **Consistency checks:**
  - Same suggestion with different review times produces consistent results
  - Edge cases (exactly 5s, exactly 200 chars) are handled correctly
- ✅ **Integration with review score:**
  - Effectively reviewed suggestions contribute to positive review score
  - Non-effective reviews don't count as "good review"

**Why it matters:** This prevents false positives where the system thinks users are carefully reviewing when they're actually blindly accepting.

---

### 3. `scoreCalculations.blind.test.js` (21 tests)

**Purpose:** Tests the blind acceptance risk score - detecting when users accept AI suggestions without proper review.

**What it tests:**
- ✅ **Empty input handling:**
  - Empty array → 0
  - null/undefined → 0
  - Non-array → 0
  - Only pending suggestions → 0 (no resolved suggestions)
- ✅ **Blind acceptance dominates:**
  - 100% blind accepts → near max risk (~30/30)
  - 50% blind accepts → moderate risk (~15/30)
  - 0% blind accepts → 0 risk
- ✅ **Careful acceptance (after review):**
  - Accepted with effective review → mild risk (~5-10/30)
  - Accepted without review → high risk (~25-30/30)
- ✅ **Adapted suggestions:**
  - Adapted suggestions require effective review to mitigate risk
  - Adapted without review → still high risk
- ✅ **Monotonicity:**
  - Converting blind accepts → careful accepts decreases risk
  - More blind accepts → higher risk (linear relationship)
- ✅ **Output clamping:**
  - Always returns 0-30 range
  - Never negative, never > 30

**Why it matters:** This is a critical safety metric - high blind acceptance means users aren't reviewing AI code, which is dangerous.

---

### 4. `scoreCalculations.adaptation.test.js` (18 tests)

**Purpose:** Tests the adaptation score - measuring how often users need to edit AI suggestions after accepting them.

**What it tests:**
- ✅ **Empty input handling:**
  - Empty array → 0
  - null/undefined → 0
  - Non-array → 0
- ✅ **Edit count logic:**
  - No edits → 0 risk
  - 1-2 edits → low risk (~5-10/30)
  - 3+ edits → moderate risk (~15-20/30)
  - Many edits → high risk (~25-30/30)
- ✅ **Status-based scoring:**
  - `status: 'adapted'` → counts toward risk
  - `status: 'accepted'` → doesn't count (no edits)
  - `status: 'rejected'` → doesn't count (not adapted)
- ✅ **Monotonicity:**
  - More edits → higher risk
  - More adapted suggestions → higher risk
- ✅ **Output clamping:**
  - Always returns 0-30 range

**Why it matters:** High adaptation means AI suggestions aren't matching user needs, indicating poor AI performance or unclear requirements.

---

### 5. `scoreCalculations.debtRisk.test.js` (26 tests)

**Purpose:** Tests the debt risk score - measuring accumulated technical debt from pending/unreviewed suggestions.

**What it tests:**
- ✅ **Empty input handling:**
  - Empty fileDebts Map → 0
  - Empty pendingSuggestions → 0
  - Both empty → 0
- ✅ **File debt accumulation:**
  - Each pending suggestion adds to file's debt
  - Debt increases with suggestion age (older = more risky)
  - Multiple files with debt → aggregated risk
- ✅ **Age multiplier:**
  - Recent suggestions (< 1 hour) → low multiplier
  - Old suggestions (> 24 hours) → high multiplier
  - Very old suggestions (> 7 days) → maximum multiplier
- ✅ **Pending suggestion risk:**
  - Pending suggestions add immediate risk
  - Older pending suggestions add more risk
  - Pending suggestions in high-debt files add even more risk
- ✅ **Monotonicity:**
  - More pending suggestions → higher risk
  - Older suggestions → higher risk
  - More files with debt → higher risk
- ✅ **Output clamping:**
  - Always returns 0-30 range

**Why it matters:** High debt risk indicates accumulating unreviewed code that could become a maintenance burden.

---

### 6. `scoreService.regimes.test.js` (18 tests)

**Purpose:** Tests the orchestration logic that combines all component scores and applies different regimes based on activity patterns.

**What it tests:**
- ✅ **Regime: No recent activity**
  - When no suggestions in last 10 seconds → uses debt-based target
  - Debt score 15/30 → target score 50/100
  - Applies EMA smoothing to prevent sudden jumps
- ✅ **Regime: Pending-only**
  - When only pending suggestions exist → applies risk floor
  - Minimum risk even if other scores are low
  - Prevents false "safe" scores when work is pending
- ✅ **Regime: Normal (recent activity)**
  - Combines all component scores:
    - Review score (0-40)
    - Blind acceptance (0-30)
    - Adaptation (0-30)
    - Debt risk (0-30)
  - Applies weights and aggregates
  - Applies EMA smoothing
- ✅ **EMA smoothing:**
  - Prevents score from jumping wildly
  - Smooth transitions between scores
  - Alpha = 0.3 means 30% new, 70% old
- ✅ **Horizon selection:**
  - Uses last 15 minutes OR last 20 suggestions (whichever is smaller)
  - Prevents old data from skewing current score
- ✅ **Component aggregation:**
  - All components properly weighted
  - Final score is 0-100 range
  - Branch coverage: all code paths tested

**Why it matters:** This is the "brain" that combines all metrics into a single awareness score. Regimes ensure the score adapts to different activity patterns.

---

### 7. `lifecycle_to_score.integration.test.js` (4 tests)

**Purpose:** End-to-end integration tests verifying the complete flow from suggestion creation → scoring → debt tracking.

**What it tests:**
- ✅ **Suggestion creation → score update:**
  - Creating a suggestion triggers score calculation
  - Score includes debt component
  - All components properly initialized
- ✅ **Time-based acceptance:**
  - Suggestions accepted after `PENDING_MAX_AGE_MS` (30s) don't count as blind
  - Effective review prevents blind acceptance penalty
  - Time-based logic properly integrated
- ✅ **Status resolution → score update:**
  - Changing status from 'pending' → 'accepted' updates score
  - Changing status from 'pending' → 'rejected' updates score
  - Score reflects current state
- ✅ **End-to-end scenarios:**
  - **S1:** Blind acceptance scenario → high blind score
  - **S2:** Careful review scenario → low blind score, high review score
  - **S3:** Adaptation scenario → high adaptation score
  - **S4:** Debt accumulation scenario → high debt score

**Why it matters:** These tests verify the entire system works together, not just individual components.

---

### 8. `scoreCalculations.replay.test.js` (5 tests)

**Purpose:** Replay-based tests using real session fixtures to validate score behavior matches expected patterns.

**What it tests:**
- ✅ **Fixture replay infrastructure:**
  - Loads JSON fixtures with real session data
  - Replays suggestions in chronological order
  - Calculates scores at each step
- ✅ **Score direction validation:**
  - Scores move in expected directions
  - Blind acceptance increases blind score
  - Careful review decreases blind score
- ✅ **Monotonicity verification:**
  - More blind accepts → higher blind score
  - More reviews → higher review score
  - More debt → higher debt score
- ✅ **Real-world scenarios:**
  - `session_blind_accept.json` - Validates blind acceptance detection
  - `session_careful_review.json` - Validates careful review recognition

**Why it matters:** These tests use real data patterns, catching edge cases that unit tests might miss.

---

### 9. `scoreCalculations.property.test.js` (8 tests)

**Purpose:** Property-based/fuzz testing using fast-check to validate invariants hold for random inputs.

**What it tests:**
- ✅ **Invariants (always true):**
  - All scores are finite numbers (not NaN, Infinity)
  - All scores are in valid ranges (0-40, 0-30, 0-100)
  - Empty input always returns 0
  - Non-array input always returns 0
- ✅ **Monotonicity properties:**
  - More blind accepts → higher blind score
  - More edits → higher adaptation score
  - Older suggestions → higher debt score
- ✅ **Edge case robustness:**
  - Handles extreme values (very large numbers, negative numbers)
  - Handles missing fields gracefully
  - Handles malformed data without crashing
- ✅ **Age monotonicity for debt:**
  - Older suggestions always contribute more to debt
  - Age multiplier is always ≥ 1.0

**Why it matters:** Property-based tests catch bugs that would only appear with unexpected input combinations, making the system more robust.

---

## Capability Enforcement Test Suites

### 10. `modeManager.test.js` (~15 tests)

**Purpose:** Tests the secure mode state management system.

**What it tests:**
- ✅ **Constructor validation:**
  - Throws if context is null/undefined
  - Creates instance with valid context
- ✅ **getMode():**
  - Reads from `context.globalState` (source of truth)
  - Returns 'dev' or 'vibe'
  - Defaults to 'dev' if not set
- ✅ **setMode():**
  - Updates `context.globalState`
  - Syncs to filesystem (`~/.vibeswitch/state/mode.json`)
  - Atomic writes (temp file + rename)
- ✅ **syncToFileSystem():**
  - Creates directory if missing
  - Writes mode.json with timestamp
  - Handles errors gracefully

**Why it matters:** Mode state must be secure and reliable - hooks depend on it for enforcement decisions.

---

### 11. `workspaceAllowlist.test.js` (~12 tests)

**Purpose:** Tests the workspace allowlist that restricts MCP operations to trusted workspaces.

**What it tests:**
- ✅ **load():**
  - Loads allowlist from `~/.vibeswitch/state/workspaces.json`
  - Handles missing file gracefully
  - Parses JSON correctly
- ✅ **save():**
  - Writes allowlist to filesystem
  - Creates directory if missing
  - Handles errors
- ✅ **add():**
  - Adds workspace root (realpath'd)
  - Prevents duplicates
  - Normalizes paths
- ✅ **remove():**
  - Removes workspace from allowlist
  - Handles missing workspace gracefully
- ✅ **contains():**
  - Checks if workspace is in allowlist
  - Uses realpath for symlink safety
  - Handles path variations
- ✅ **syncFromWorkspace():**
  - Syncs current workspace to allowlist
  - Only if workspace is valid

**Why it matters:** Prevents MCP server from operating on untrusted workspaces, reducing attack surface.

---

### 12. `capabilitySelfTest.test.js` (~10 tests)

**Purpose:** Tests the self-test system that verifies capability enforcement is properly configured.

**What it tests:**
- ✅ **jq installation check:**
  - Verifies `jq` is installed (required for hooks)
  - Fails gracefully if missing
- ✅ **Hook script existence:**
  - Checks all hook scripts exist in `~/.vibeswitch/hooks/`
  - Verifies scripts are executable
- ✅ **Config file presence:**
  - Checks `mode.json` exists
  - Checks `mcp-server.json` exists
  - Checks `workspaces.json` exists
- ✅ **Periodic execution:**
  - Self-test runs on activation
  - Can be triggered manually
  - Reports results to user

**Why it matters:** Ensures the enforcement system is properly set up and can catch configuration issues early.

---

### 13. `hooksJsonGuard.test.js` (~12 tests)

**Purpose:** Tests the system that protects `.cursor/hooks.json` from tampering.

**What it tests:**
- ✅ **File watching:**
  - Watches `.cursor/hooks.json` for changes
  - Detects modifications
- ✅ **Atomic restore:**
  - Restores hooks.json from backup
  - Uses temp file + rename (atomic)
  - Preserves original content
- ✅ **Debounce logic:**
  - Prevents repeated restores
  - Handles rapid changes gracefully
- ✅ **Mode flipping:**
  - On tamper detection → force switch to DEV mode
  - Updates mode.json
  - Logs to audit trail
- ✅ **Audit logging:**
  - Logs tamper attempts
  - Includes timestamp and details

**Why it matters:** If hooks.json is tampered with, enforcement breaks. This prevents that.

---

### 14. `alertFileEditDetector.test.js` (~15 tests)

**Purpose:** Tests the system that detects and auto-reverts unauthorized file edits.

**What it tests:**
- ✅ **Status bar badge:**
  - Creates badge on initialization
  - Shows/hides based on alert count
  - Updates text and tooltip
  - Only visible in DEV mode
- ✅ **Alert detection:**
  - Watches `~/.vibeswitch/state/alert.json`
  - Processes alerts when file changes
  - Skips duplicate alerts (same timestamp)
- ✅ **Mode awareness:**
  - Only processes alerts in DEV mode
  - Ignores alerts in VIBE mode
- ✅ **Visual feedback:**
  - Shows modal warning for unapproved edits
  - Provides action buttons (View File, Git Diff, Revert)
  - Handles user selections
- ✅ **Watcher setup:**
  - Uses chokidar if available
  - Falls back to fs.watch
  - Handles file creation and changes

**Why it matters:** This is the core of the auto-revert system - it must reliably detect and respond to unauthorized edits.

---

### 15. `keypairManager.test.js` (~12 tests)

**Purpose:** Tests the Ed25519 cryptographic keypair management for approval tokens.

**What it tests:**
- ✅ **Key generation:**
  - Generates Ed25519 keypair
  - Stores private key in `context.secrets`
  - Exports public key to `~/.vibeswitch/mcp/publicKey.pem`
- ✅ **Key loading:**
  - Loads existing keypair from storage
  - Handles missing keys gracefully
  - Regenerates if corrupted
- ✅ **Key storage:**
  - Private key never leaves `context.secrets`
  - Public key is readable by MCP server
  - Atomic writes for public key
- ✅ **Signing operations:**
  - Signs token payloads with private key
  - Produces valid Ed25519 signatures
  - Handles signing errors

**Why it matters:** Cryptographic tokens are the foundation of secure approval workflow - keys must be managed correctly.

---

### 16. `canonical.test.js` (~8 tests)

**Purpose:** Tests the canonical JSON serialization used for token signing/verification.

**What it tests:**
- ✅ **Key sorting:**
  - Keys are sorted alphabetically
  - Consistent ordering regardless of input order
- ✅ **Value normalization:**
  - All values converted to strings
  - Numbers formatted consistently
  - Nested objects handled correctly
- ✅ **Consistency:**
  - Same input always produces same output
  - No random ordering
  - Deterministic serialization
- ✅ **Token payload format:**
  - Validates token payload structure
  - Ensures signing/verification compatibility

**Why it matters:** Token signatures must be verifiable - canonical JSON ensures both sides serialize identically.

---

## MCP Server Test Suites

### 17. `pathSafety.test.js` (~15 tests)

**Purpose:** Tests the path safety validation that prevents path traversal and blocklisted file access.

**What it tests:**
- ✅ **Normal paths:**
  - Allows `src/index.js`
  - Allows deeply nested paths
  - Allows paths with spaces
- ✅ **Path traversal prevention:**
  - Blocks `../` attempts
  - Blocks `../../` attempts
  - Blocks absolute paths outside workspace
  - Blocks symlink escapes
- ✅ **Blocklisted directories:**
  - Blocks `.git/` modifications
  - Blocks `.cursor/` modifications
  - Blocks `node_modules/` modifications
  - Blocks `.vibeswitch/` modifications
- ✅ **Blocklisted files:**
  - Blocks `.env` modifications
  - Blocks `credentials.json` modifications
  - Blocks `secrets.json` modifications
- ✅ **Realpath handling:**
  - Resolves symlinks correctly
  - Prevents symlink-based escapes
  - Handles missing symlinks gracefully

**Why it matters:** Prevents MCP server from modifying sensitive files or escaping workspace boundaries.

---

## Domain Entity Test Suites

### 18. `reviewSession.test.js` (~10 tests)

**Purpose:** Tests the ReviewSession domain entity that tracks review state.

**What it tests:**
- ✅ **Session creation:**
  - Creates session with valid data
  - Initializes timestamps
  - Sets default state
- ✅ **State transitions:**
  - Pending → Accepted
  - Pending → Rejected
  - Pending → Adapted
- ✅ **Review tracking:**
  - Records review time
  - Tracks edit count
  - Updates status correctly

---

### 19. `suggestionBatch.test.js` (~8 tests)

**Purpose:** Tests the SuggestionBatch aggregate that groups suggestions.

**What it tests:**
- ✅ **Batch creation:**
  - Groups suggestions by file
  - Tracks batch metadata
- ✅ **Batch operations:**
  - Adds suggestions to batch
  - Retrieves suggestions by file
  - Calculates batch statistics

---

### 20. `agentSuggestionHandler.batch.test.js` (~12 tests)

**Purpose:** Tests batch processing of AI suggestions.

**What it tests:**
- ✅ **Batch processing:**
  - Processes multiple suggestions
  - Handles batch errors gracefully
  - Updates scores after batch
- ✅ **Batch validation:**
  - Validates batch structure
  - Rejects invalid batches
  - Handles partial failures

---

## Test Coverage Summary

| Category | Test Files | Total Tests | Coverage Focus |
|----------|------------|-------------|----------------|
| **Awareness Scoring** | 9 files | ~100 tests | Calculator functions, orchestration, integration |
| **Capability Enforcement** | 7 files | ~80 tests | Mode management, hooks, alerts, crypto |
| **MCP Server** | 1 file | ~15 tests | Path safety, validation |
| **Domain Entities** | 3 files | ~30 tests | Domain logic, aggregates |
| **Total** | **20 files** | **~225 tests** | **Comprehensive** |

---

## Test Quality Characteristics

### 1. **Edge Case Coverage**
- Empty inputs (null, undefined, empty arrays)
- Extreme values (very large numbers, negative numbers)
- Missing fields
- Malformed data

### 2. **Monotonicity Verification**
- More X → higher/lower Y
- Ensures predictable behavior
- Catches regression bugs

### 3. **Output Bounds**
- All functions clamp outputs to valid ranges
- No negative scores
- No scores > maximum

### 4. **Integration Testing**
- End-to-end flows
- Component interaction
- Real-world scenarios

### 5. **Property-Based Testing**
- Random input generation
- Invariant validation
- Catches unexpected bugs

---

## Conclusion

The test suite provides **comprehensive coverage** of:
- ✅ **Pure functions** (unit tests with edge cases)
- ✅ **Orchestration logic** (regime switching, EMA, aggregation)
- ✅ **Integration flows** (lifecycle → scoring → debt)
- ✅ **Security mechanisms** (mode management, hooks, crypto)
- ✅ **Path safety** (traversal prevention, blocklists)
- ✅ **Domain logic** (entities, aggregates)

All tests follow **TDD principles** and provide confidence that the system behaves correctly, handles edge cases gracefully, and maintains security invariants.
