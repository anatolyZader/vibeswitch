# Real-Time Awareness Monitor - Testing Guide

## Installation

1. **Uninstall old version** (if installed):
   - `Ctrl+Shift+P` → "Extensions: Show Installed Extensions"
   - Find "VibeSwitch", click gear icon → Uninstall
   - Reload Cursor

2. **Install new version**:
   - `Ctrl+Shift+P` → "Extensions: Install from VSIX"
   - Select: `/home/eventstorm1/vibeswitch-1/vibeswitch/vibeswitch-1.0.0.vsix`
   - Reload Cursor

3. **Verify installation**:
   - Check status bar (bottom right) shows mode indicator
   - Switch to DEV mode (`Ctrl+Shift+M` → select DEV Mode)
   - Awareness meter should appear (initially `🔴 ▱▱▱▱▱▱▱` or neutral)

---

## Test Plan Overview

| Test | Metric Tested | Expected Behavior |
|------|---------------|-------------------|
| **Test 1** | AI Detection | Detects AI code insertions |
| **Test 2** | Review Tracking | Tracks cursor review time |
| **Test 3** | Accept/Reject | Classifies unchanged code as accepted |
| **Test 4** | Adaptation | Detects user edits to AI code |
| **Test 5** | Score Calculation | Updates score every 10s |
| **Test 6** | Rolling Window | Keeps only last 10 suggestions |
| **Test 7** | Mode Switch | Stops monitoring in VIBE mode |

---

## Pre-Test Setup

### 1. Open Debug Console
- In Cursor: `Ctrl+Shift+Y` or View → Debug Console
- You'll see real-time logs from the monitor

### 2. Create Test File
Create a new file: `test-awareness.js`

```javascript
// Test file for awareness monitoring
console.log("Starting test");
```

### 3. Enable DEV Mode
- Press `Ctrl+Shift+M`
- Select "DEV Mode"
- Look for: `AwarenessMonitor: Starting real-time monitoring`

---

## Test 1: AI Code Detection

**Goal**: Verify system detects AI-generated code

### Steps:

1. **Trigger Cursor AI suggestion**:
   - Type: `// write a function to calculate fibonacci`
   - Press `Tab` or accept Cursor's suggestion
   - AI should insert a multi-line function

2. **Check Debug Console**:
   - Look for: `AwarenessMonitor: Detected AI suggestion (XXX chars)`
   
3. **Check Meter Tooltip**:
   - Hover over awareness meter in status bar
   - Should show: `Suggestions tracked: 1`
   - Should show: `Pending: 1`

**Expected Result**: ✅ AI code detected and tracked

**Troubleshooting**:
- If not detected: AI code might be <50 chars (too small)
- Try larger suggestions: "write a class with 5 methods"

---

## Test 2: Code Review Tracking

**Goal**: Verify system tracks cursor position and review time

### Steps:

1. **Accept an AI suggestion** (from Test 1)

2. **Move cursor AWAY from AI code**:
   - Move to a different line (outside the suggestion)
   - Wait 2 seconds

3. **Move cursor INTO AI code**:
   - Place cursor on a line of the AI-generated code
   - Keep cursor there for 10 seconds

4. **Check Debug Console**:
   - Look for: `AwarenessMonitor: User reviewing AI suggestion`

5. **Move cursor AWAY again**:
   - Go to different line
   - Review time should be accumulated

6. **Wait 10+ seconds for score update**

7. **Hover over meter**:
   - Tooltip should show Review score > 0

**Expected Result**: ✅ Review time tracked, score increases

---

## Test 3: Accept Classification

**Goal**: Verify unchanged AI code is classified as "accepted"

### Steps:

