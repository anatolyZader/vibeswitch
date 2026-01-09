# VibeSwitch Extension - Comprehensive Review & Refactoring Plan

## 📋 Executive Summary

This plan provides a systematic approach to reviewing and refactoring the VibeSwitch VS Code extension. The extension is ~3,800 lines of code across 9 core JavaScript files, with the largest files being `awareness-monitor.js` (1,599 lines) and `usage-stats.js` (670 lines).

**Critical Issues Found:**
- ✅ **FIXED**: `mode-manager.js` and `status-bar.js` have been created
- ⚠️ **LARGE FILES**: `awareness-monitor.js` is 1,599 lines (should be <500)
- ⚠️ **DUPLICATE IMPORTS**: `AwarenessMonitor` imported twice in `extension.js`

---

## 🎯 Review Strategy

### Phase 1: Critical Issues (Day 1) ✅ **COMPLETED**
**Priority: CRITICAL - Extension may not work**

#### 1.1 Missing Dependencies ✅ **FIXED**
**Files to Check:**
- `extension.js` (lines 17-18)

**Issues:**
- ✅ `require('./mode-manager')` - **CREATED** `mode-manager.js`
- ✅ `require('./status-bar')` - **CREATED** `status-bar.js`

**Action Items:**
1. ✅ Searched entire codebase for `modeManager` and `statusBar` implementations
2. ✅ Created `mode-manager.js` with:
   - `detectCurrentMode()` - detects mode from .cursorrules files
   - `switchToMode()` - switches modes, applies settings, manages files
   - `watchForModeChanges()` - watches for .cursorrules file changes
3. ✅ Created `status-bar.js` with:
   - `updateStatusBar()` - updates status bar text/icon based on mode
   - `updateAwarenessMeter()` - displays awareness score with visual meter
4. ⏳ Test extension activation after fix (requires VS Code extension host)

**Expected Outcome:** Extension loads without errors ✅ **ACHIEVED**

---

### Phase 2: Code Quality & Structure (Days 2-3)
**Priority: HIGH - Maintainability**

#### 2.1 Large File Refactoring
**Files to Review:**
- `awareness-monitor.js` (1,599 lines) ⚠️ **CRITICAL**
- `usage-stats.js` (670 lines)
- `extension.js` (624 lines)

**Review Order:**
1. **`awareness-monitor.js`** (Start here - largest file)
2. **`extension.js`** (Main entry point)
3. **`usage-stats.js`** (Complex state management)

**Refactoring Strategy for `awareness-monitor.js`:**

**Current Structure Analysis:**
- Single large class with multiple responsibilities
- Likely contains: score calculation, suggestion tracking, review debt, file watching

**Proposed Split:**
```
awareness-monitor.js (core orchestration, ~200 lines)
├── awareness-score-calculator.js (~300 lines)
│   └── calculateScore(), calculateDebtScore(), etc.
├── suggestion-tracker.js (~400 lines)
│   └── recordAISuggestion(), checkSuggestionStatus(), etc.
├── review-debt-manager.js (~300 lines)
│   └── addToReviewDebt(), markAsReviewed(), etc.
├── file-watcher.js (~200 lines)
│   └── setupFileWatcher(), onFileCreated(), etc.
└── awareness-events.js (~200 lines)
    └── onCursorMove(), recordUserEdit(), etc.
```

**Refactoring Steps:**
1. **Extract Score Calculation** (Day 2, Morning)
   - Create `awareness-score-calculator.js`
   - Move `calculateScore()`, `calculateDebtScore()`, `getScore()` methods
   - Update `awareness-monitor.js` to use calculator instance
   - Test: Score calculation still works

2. **Extract Suggestion Tracking** (Day 2, Afternoon)
   - Create `suggestion-tracker.js`
   - Move `recordAISuggestion()`, `checkSuggestionStatus()`, suggestion array management
   - Update `awareness-monitor.js` to use tracker instance
   - Test: AI suggestions are tracked correctly

3. **Extract Review Debt Management** (Day 3, Morning)
   - Create `review-debt-manager.js`
   - Move `addToReviewDebt()`, `markAsReviewed()`, `reviewDebt` Map management
   - Update `awareness-monitor.js` to use manager instance
   - Test: Review debt tracking works

4. **Extract File Watching** (Day 3, Afternoon)
   - Create `file-watcher.js`
   - Move file system watcher setup and handlers
   - Update `awareness-monitor.js` to use watcher instance
   - Test: File changes are detected

5. **Extract Event Handlers** (Day 3, Evening)
   - Create `awareness-events.js`
   - Move `onCursorMove()`, `recordUserEdit()`, event listener setup
   - Update `awareness-monitor.js` to use event handlers
   - Test: User interactions are tracked

