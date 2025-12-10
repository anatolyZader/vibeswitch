# VibeSwitch Pre-Release Testing Checklist

## 🎯 Testing the Dual Score System & Visual Meter

**Version:** 2.0.0 (Dual-Score System)  
**Date:** 2024-12-03

---

## ✅ Pre-Testing Setup

### 1. Check Code Quality
- [x] No linter errors
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All imports resolved

### 2. Install Dependencies
```bash
cd /home/eventstorm1/vibeswitch-1/vibeswitch
npm install
```

### 3. Launch Extension Development Host
```bash
# In Cursor, open vibeswitch folder
cursor /home/eventstorm1/vibeswitch-1/vibeswitch

# Press F5 to launch Extension Development Host
```

---

## 🧪 Test Suite 1: Core Functionality (Regression Tests)

### Test 1.1: Extension Activation
- [ ] Extension activates on startup
- [ ] No errors in Developer Console
- [ ] Status bar item appears
- [ ] **NEW:** Awareness meter appears next to status bar

**How to test:**
1. Press F5 in extension folder
2. Open any folder in Extension Development Host
3. Check bottom-right status bar

**Expected:**
```
[📚 DEV] [🟢 ███████]  ← Two items
```

### Test 1.2: Mode Switching (Basic)
- [ ] Can switch from DEV to VIBE
- [ ] Can switch from VIBE to DEV
- [ ] Status bar updates correctly
- [ ] `.cursorrules` file updates
- [ ] `.vscode/settings.json` updates

**How to test:**
1. Click status bar mode indicator
2. Select different mode
3. Verify files updated

### Test 1.3: Commands Registration
- [ ] `VibeSwitch: Switch AI Agent Mode`
- [ ] `VibeSwitch: Switch to VIBE Mode`
- [ ] `VibeSwitch: Switch to DEV Mode`
- [ ] `VibeSwitch: Show Usage Statistics`
- [ ] `VibeSwitch: Reset Usage Statistics`
- [ ] `VibeSwitch: Export Usage Statistics`

**How to test:**
- Press `Ctrl+Shift+P`
- Type "vibeswitch"
- Verify all 6 commands appear

---

## 🎨 Test Suite 2: Visual Meter (New Feature)

### Test 2.1: Meter Visibility
- [ ] Meter appears next to mode indicator
- [ ] Meter shows 7 segments
- [ ] Meter shows emoji indicator
- [ ] Meter position: right-aligned, priority 99

**How to test:**
1. Look at status bar
2. Count segments in meter (should be 7 total)
3. Verify emoji present

**Expected patterns:**
```
🚀 ██████░  ← VIBE mode, high score
🟢 ███████  ← DEV mode, high score
🔴 █░░░░░░  ← Any mode, low score
```

### Test 2.2: Meter Updates
- [ ] Meter updates when switching modes
- [ ] Different meter for VIBE vs DEV
- [ ] Real-time updates (not cached)

**How to test:**
1. Note meter in VIBE mode
2. Switch to DEV mode
3. Verify meter changes
4. Note the score difference

### Test 2.3: Meter Tooltip
- [ ] Hover shows exact score
- [ ] Hover shows visual meter
- [ ] Hover shows mode-specific message
- [ ] Hover says "Click for detailed statistics"

**How to test:**
1. Hover mouse over meter
2. Read tooltip

**Expected tooltip:**
```
VIBE Mode Awareness: 65/100
██████░

Click for detailed statistics
```

### Test 2.4: Meter Colors (Background)
- [ ] Green/Normal: Good score
- [ ] Orange/Warning: Fair score
- [ ] Red/Error: Low score
- [ ] Colors change with score

**How to test:**
1. Check meter background color
2. Perform actions to change score
3. Verify color updates

**Expected thresholds:**
- VIBE: 60+ = normal, 40-59 = orange, <40 = red
- DEV: 70+ = normal, 50-69 = orange, <50 = red

### Test 2.5: Meter Click Action
- [ ] Clicking meter opens statistics
- [ ] Same as clicking mode indicator's stats option

**How to test:**
1. Click on meter (not mode indicator)
2. Verify statistics dashboard opens

---

## 📊 Test Suite 3: Dual Score System (New Feature)

### Test 3.1: Separate Score Calculation
- [ ] VIBE score calculated independently
- [ ] DEV score calculated independently
- [ ] Scores can be different
- [ ] Scores use different algorithms

**How to test:**
1. Use VIBE mode for 5 minutes
2. Switch to DEV mode
3. Open statistics
4. Verify two different scores shown

**Expected:**
```
## ⚡ VIBE Mode
### 🚀 VIBE Awareness Score: 65/100

## 📚 DEV Mode
### 🟢 DEV Awareness Score: 78/100
```

### Test 3.2: Mode-Specific Tracking
- [ ] VIBE metrics tracked only in VIBE mode
- [ ] DEV metrics tracked only in DEV mode
- [ ] No cross-contamination

