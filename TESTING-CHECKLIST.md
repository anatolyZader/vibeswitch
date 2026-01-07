# Testing Checklist - Ports and Adapters Refactoring

## Overview
This checklist verifies that the Ports and Adapters refactoring works correctly and all functionality is preserved.

## ✅ Unit Tests

### Mock Adapters
- [x] MockVSCodeAdapter created
- [x] MockPersistenceAdapter created
- [x] Adapter tests created (`test/suite/adapters.test.js`)

### Module Tests with Adapters
- [x] AwarenessMonitor adapter test created
- [x] EventHandlers adapter test created
- [x] AgentSuggestionHandler adapter test created

### Run Unit Tests
```bash
npm test
```

## 🔍 Integration Testing

### Extension Activation
- [ ] Extension activates without errors
- [ ] No console errors in Developer Tools
- [ ] All adapters are created and injected correctly
- [ ] DIContainer loads adapter config successfully

### Awareness Monitoring
- [ ] Awareness monitor starts in DEV mode
- [ ] Event handlers are registered via adapter
- [ ] Text document changes are detected
- [ ] File creation events are detected
- [ ] File save events are detected
- [ ] File open events are detected
- [ ] Document close events are detected
- [ ] Cursor movement events are detected
- [ ] Scroll events are detected
- [ ] Active editor changes are detected

### AI Suggestion Detection
- [ ] AI suggestions are detected and tracked
- [ ] Suggestions are stored with correct metadata
- [ ] Suggestion status detection works (pending/accepted/rejected)
- [ ] File processing works via adapter (`openTextDocument`)
- [ ] Range and Position types work via adapter

### Review Debt System
- [ ] Debt is loaded from persistence adapter
- [ ] Debt is saved to persistence adapter
- [ ] Debt calculations work correctly
- [ ] Debt persists across extension restarts

### Score Calculation
- [ ] Awareness score updates correctly
- [ ] Score components are calculated (review, critical, adaptation, debt)
- [ ] Score callback is triggered
- [ ] Score display in status bar works

### File Watching
- [ ] File system watcher uses adapter for workspaceFolders
- [ ] Externally created files are detected
- [ ] File scanning works
- [ ] URI creation uses adapter

### Change Ledger
- [ ] Change ledger uses persistence adapter
- [ ] DIFF bullets are generated
- [ ] Checkpoints are saved/loaded via adapter

## 🎯 Manual Testing Steps

### 1. Extension Activation
1. Open VS Code
2. Load the extension
3. Check Output panel for "VibeSwitch" channel
4. Verify no errors in Developer Console

### 2. Mode Switching
1. Switch to DEV mode (Command: `VibeSwitch: Switch to DEV Mode`)
2. Verify awareness monitor starts
3. Check status bar shows awareness meter
4. Switch to VIBE mode
5. Verify awareness monitor stops

### 3. AI Code Detection
1. In DEV mode, have AI generate code
2. Verify suggestions are tracked
3. Check file decorations appear in Explorer
4. Verify awareness score updates

### 4. User Review
1. Open a file with AI-generated code
2. Move cursor over the code
3. Verify review debt decreases
4. Check awareness score improves

### 5. Persistence
1. Add some AI code
2. Reload VS Code window
3. Verify debt persists
4. Verify suggestions are still tracked

### 6. Commands
Test all commands:
- [ ] `vibeswitch.switchMode`
- [ ] `vibeswitch.toVibe`
- [ ] `vibeswitch.toDev`
- [ ] `vibeswitch.showStats`
- [ ] `vibeswitch.resetStats`
- [ ] `vibeswitch.exportStats`
- [ ] `vibeswitch.showLogs`
- [ ] `vibeswitch.showStatusBar`
- [ ] `vibeswitch.diagnoseMonitor`
- [ ] `vibeswitch.diagnoseDecorations`
- [ ] `vibeswitch.detectTestingFiles`
- [ ] `vibeswitch.showUnreviewedFiles`

## 🐛 Known Issues to Verify Fixed

### Backward Compatibility
- [ ] Extension works without adapters (fallback to direct vscode)
- [ ] All modules handle null adapters gracefully

### Error Handling
- [ ] Errors in adapter methods are handled gracefully
- [ ] Missing adapter doesn't crash extension
- [ ] Invalid adapter config doesn't crash extension

## 📊 Performance Checks

- [ ] Extension activation time is acceptable (< 2 seconds)
- [ ] Event handling doesn't cause lag
- [ ] Score calculation is responsive
- [ ] File decorations update smoothly

## 🔧 Test Commands

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
node test/suite/adapters.test.js
node test/suite/awarenessMonitor.adapters.test.js
```

### Manual Extension Test
1. Open VS Code
2. Press F5 to launch Extension Development Host
3. Test functionality in the new window

## ✅ Success Criteria

All tests pass and:
- ✅ No regressions in functionality
- ✅ All adapters work correctly
- ✅ Backward compatibility maintained
- ✅ Performance is acceptable
- ✅ Error handling is robust

## 📝 Notes

- Mock adapters are in `infrastructure/adapters/`
- Test files are in `test/suite/`
- Integration tests require VS Code extension host
- Manual testing is required for UI components