1. **Accept AI suggestion** (don't edit it)

2. **Move cursor away** (don't touch the AI code)

3. **Wait 6 seconds** (classification happens at T+5s)

4. **Check Debug Console**:
   - Look for: `AwarenessMonitor: Suggestion accepted`

5. **Wait for next score update** (up to 10s more)

6. **Hover over meter**:
   - Should show: `Accepted: 1`
   - Critical score should be 0 (100% acceptance = blind trust)

**Expected Result**: ✅ Code classified as accepted, low critical score

---

## Test 4: Code Adaptation

**Goal**: Verify user edits are detected

### Steps:

1. **Accept AI suggestion**

2. **Edit the AI code**:
   - Add a comment: `// my modification`
   - Change a variable name
   - Add a line of code

3. **Check Debug Console**:
   - Look for: `AwarenessMonitor: User edited AI suggestion`

4. **Wait 6 seconds** (for classification)

5. **Check Debug Console**:
   - Look for: `AwarenessMonitor: Suggestion adapted`

6. **Wait for score update**

7. **Hover over meter**:
   - Should show: `Adapted: 1`
   - Adaptation score should be > 0

**Expected Result**: ✅ Edits detected, classified as adapted

---

## Test 5: Code Rejection

**Goal**: Verify deleted AI code is classified as "rejected"

### Steps:

1. **Accept AI suggestion**

2. **Delete the AI code**:
   - Select all the AI-generated lines
   - Press `Delete` or `Backspace`

3. **Wait 6 seconds**

4. **Check Debug Console**:
   - Look for: `AwarenessMonitor: Suggestion rejected`

5. **Wait for score update**

6. **Hover over meter**:
   - Should show: `Rejected: 1`
   - Critical score should be > 0 (shows selectiveness)

**Expected Result**: ✅ Deletion detected, classified as rejected

---

## Test 6: Score Calculation & Updates

**Goal**: Verify score updates every 10 seconds

### Steps:

1. **Generate mixed behavior**:
   - Accept 3 AI suggestions (review each for 5+ seconds)
   - Adapt 2 AI suggestions (edit them)
   - Reject 1 AI suggestion (delete it)

2. **Watch Debug Console every 10 seconds**:
   - Look for: `AwarenessMonitor: Score updated - XX/100 (R:XX, C:XX, A:XX)`

3. **Watch status bar meter**:
   - Should update from `🔴` → `🟠` → `🟡` → `🟢` as score improves
   - Bar should fill: `▱▱▱▱▱▱▱` → `▰▰▰▰▱▱▱` → `▰▰▰▰▰▰▰`

4. **Hover over meter after each update**:
   - Verify numbers match console log
   - Verify suggestion counts are correct

**Expected Result**: 
✅ Score updates every 10s
✅ Meter visual matches score
✅ Tooltip shows accurate breakdown

---

## Test 7: Rolling Window (10 Suggestions Max)

**Goal**: Verify only last 10 suggestions are tracked

### Steps:

1. **Generate 15 AI suggestions**:
   - Ask Cursor AI to generate 15 different functions
   - Accept them one by one

2. **Check Debug Console**:
   - Count "Detected AI suggestion" messages (should be 15)

3. **Hover over meter**:
   - Should show: `Suggestions tracked: 10` (not 15!)
   - First 5 suggestions should be evicted

4. **Verify in tooltip**:
   - Total counts should only reflect last 10

**Expected Result**: ✅ Only 10 most recent suggestions tracked

---

## Test 8: Mode Switching

**Goal**: Verify monitor stops in VIBE mode, restarts in DEV mode

### Steps:

1. **In DEV mode with suggestions tracked**:
   - Hover over meter → note current score/suggestions

2. **Switch to VIBE mode** (`Ctrl+Shift+M` → VIBE)

3. **Check Debug Console**:
   - Look for: `VibeSwitch: Stopped awareness monitoring (VIBE mode)`

4. **Check status bar**:
   - Awareness meter should DISAPPEAR (only mode indicator visible)

5. **Accept some AI suggestions in VIBE mode**:
   - They should NOT be tracked (no debug messages)

6. **Switch back to DEV mode**

7. **Check Debug Console**:
   - Look for: `AwarenessMonitor: Starting real-time monitoring`

8. **Check meter**:
   - Should reappear with FRESH state (0 suggestions, neutral score)

**Expected Result**: 
✅ Monitoring stops in VIBE
✅ Monitoring restarts clean in DEV

---

## Test 9: Edge Cases

### 9a. Fast Consecutive Suggestions
1. Accept 3 AI suggestions rapidly (within 10 seconds)
2. All should be detected
3. Classification should happen for each at T+5s

### 9b. Overlapping Code Regions
1. Accept AI suggestion A (lines 10-20)
2. Accept AI suggestion B (lines 15-25)
3. Both should be tracked separately
4. Edits to overlap region should count for both

### 9c. File Switching
1. Accept AI in file A
2. Switch to file B
3. Accept AI in file B
4. Both should be tracked (by file URI)

### 9d. Large AI Suggestion
1. Ask Cursor to generate 200+ line class
2. Should be detected (>50 chars)
3. Review tracking should work across all lines

### 9e. Small AI Suggestion
1. Ask Cursor for single-line completion (<50 chars)
2. Should NOT be detected (below threshold)
3. This is expected behavior

---

## Test 10: Score Interpretation

### Scenario A: Blind Accepter
- Accept 10 suggestions without review
- Never edit them
- **Expected Score**: ~0-20/100 🔴
  - Review: 0/40 (no cursor review)
  - Critical: 0/30 (100% acceptance)
  - Adaptation: 0/30 (no edits)

### Scenario B: Careful Reviewer
- Review all 10 suggestions (10+ seconds each)
- Accept 7, reject 2, adapt 1
- Edit the adapted one multiple times
- **Expected Score**: ~75-85/100 🟢
  - Review: 35-40/40 (thorough review)
  - Critical: 25-30/30 (selective)
  - Adaptation: 15-20/30 (some adaptation)

### Scenario C: Power Adapter
- Review all 10 suggestions briefly (5 seconds each)
- Adapt 8 of them (2-3 edits each)
- Accept 2 as-is
- **Expected Score**: ~70-80/100 🟡
  - Review: 25-30/40 (medium review)
  - Critical: 20-25/30 (mostly adapting)
  - Adaptation: 25-30/30 (heavy editing)

---

## Success Criteria

| Requirement | Pass? |
|-------------|-------|
| ✅ Detects AI code (>50 chars) | ☐ |
| ✅ Tracks cursor review time | ☐ |
| ✅ Classifies: accepted, rejected, adapted | ☐ |
| ✅ Detects user edits | ☐ |
| ✅ Updates score every 10s | ☐ |
| ✅ Keeps rolling window of 10 | ☐ |
| ✅ Stops in VIBE mode | ☐ |
| ✅ Starts fresh in DEV mode | ☐ |
| ✅ Shows accurate tooltip | ☐ |
| ✅ Visual meter matches score | ☐ |

---

## Debugging Tips

### If AI Not Detected:
- Check Debug Console for "Detected AI suggestion"
- Verify suggestion is >50 chars and multi-line
- Try asking Cursor for larger code blocks

### If Review Not Tracked:
- Ensure cursor is ON the AI code (same line range)
- Check Debug Console for "User reviewing AI suggestion"
- Try moving cursor very explicitly onto AI lines

### If Classification Wrong:
- Check 5-second delay has passed
- Verify document is still open
- Look for "Suggestion [accepted|rejected|adapted]" in console

### If Score Not Updating:
- Wait full 10 seconds
- Check Debug Console for "Score updated"
- Verify you're in DEV mode

### If No Logs Appear:
- Extension might not be loaded
- Reload Cursor window
- Check extension is installed and enabled

---

## Next Steps After Testing

Once tests pass:
1. Report any failures or unexpected behavior
2. Discuss score calibration (are thresholds reasonable?)
3. Consider UI enhancements (visual feedback during review?)
4. Plan for long-term data collection (optional persistence?)

---

**Ready to test!** Install the new VSIX and follow the test plan step by step.



