# Telemetry & Awareness Tracking

**Understanding your AI collaboration patterns through local-only data.**

---

## 🎯 Two Levels of Awareness

VibeSwitch tracks your AI collaboration in two complementary ways:

### 1. 📡 Real-Time Monitoring (DEV Mode Only)
**What:** Live awareness meter in status bar  
**Window:** Last 10 AI suggestions  
**Updates:** Every 10 seconds  
**Purpose:** Immediate feedback on current behavior

### 2. 📊 Long-Term Statistics (Both Modes)
**What:** Historical usage dashboard  
**Window:** All time (since install)  
**Updates:** Continuous  
**Purpose:** Pattern analysis and habit awareness

---

## 🔒 Privacy First

### 100% Local, 0% Remote

- ✅ **All data stored on YOUR machine only**
- ✅ **Never sent to any server, ever**
- ✅ **No network requests**
- ✅ **No third-party analytics**
- ✅ **Fully transparent and auditable**

### Where Data Lives

```
your-project/
└── .vibeswitch-telemetry.json  ← All statistics here
```

**This is a plain JSON file. Open it anytime to see everything we track.**

### Opt-Out Anytime

```json
{
  "vibeswitch.enableTelemetry": false
}
```

Disables both real-time monitoring and long-term statistics.

---

## 📡 Real-Time Awareness Monitoring

### What It Tracks (DEV Mode)

When you're in DEV mode, VibeSwitch watches your interaction with AI-generated code:

| Event | What We Detect | Why It Matters |
|-------|----------------|----------------|
| **AI Code Detection** | Text changes >50 chars, multiline, fast insertion | Identifies AI suggestions |
| **Cursor Position** | Where your cursor is after AI suggests code | Did you review it? |
| **Hover Time** | How long you hover over AI code | Depth of review |
| **Edit Detection** | User modifications to AI suggestions | Are you adapting or accepting blindly? |
| **Rejection Tracking** | Undo/revert of AI code | Critical evaluation |

### The Real-Time Score (0-100%)

Calculated from **3 metrics**:

#### 1. Review Rate (0-40 points)
**Question:** Did you actually read the AI code?

```
Time spent hovering/scrolling AI code:
  < 3 seconds   → 0 points  (blind acceptance)
  3-5 seconds   → 15 points (quick glance)
  5-10 seconds  → 30 points (decent review)
  > 10 seconds  → 40 points (thorough review)
```

#### 2. Critical Evaluation (0-30 points)
**Question:** Do you reject questionable suggestions?

```
Acceptance rate (last 10 suggestions):
  100% accepted → 0 points  (no critical thinking)
  80-99%        → 10 points (rarely skeptical)
  50-79%        → 20 points (somewhat critical)
  < 50%         → 30 points (highly critical)
```

#### 3. Code Adaptation (0-30 points)
**Question:** Do you make AI code your own?

```
Edit rate (last 10 suggestions):
  0% edited     → 0 points  (accepting as-is)
  1-25%         → 10 points (occasional tweaks)
  26-50%        → 20 points (frequent adaptation)
  > 50%         → 30 points (heavy customization)
```

### Inverted Logic (DEV Mode)

⚠️ **Critical:** In DEV mode, **LOW score = GOOD behavior**

```
🔴 Red (80-100%)    = Blind acceptance (bad)
🟠 Orange (60-79%)  = Too trusting (warning)
🟡 Yellow (40-59%)  = Moderate (caution)
🟢 Green (0-39%)    = Careful review (good)
```

**Why inverted?** Because DEV mode is about **skepticism and control**. High trust = Wrong mode.

### Example Scenarios

#### Scenario: Green Meter (Good)
```
User: "Add error handling"
AI: [Suggests 20 lines]

Behavior:
- Reads code for 12 seconds ✓ (40 pts)
- Notices missing edge case ✓
- Rejects suggestion ✓ (30 pts)
- Accepts revised version with edits ✓ (20 pts)

Score: 90/100 → Inverted → 10% → 🟢 Green
```

#### Scenario: Red Meter (Bad)
```
User: "Add error handling"
AI: [Suggests 20 lines]

Behavior:
- Glances for 1 second ✗ (0 pts)
- Presses Tab to accept ✗ (0 pts)
- Moves on immediately ✗ (0 pts)

Score: 0/100 → Inverted → 100% → 🔴 Red
```

---