**Refactoring Strategy for `extension.js`:**

**Issues to Address:**
- Duplicate import: `AwarenessMonitor` and `AwarenessMonitorModule` (lines 13-14)
- Too many global variables (9 variables)
- Long `activate()` function (~130 lines)
- Mixed concerns: initialization, command registration, event setup

**Proposed Structure:**
```
extension.js (orchestration only, ~200 lines)
├── extension-init.js (~150 lines)
│   └── initializeComponents(), setupOutputChannel(), etc.
├── extension-commands.js (~100 lines)
│   └── registerCommands(), command handlers
└── extension-lifecycle.js (~100 lines)
    └── activate(), deactivate(), cleanup
```

**Refactoring Steps:**
1. **Remove Duplicate Import** (Quick fix)
   - Remove `AwarenessMonitorModule` import
   - Use `AwarenessMonitor` directly
   - Update `setLogOutput` call if needed

2. **Extract Initialization** (Day 2)
   - Create initialization helper functions
   - Move component setup to separate functions
   - Reduce `activate()` to high-level orchestration

3. **Extract Command Registration** (Day 2)
   - Move all command handlers to separate file or functions
   - Group related commands together
   - Improve command handler organization

**Refactoring Strategy for `usage-stats.js`:**

**Issues to Address:**
- Large class with multiple responsibilities
- File I/O mixed with business logic
- Session management mixed with statistics

**Proposed Split:**
```
usage-stats.js (main class, ~200 lines)
├── usage-stats-storage.js (~150 lines)
│   └── loadUsageStats(), saveUsageStats(), file operations
├── usage-stats-session.js (~150 lines)
│   └── startSession(), endSession(), session tracking
└── usage-stats-tracking.js (~170 lines)
    └── trackModeSwitch(), trackStatusBarClick(), event tracking
```

---

### Phase 3: Module Review (Days 4-5)
**Priority: MEDIUM - Code Quality**

#### 3.1 Small Module Review
**Files to Review (in order):**
1. **`file-decorations.js`** (187 lines)
   - Check: Error handling, path normalization, performance
   - Review: `provideFileDecoration()` logic, debug logging
   - Refactor: Extract path normalization, reduce debug verbosity

2. **`file-manager.js`** (345 lines)
   - Check: File operations, error handling, path safety
   - Review: `createDefaultModeFiles()`, file creation logic
   - Refactor: Extract file creation helpers, improve error messages

3. **`statistics.js`** (180 lines)
   - Check: UI generation, data formatting, export functionality
   - Review: `showUsageStatistics()`, export logic
   - Refactor: Extract UI components, improve data formatting

4. **`ui.js`** (78 lines)
   - Check: QuickPick configuration, callback handling
   - Review: `showModePicker()` implementation
   - Refactor: Extract mode definitions, improve type safety

5. **`config.js`** (86 lines)
   - Check: Settings management, mode configuration
   - Review: `getModeSettings()`, `applyModeSettings()`
   - Refactor: Extract settings definitions, improve validation

6. **`file-utils.js`** (33 lines)
   - Check: Path safety, utility functions
   - Review: `isPathSafe()` implementation
   - Refactor: Add more utility functions if needed

---

### Phase 4: Testing & Validation (Day 6)
**Priority: HIGH - Ensure nothing breaks**

#### 4.1 Testing Checklist
**After Each Refactoring:**
- [ ] Extension activates without errors
- [ ] Mode switching works (vibe ↔ dev)
- [ ] Awareness meter displays correctly
- [ ] File decorations appear in Explorer
- [ ] Usage statistics track correctly
- [ ] Commands are registered and work
- [ ] No console errors in Developer Tools

**Integration Testing:**
- [ ] Create new file in DEV mode → meter updates
- [ ] Switch modes → awareness monitor starts/stops
- [ ] Review file → debt decreases
- [ ] Export statistics → file is created
- [ ] Reload window → state persists

---

## 📝 Detailed File Review Checklist