**How to test:**
1. Switch to VIBE mode
2. Modify files rapidly (5+ files)
3. Switch to DEV mode
4. Open settings.json
5. View statistics
6. Verify: VIBE metrics increased, DEV metrics increased separately

**Expected in stats:**
```
#### VIBE Metrics:
- Rapid File Changes: 5+  ← Should increase in VIBE

#### DEV Metrics:
- Settings Verified: 1+  ← Should increase in DEV
```

### Test 3.3: VIBE Score Increases With
- [ ] Rapid file modifications
- [ ] Auto-accepting changes
- [ ] Less status checking
- [ ] Longer focused sessions

**How to test:**
1. Switch to VIBE mode
2. Create/modify 5 files quickly
3. Edit without checking status bar
4. Check VIBE score
5. Score should be 60+

### Test 3.4: DEV Score Increases With
- [ ] Opening settings.json
- [ ] Opening .cursorrules
- [ ] Reading documentation
- [ ] Manual edits after mode switch
- [ ] Long deliberate sessions

**How to test:**
1. Switch to DEV mode
2. Open `.vscode/settings.json`
3. Open `.cursorrules`
4. Open `SETTINGS-COMPARISON.md`
5. Edit a file
6. Wait 5+ minutes in DEV mode
7. Check DEV score
8. Score should be 70+

### Test 3.5: Context-Dependent Interpretation
- [ ] Same action = different score impact
- [ ] Checking status frequently: bad in VIBE, good in DEV
- [ ] Opening settings: bad in VIBE, good in DEV

**How to test:**
1. In VIBE mode: Click status bar 5 times quickly
2. Check VIBE score (should stay low or decrease)
3. Switch to DEV mode
4. Click status bar 5 times quickly
5. Check DEV score (should increase or stay stable)

---

## 📈 Test Suite 4: Statistics Dashboard (Enhanced)

### Test 4.1: Dual Score Display
- [ ] Shows VIBE score with meter
- [ ] Shows DEV score with meter
- [ ] Shows emoji indicators
- [ ] Shows visual ASCII meters

**How to test:**
1. Open statistics
2. Look for both score sections

**Expected format:**
```markdown
### 🚀 VIBE Awareness Score: 65/100
```
███████
```

### 🟢 DEV Awareness Score: 78/100
```
███████
```

### Test 4.2: Mode-Specific Metrics
- [ ] VIBE section shows VIBE-specific metrics
- [ ] DEV section shows DEV-specific metrics
- [ ] Metrics are separate and clear

**Expected VIBE metrics:**
```
- Rapid File Changes: X
- Auto-Acceptance: X
- Manual Edits: X
```

**Expected DEV metrics:**
```
- Deliberate Reviews: X
- Settings Verified: X
- Learning/Questions: X
```

### Test 4.3: Recommendations
- [ ] Mode-specific recommendations
- [ ] Cross-mode recommendations
- [ ] Appropriate warning levels
- [ ] Actionable advice

**How to test:**
1. Use extension with varied behavior
2. Check recommendations section
3. Verify recommendations match your usage

**Expected tags:**
```
### [VIBE] 🚀 Excellent!
### [DEV] ⚠️ Low awareness!
### 💡 Heavy VIBE user!
```

### Test 4.4: Score Explanations
- [ ] Explains what score means in context
- [ ] Different explanations for VIBE vs DEV
- [ ] Helpful guidance

**Expected:**
```
**What this means in VIBE mode:**
- 🟢 Excellent! You're fast, confident, and productive.