## 📊 Long-Term Statistics Dashboard

### How to Access

```
Ctrl+Shift+P → "VibeSwitch: Show Collaboration Statistics"
```

Opens a detailed report in a new editor tab.

### What You'll See

#### 1. Summary Section
```
═══════════════════════════════════════════════════
               VIBESWITCH STATISTICS
═══════════════════════════════════════════════════

Total Sessions: 127
Total Switches: 89
First Use: 2025-01-15 14:22:13
Last Use: 2025-12-06 09:45:22
Days Active: 325
```

#### 2. Mode Usage Breakdown
```
⚡ VIBE MODE (Autonomous Flow)
─────────────────────────────────────────────────
Total Time:       142h 35m 18s (62.3%)
Sessions:         67
Avg Duration:     2h 7m 34s
Switches In:      45
Switches Out:     44
```

```
📚 DEV MODE (Collaborative Control)
─────────────────────────────────────────────────
Total Time:       86h 12m 41s (37.7%)
Sessions:         60
Avg Duration:     1h 26m 12s
Switches In:      44
Switches Out:     45
```

#### 3. Switch Patterns
```
Switch History (Last 20):
1. 2025-12-06 09:30:15 | DEV → VIBE  | Duration: 45m 12s
2. 2025-12-06 08:22:03 | VIBE → DEV  | Duration: 1h 23m 45s
3. 2025-12-05 16:45:22 | DEV → VIBE  | Duration: 2h 14m 32s
...
```

#### 4. Behavioral Insights
```
Quick Switches (< 5 minutes):    12 (13.5%)
Short Sessions (< 30 minutes):   34 (26.8%)
Long Sessions (> 2 hours):       28 (22.0%)

Most Common Pattern:
  VIBE (2h 15m avg) → DEV (1h 30m avg) → VIBE
```

#### 5. Recommendations
```
💡 Recommendations:

✓ Good balance between modes (60% VIBE / 40% DEV)
⚠ 12 quick switches detected - consider being more deliberate
✓ Long average session times indicate focused work
```

### What's NOT Tracked

We deliberately **don't** track:

- ❌ Specific code content
- ❌ File names or paths
- ❌ Keystrokes or text input
- ❌ Git commits or repositories
- ❌ Personal information
- ❌ Cursor AI responses

**Only metadata about when/how you use modes.**

---

## 📈 Understanding Your Patterns

### Healthy Patterns

✅ **Balanced Mode Usage** (40-60% each)
- You use both modes appropriately
- Context-driven decisions

✅ **Long Session Durations** (> 30 min avg)
- Focused work, not jumping around
- Deliberate mode choices

✅ **Low Quick-Switch Rate** (< 10%)
- You commit to a mode
- Not confused or uncertain

### Warning Signs

⚠️ **Extreme Imbalance** (>90% one mode)
- May indicate mode stuck-ness
- Not adapting to context

⚠️ **High Quick-Switch Rate** (>25%)
- Uncertainty about which mode to use
- Possible confusion about mode behavior

⚠️ **Very Short Sessions** (<10 min avg)
- Fragmented workflow
- Not giving modes a fair try

---

## 🔬 How Tracking Works Technically

### Real-Time Monitoring (awareness-monitor.js)

```javascript
// Event listeners on VS Code API
vscode.workspace.onDidChangeTextDocument()  // Detects AI code
vscode.window.onDidChangeTextEditorSelection()  // Cursor movement
vscode.window.onDidChangeActiveTextEditor()  // File switching
```

**AI Detection Heuristic:**
```javascript
if (change.text.length > 50 && 
    change.text.includes('\n') && 
    timeSinceLast < 500ms) {
  // Likely AI-generated
}
```

### Long-Term Statistics (telemetry.js)

```javascript
{
  "startTime": 1704467533000,
  "lastUpdate": 1733479522000,
  "modes": {
    "vibe": {
      "totalTime": 513318000,
      "sessionCount": 67,
      "switchCount": 45
    },
    "dev": {
      "totalTime": 310361000,
      "sessionCount": 60,
      "switchCount": 44
    }
  },
  "switches": [
    { "from": "vibe", "to": "dev", "timestamp": 1733479522000, "duration": 45000 }
  ]
}
```

**Stored in:** `.vibeswitch-telemetry.json`

---

## 🎯 Using Statistics to Improve

### Self-Assessment Questions