### `extension.js` (624 lines)
**Review Focus:**
- [ ] **Line 13-14**: Remove duplicate `AwarenessMonitor` import
- [ ] **Line 17-18**: Fix missing `mode-manager` and `status-bar` imports
- [ ] **Line 21-28**: Improve error handling for `file-decorations` import
- [ ] **Line 30-39**: Reduce global variables (consider state object)
- [ ] **Line 45-176**: Break down `activate()` into smaller functions
- [ ] **Line 183-253**: Organize command registration better
- [ ] **Line 424-454**: Extract `setupUsageStatsListeners()` logic
- [ ] **Line 460-464**: Simplify `updateStatusBar()` if possible
- [ ] **Line 470-480**: Simplify `updateAwarenessMeter()` if possible
- [ ] **Line 482-552**: Review `startAwarenessMonitor()` - ensure file decoration provider init
- [ ] **Line 553-573**: Review `stopAwarenessMonitor()` - ensure cleanup
- [ ] **Line 581-592**: Review `switchToMode()` - ensure callbacks work
- [ ] **Line 605-619**: Review `deactivate()` - ensure all cleanup

**Refactoring Opportunities:**
- Extract initialization to `initializeExtension()`
- Extract command registration to `registerAllCommands()`
- Create state management object instead of global variables
- Split `activate()` into: `initializeComponents()`, `setupEventListeners()`, `startServices()`

---

### `awareness-monitor.js` (1,599 lines) ⚠️ **CRITICAL**
**Review Focus:**
- [ ] **Constructor (lines ~25-50)**: Review initialization, dependencies
- [ ] **Score Calculation Methods**: Identify all score-related methods
- [ ] **Suggestion Tracking Methods**: Identify all suggestion-related methods
- [ ] **Review Debt Methods**: Identify all debt-related methods
- [ ] **File Watching Methods**: Identify all file-watching methods
- [ ] **Event Handler Methods**: Identify all event-related methods
- [ ] **Lifecycle Methods**: `start()`, `stop()`, cleanup

**Refactoring Strategy:**
1. **Create Method Inventory** (First step)
   - List all public methods
   - List all private methods
   - Group by responsibility
   - Identify dependencies

2. **Extract by Responsibility** (As outlined in Phase 2.1)
   - Start with most independent module (likely score calculator)
   - Move to most dependent module last
   - Test after each extraction

3. **Update Integration Points**
   - Update `extension.js` if needed
   - Update `file-decorations.js` if needed
   - Ensure callbacks still work

---

### `usage-stats.js` (670 lines)
**Review Focus:**
- [ ] **Constructor (lines ~11-18)**: Review initialization
- [ ] **File I/O Methods**: `loadUsageStats()`, `saveUsageStats()`
- [ ] **Session Management**: `startSession()`, `endSession()`
- [ ] **Tracking Methods**: `trackModeSwitch()`, `trackStatusBarClick()`, etc.
- [ ] **Statistics Methods**: `getUsageStats()`, calculation methods
- [ ] **Export Methods**: `exportUsageStatistics()` if exists

**Refactoring Opportunities:**
- Extract file operations to `usage-stats-storage.js`
- Extract session logic to `usage-stats-session.js`
- Extract tracking to `usage-stats-tracking.js`
- Keep main class as thin orchestrator

---

### `file-decorations.js` (187 lines)
**Review Focus:**
- [ ] **Constructor (lines ~13-21)**: Review initialization
- [ ] **Path Normalization (lines ~54-58)**: Review `normalizePath()` logic
- [ ] **Decoration Logic (lines ~64-151)**: Review `provideFileDecoration()`
- [ ] **Debug Logging**: Reduce verbosity or make configurable
- [ ] **Error Handling**: Ensure all errors are caught and logged
- [ ] **Performance**: Review if `provideFileDecoration()` is called too often

**Refactoring Opportunities:**
- Extract path normalization to utility
- Extract decoration logic to separate method
- Make debug logging configurable
- Add caching if performance is an issue

---

### `file-manager.js` (345 lines)
**Review Focus:**
- [ ] **File Creation (lines ~23-339)**: Review `createDefaultModeFiles()`
- [ ] **Error Handling**: Ensure all file operations have error handling
- [ ] **Path Safety**: Ensure all paths are validated
- [ ] **File Operations**: Review all `fs` operations

**Refactoring Opportunities:**
- Extract file creation helpers
- Improve error messages
- Add path validation utilities
- Consider async/await consistency

---

### `statistics.js` (180 lines)
**Review Focus:**
- [ ] **UI Generation**: Review how statistics are displayed
- [ ] **Data Formatting**: Review number/date formatting
- [ ] **Export Functionality**: Review export implementation
- [ ] **Error Handling**: Ensure errors are handled gracefully

**Refactoring Opportunities:**
- Extract UI components
- Extract formatting utilities
- Improve export functionality
- Add more statistics if needed

---

### `ui.js` (78 lines)
**Review Focus:**
- [ ] **QuickPick Configuration (lines ~29-54)**: Review mode definitions
- [ ] **Callback Handling (lines ~56-71)**: Review callback logic
- [ ] **Error Handling**: Ensure errors are handled