**What this means in DEV mode:**
- 🟢 Excellent! You're thoroughly reviewing and learning.
```

---

## 🔧 Test Suite 5: Telemetry System

### Test 5.1: Data Persistence
- [ ] Telemetry data saves to disk
- [ ] Data persists across reloads
- [ ] Data structure correct

**How to test:**
1. Use extension for a few minutes
2. Reload window
3. Check statistics - data should still be there

**Verify file exists:**
```bash
ls ~/.config/Cursor/User/globalStorage/your-publisher-name.vibeswitch/
# Should see: telemetry.json
```

### Test 5.2: Opt-Out Works
- [ ] Disabling telemetry stops tracking
- [ ] Meter still shows but doesn't update
- [ ] Existing data preserved

**How to test:**
1. Open Settings
2. Search "vibeswitch"
3. Uncheck "Enable Telemetry"
4. Perform actions
5. Verify scores don't change

### Test 5.3: Export Functionality
- [ ] Export opens JSON document
- [ ] Data is complete
- [ ] Data is valid JSON

**How to test:**
1. `Ctrl+Shift+P` → "VibeSwitch: Export Usage Statistics"
2. Verify JSON document opens
3. Check data structure

### Test 5.4: Reset Functionality
- [ ] Reset prompts for confirmation
- [ ] Reset clears all data
- [ ] Scores reset to 0

**How to test:**
1. `Ctrl+Shift+P` → "VibeSwitch: Reset Usage Statistics"
2. Click "Yes, Reset"
3. Check statistics - should be empty

---

## 🎨 Test Suite 6: Visual Polish

### Test 6.1: Icons Display Correctly
- [ ] Mode indicator icons (dashboard, book)
- [ ] Meter emojis (rocket, lightning, colors)
- [ ] No broken icons

### Test 6.2: Layout & Spacing
- [ ] Mode and meter adjacent (no gap)
- [ ] Meter readable at all zoom levels
- [ ] No overlap with other status items

### Test 6.3: Performance
- [ ] No lag when updating meter
- [ ] No lag when opening statistics
- [ ] Extension doesn't slow Cursor

**How to test:**
1. Switch modes rapidly (5 times)
2. Note any lag or freezing
3. Check CPU usage (should be minimal)

---

## ⚠️ Test Suite 7: Edge Cases & Error Handling

### Test 7.1: No Workspace Open
- [ ] Meter hides gracefully
- [ ] No errors in console
- [ ] Extension doesn't crash

**How to test:**
1. Close all folders in Extension Development Host
2. Check status bar
3. Check Developer Console for errors

### Test 7.2: Missing Mode Files
- [ ] Prompt to create defaults
- [ ] Defaults created correctly
- [ ] Telemetry starts tracking

### Test 7.3: Corrupted Telemetry Data
- [ ] Extension handles gracefully
- [ ] Resets to defaults if needed
- [ ] No crash

**How to test:**
1. Manually corrupt telemetry.json (add invalid JSON)
2. Reload window
3. Verify extension still loads

### Test 7.4: Rapid Mode Switching
- [ ] No race conditions
- [ ] Scores update correctly
- [ ] No data loss

**How to test:**
1. Switch modes 10 times rapidly
2. Check statistics
3. Verify data looks reasonable

---

## 📋 Final Verification Checklist

### Visual Verification
- [ ] Two items in status bar (mode + meter)
- [ ] Meter shows 7 segments
- [ ] Emoji indicator present
- [ ] Colors appropriate for score
- [ ] Layout looks good

### Functional Verification
- [ ] All commands work
- [ ] Mode switching works
- [ ] Statistics show dual scores
- [ ] Telemetry tracks correctly
- [ ] Files update correctly

### Data Verification
- [ ] Separate VIBE and DEV scores
- [ ] Context-dependent scoring works
- [ ] Recommendations appropriate
- [ ] Data persists correctly

### Performance Verification
- [ ] No lag or freezing
- [ ] Low CPU usage
- [ ] Low memory usage
- [ ] Fast response times

---

## 🐛 Known Issues to Check

### Issue 1: Meter Not Updating
**Symptom:** Meter shows same value always  
**Check:** Telemetry enabled? Data saving?  
**Fix:** Verify `enableTelemetry` setting

### Issue 2: Wrong Score Showing
**Symptom:** VIBE score showing in DEV mode  
**Check:** `currentMode` detection  
**Fix:** Verify mode detection logic

### Issue 3: No Tooltip
**Symptom:** Hover doesn't show tooltip  
**Check:** `awarenessBarItem.tooltip` set?  
**Fix:** Verify tooltip assignment in code

### Issue 4: Meter Not Clickable
**Symptom:** Click doesn't open statistics  
**Check:** `awarenessBarItem.command` set?  
**Fix:** Verify command registration

---

## 🎯 Success Criteria

Extension is ready for packaging if:

- ✅ All test suites pass (80%+ tests)
- ✅ No console errors
- ✅ Visual meter displays correctly
- ✅ Dual scores work as expected
- ✅ Statistics dashboard enhanced
- ✅ Performance is acceptable
- ✅ Edge cases handled gracefully

---

## 📊 Test Results Log

### Test Session 1: [Date/Time]

**Tester:** [Your Name]  
**Environment:** Cursor [Version]

| Test Suite | Pass | Fail | Notes |
|------------|------|------|-------|
| Core Functionality | __/__ | __/__ | |
| Visual Meter | __/__ | __/__ | |
| Dual Score System | __/__ | __/__ | |
| Statistics Dashboard | __/__ | __/__ | |
| Telemetry System | __/__ | __/__ | |
| Visual Polish | __/__ | __/__ | |
| Edge Cases | __/__ | __/__ | |

**Overall:** __/__ tests passed

**Issues Found:**
1. 
2. 
3. 

**Ready for Release?** ☐ YES  ☐ NO

---

## 🚀 After Testing

If all tests pass:
```bash
cd /home/eventstorm1/vibeswitch-1/vibeswitch
vsce package
# Install and do final smoke test
```

If tests fail:
1. Document issues
2. Fix bugs
3. Re-test
4. Repeat until ready

---

**Good luck testing! 🧪**