After reviewing your statistics, ask:

1. **Mode Balance**
   - Am I overusing one mode?
   - Does my balance match my work type?

2. **Session Quality**
   - Are my sessions focused or fragmented?
   - Do I give each mode a fair try?

3. **Switch Behavior**
   - Am I switching reactively or proactively?
   - Do I understand why I switch?

4. **Real-Time Score** (DEV mode)
   - Is my meter usually green (good)?
   - When does it turn red (blind acceptance)?
   - What triggers my autopilot mode?

### Action Items

Based on your patterns:

**If you're always in VIBE (>80%):**
- Try DEV mode for learning tasks
- Practice critical evaluation
- Slow down occasionally

**If you're always in DEV (>80%):**
- Try VIBE for rapid prototyping
- Trust AI more on non-critical code
- Embrace flow state

**If you have many quick switches:**
- Read mode documentation
- Be more deliberate about mode choice
- Commit to a mode for at least 30 min

**If DEV mode meter is always red:**
- You're not really in DEV mode
- Switch to VIBE (be honest) OR
- Slow down and review code carefully

---

## 🗂️ Managing Your Data

### Export Statistics

```
Ctrl+Shift+P → "VibeSwitch: Export Statistics to JSON"
```

Saves full data to a timestamped file:
```
vibeswitch-stats-2025-12-06.json
```

Use for:
- Personal analysis
- Backup before reset
- Sharing patterns (anonymously)

### Reset Statistics

```
Ctrl+Shift+P → "VibeSwitch: Reset Statistics"
```

**Warning:** This deletes all historical data. Export first if you want to keep it!

After reset:
- Starts fresh from scratch
- Clears all sessions, switches, patterns
- Awareness meter resets to 0%

### Disable Telemetry

In settings:
```json
{
  "vibeswitch.enableTelemetry": false
}
```

**Effect:**
- Real-time awareness meter disabled
- No new statistics collected
- Existing data preserved (until reset)
- Status bar still shows mode indicator

---

## 🧪 Testing the Tracking

### Verify Real-Time Monitoring

1. Switch to DEV mode
2. Open Developer Console: `Ctrl+Shift+I`
3. Create `test.js`
4. Type: `// function to add numbers`
5. Accept AI suggestion with Tab

**Expected console output:**
```
AwarenessMonitor: Detected AI suggestion (id: abc123)
AwarenessMonitor: Text length: 85 chars, 4 lines
AwarenessMonitor: User review time: 1200ms
AwarenessMonitor: Score updated: 88% (🔴)
```

### Verify Long-Term Statistics

1. Switch modes a few times (VIBE→DEV→VIBE)
2. Work for 5+ minutes in each mode
3. Open statistics: `Ctrl+Shift+P` → "Show Statistics"

**Expected report:**
- Switch count increased
- Session times recorded
- Timestamps match your activity

---

## 💡 Philosophy

### Why Track at All?

**Awareness requires measurement.**

You can't improve what you don't observe. VibeSwitch makes your AI collaboration visible, so you can:

1. **Recognize patterns** - "I always go on autopilot after lunch"
2. **Calibrate trust** - "I'm too skeptical / too trusting"
3. **Match mode to task** - "Prototyping = VIBE, refactoring = DEV"
4. **Stay conscious** - "The red meter is a wake-up call"

### The Mirror Effect

The awareness meter is a **mirror**, not a judge:

- It doesn't tell you what mode to choose
- It doesn't say blind acceptance is always wrong
- It just shows: **Is your behavior matching your claimed mode?**

If you're in DEV with a red meter, you're lying to yourself. The extension holds up the mirror.

**Honesty → Awareness → Control → Mastery**

---

## 📚 Related Documentation

- **[Visual Overview](VISUAL-OVERVIEW.md)** - Understanding the meter UI
- **[Awareness Testing](AWARENESS-TESTING.md)** - Structured exercises
- **[Main README](README.md)** - Full documentation

---

## 🎯 Key Takeaways

1. **Real-time monitoring** = Immediate feedback (DEV mode only)
2. **Long-term statistics** = Pattern awareness (both modes)
3. **100% local** = Your data never leaves your machine
4. **Inverted score** = Low is good in DEV mode (skepticism > trust)
5. **Awareness meter** = Mirror, not judge (honesty matters)

**Use the data to stay conscious. Stay in control. Master your vibe.** 🧠📊