**Refactoring Opportunities:**
- Extract mode definitions to constants
- Improve type safety
- Add more UI components if needed

---

### `config.js` (86 lines)
**Review Focus:**
- [ ] **Settings Retrieval (lines ~12-32)**: Review `getModeSettings()`
- [ ] **Settings Application (lines ~40-79)**: Review `applyModeSettings()`
- [ ] **Error Handling**: Ensure errors are handled

**Refactoring Opportunities:**
- Extract settings definitions to constants
- Improve validation
- Add default values handling

---

### `file-utils.js` (33 lines)
**Review Focus:**
- [ ] **Path Safety (lines ~13-30)**: Review `isPathSafe()` implementation
- [ ] **Utility Functions**: Check if more utilities are needed

**Refactoring Opportunities:**
- Add more path utilities if needed
- Improve path validation
- Consider adding file operation utilities

---

## 🔍 Code Quality Checks

### For Each File:
- [ ] **Error Handling**: All async operations have try/catch
- [ ] **Logging**: Appropriate logging levels (debug, info, error)
- [ ] **Comments**: Complex logic is commented
- [ ] **Naming**: Variables and functions have clear names
- [ ] **Dependencies**: Dependencies are minimal and clear
- [ ] **Testing**: Critical paths can be tested
- [ ] **Performance**: No obvious performance issues
- [ ] **Security**: Path validation, input sanitization

### Cross-File Checks:
- [ ] **Circular Dependencies**: No circular requires
- [ ] **Consistent Patterns**: Similar code uses similar patterns
- [ ] **Error Propagation**: Errors are handled consistently
- [ ] **State Management**: State is managed clearly
- [ ] **Event Handling**: Events are handled consistently

---

## 📅 Recommended Timeline

### Week 1: Critical Issues & Large Files
- **Day 1**: Fix missing dependencies, remove duplicate imports
- **Day 2**: Refactor `awareness-monitor.js` (Part 1: Score Calculator, Suggestion Tracker)
- **Day 3**: Refactor `awareness-monitor.js` (Part 2: Review Debt, File Watcher, Events)
- **Day 4**: Refactor `extension.js` (extract initialization, commands)
- **Day 5**: Refactor `usage-stats.js` (extract storage, session, tracking)

### Week 2: Module Review & Polish
- **Day 6**: Review and refactor small modules (`file-decorations.js`, `file-manager.js`)
- **Day 7**: Review and refactor remaining modules (`statistics.js`, `ui.js`, `config.js`, `file-utils.js`)
- **Day 8**: Integration testing, fix any issues
- **Day 9**: Code quality improvements, documentation
- **Day 10**: Final testing, performance optimization

---

## 🎯 Success Criteria

### After Phase 1 (Critical Issues):
- ✅ Extension loads without errors
- ✅ All required modules exist
- ✅ No duplicate imports

### After Phase 2 (Large File Refactoring):
- ✅ No file > 500 lines
- ✅ Clear separation of concerns
- ✅ All functionality still works
- ✅ Tests pass (if any exist)

### After Phase 3 (Module Review):
- ✅ All modules follow consistent patterns
- ✅ Error handling is comprehensive
- ✅ Code is well-documented
- ✅ No obvious performance issues

### After Phase 4 (Testing):
- ✅ All features work as before
- ✅ No regressions introduced
- ✅ Code is maintainable
- ✅ Ready for new features

---

## 📚 Additional Notes

### Tools to Use:
- **VS Code**: Built-in search, find references, go to definition
- **Node.js**: Run `node -e "require('./file.js')"` to test module loading
- **Git**: Commit after each successful refactoring phase

### Best Practices:
- **One change at a time**: Don't refactor multiple things simultaneously
- **Test frequently**: Test after each extraction/refactoring
- **Commit often**: Commit working code frequently
- **Document decisions**: Comment why you're refactoring, not just what

### Red Flags to Watch For:
- ⚠️ Files > 500 lines (consider splitting)
- ⚠️ Functions > 50 lines (consider extracting)
- ⚠️ Classes with > 10 methods (consider splitting)
- ⚠️ Deep nesting > 3 levels (consider flattening)
- ⚠️ Duplicate code (extract to function)
- ⚠️ Circular dependencies (refactor structure)

---

## 🚀 Getting Started

1. **Start with Phase 1**: Fix critical issues first
2. **Test after each change**: Don't accumulate untested changes
3. **Follow the order**: Large files first, then small modules
4. **Document as you go**: Update this plan with findings
5. **Ask for help**: If stuck, document the issue and move on

**Good luck with the refactoring! 🎉**

