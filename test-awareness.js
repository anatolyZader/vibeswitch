// VibeSwitch Awareness Monitor - Quick Test Script
// Follow these steps in order and observe the Debug Console

/*
==============================================
SETUP (Do Once)
==============================================
1. Install vibeswitch-1.0.0.vsix (Ctrl+Shift+P → Install from VSIX)
2. Reload Cursor
3. Open Debug Console (Ctrl+Shift+Y)
4. Switch to DEV mode (Ctrl+Shift+M → DEV Mode)
5. Look for: "AwarenessMonitor: Starting real-time monitoring"
6. Create this test file (test-awareness.js)
*/

// TEST 1: AI Detection
// Step: Delete the line below and ask Cursor to regenerate it
// Expected: "AwarenessMonitor: Detected AI suggestion (XXX chars)"
function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }

// TEST 2: Review Tracking
// Step: Place cursor on the fibonacci function above for 10+ seconds
// Expected: "AwarenessMonitor: User reviewing AI suggestion"

// TEST 3: Accept Classification
// Step: Ask Cursor to write a new function below, then DON'T touch it
// Wait 6 seconds
// Expected: "AwarenessMonitor: Suggestion accepted"

// [Space for Cursor to insert function]


// TEST 4: Code Adaptation
// Step: Ask Cursor to write another function below, then EDIT it (add comment, rename var)
// Expected: "AwarenessMonitor: User edited AI suggestion"
// Then after 6s: "AwarenessMonitor: Suggestion adapted"

// [Space for Cursor to insert function]


// TEST 5: Code Rejection
// Step: Ask Cursor to write a function below, then DELETE it completely
// Wait 6 seconds
// Expected: "AwarenessMonitor: Suggestion rejected"

// [Space for Cursor to insert function]


// TEST 6: Score Updates
// Step: After accumulating 5+ suggestions above, watch for score updates every 10s
// Expected: "AwarenessMonitor: Score updated - XX/100 (R:XX, C:XX, A:XX)"
// Check status bar meter: should show 🟠 or 🟡 with filled bars ▰▰▰▱▱▱▱


// TEST 7: Rolling Window
// Step: Generate 15 functions (ask Cursor 15 times)
// Hover over meter
// Expected: "Suggestions tracked: 10" (only last 10 kept)


// TEST 8: Mode Switch
// Step: Switch to VIBE mode (Ctrl+Shift+M → VIBE)
// Expected: "VibeSwitch: Stopped awareness monitoring (VIBE mode)"
// Meter should DISAPPEAR from status bar
// Step: Switch back to DEV mode
// Expected: "AwarenessMonitor: Starting real-time monitoring"
// Meter should reappear with fresh state


/*
==============================================
RESULTS CHECKLIST
==============================================
After running all tests, verify:

[ ] AI suggestions detected (>50 chars)
[ ] Cursor review tracked (when cursor on AI code)
[ ] Accept classification works (unchanged code after 5s)
[ ] Adapt classification works (edited code after 5s)
[ ] Reject classification works (deleted code after 5s)
[ ] Score updates every 10 seconds
[ ] Status bar meter shows score visually
[ ] Tooltip shows accurate breakdown
[ ] Only last 10 suggestions tracked
[ ] Monitoring stops in VIBE mode
[ ] Monitoring restarts in DEV mode

==============================================
EXPECTED DEBUG CONSOLE OUTPUT (Example)
==============================================

VibeSwitch: Switched to DEV mode - active immediately!
AwarenessMonitor: Starting real-time monitoring
AwarenessMonitor: Monitoring active
AwarenessMonitor: Detected AI suggestion (156 chars)
AwarenessMonitor: User reviewing AI suggestion
AwarenessMonitor: Suggestion accepted
AwarenessMonitor: Detected AI suggestion (203 chars)
AwarenessMonitor: User edited AI suggestion
AwarenessMonitor: Suggestion adapted
AwarenessMonitor: Score updated - 45/100 (R:15, C:12, A:18)
AwarenessMonitor: Detected AI suggestion (178 chars)
AwarenessMonitor: Score updated - 52/100 (R:18, C:15, A:19)
...

==============================================
TROUBLESHOOTING
==============================================

Issue: No "Detected AI suggestion" messages
Fix: Ask Cursor for larger code blocks (>50 chars, multi-line)

Issue: No "User reviewing" messages
Fix: Make sure cursor is ON the AI-generated code lines

Issue: No score updates
Fix: Wait full 10 seconds, ensure you're in DEV mode

Issue: No logs at all
Fix: Extension not loaded - reload Cursor, check Extensions panel

==============================================
*/



