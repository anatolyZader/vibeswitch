# VibeSwitch Dual Awareness Scoring System

## 🎯 Why Separate Scores?

**Key Insight:** The same behavior means different things in different modes!

- In **VIBE mode**: Fast iteration and trust in automation = GOOD ✅
- In **DEV mode**: Careful verification and thorough review = GOOD ✅

Having a single awareness score would be misleading. What's "low awareness" in DEV mode might be "high confidence" in VIBE mode!

---

## 📊 The Two Scores

### ⚡ VIBE Mode Score (0-100)

**Measures:** Speed, productivity, confidence, trust in automation

**High Score (70+) means:**
- 🚀 Fast file modifications
- ⚡ Quick acceptance of changes
- 🎯 Confident iteration
- 💪 Trusting the automation
- ⚖️ Balanced session lengths

**Low Score (<40) means:**
- 🐢 Too hesitant
- 🔍 Over-checking settings
- ⏸️ Pausing too much
- 🤔 Second-guessing automation
- ❌ NOT using VIBE mode as intended

### 📚 DEV Mode Score (0-100)

**Measures:** Thoroughness, learning, verification, engagement

**High Score (80+) means:**
- 🔬 Deliberate code review
- ✅ Settings verification
- 📖 Documentation reading
- ✏️ Manual edits and refinement
- 🎓 Learning-focused sessions

**Low Score (<40) means:**
- 😴 Not paying attention
- ❌ Blind acceptance
- 📉 No verification
- 🚫 Missing learning opportunities
- ⚠️ Risk of bugs slipping through

---

## 🎨 Visual Meters in Status Bar

Right next to your mode indicator, you'll see a live awareness meter:

```
Status Bar:  [📚 DEV] [🟢 ███████]
                       ↑ Awareness meter
```

### Meter Components

1. **Emoji Indicator**
   - VIBE: 🚀 (70+), ⚡ (50+), 🟡 (30+), 🔴 (<30)
   - DEV: 🟢 (80+), 🟡 (60+), 🟠 (40+), 🔴 (<40)

2. **Bar Meter** (7 segments)
   - `█` = Filled (good zone)
   - `▆` = Medium (fair zone)
   - `▄` = Low (warning zone)
   - `░` = Empty

3. **Background Color**
   - Normal: Good score
   - Orange: Fair score (warning)
   - Red: Low score (alert)

### Examples

```
VIBE Mode:
🚀 ██████░  Score: 85/100 ← Excellent!
⚡ ████░░░  Score: 58/100 ← Good
🟡 ██░░░░░  Score: 30/100 ← Too hesitant
🔴 █░░░░░░  Score: 15/100 ← Over-thinking

DEV Mode:
🟢 ███████  Score: 92/100 ← Excellent!
🟡 █████░░  Score: 68/100 ← Good
🟠 ███░░░░  Score: 45/100 ← Fair
🔴 █░░░░░░  Score: 18/100 ← Low awareness
```

---

## 🧮 Scoring Algorithms

### VIBE Mode Formula

```javascript
vibeScore = 
  productivity (30%) +      // Fast file modifications
  trust (25%) +             // Auto-acceptance of changes
  balance (20%) +           // Not too fast, not too slow
  confidence (15%) +        // Limited status checking
  automation (10%)          // Trust the system
```

**Factors that INCREASE VIBE score:**
- ✅ Rapid file changes
- ✅ Auto-accepting edits
- ✅ Balanced session lengths
- ✅ Less frequent status checks
- ✅ Less settings verification

**Factors that DECREASE VIBE score:**
- ❌ Too many status checks (overthinking)
- ❌ Frequent settings verification (lack of trust)
- ❌ Too many quick switches (indecision)
- ❌ Low file modification rate (not productive)

### DEV Mode Formula

```javascript
devScore = 
  thoroughness (30%) +      // Deliberate review
  verification (25%) +      // Settings checking
  learning (20%) +          // Documentation reading
  engagement (15%) +        // Manual edits
  mindfulness (10%)         // Thoughtful sessions
```

**Factors that INCREASE DEV score:**
- ✅ Long, deliberate sessions
- ✅ Settings file verification
- ✅ Documentation reading
- ✅ Manual code edits
- ✅ Thoughtful engagement

**Factors that DECREASE DEV score:**
- ❌ Quick sessions (not reviewing)
- ❌ No settings verification (blind trust)
- ❌ No documentation reading (not learning)
- ❌ No manual edits (passive acceptance)
- ❌ Many quick switches (not focused)

---

## 🎭 Comparison: Same Behavior, Different Meanings

| Behavior | VIBE Mode | DEV Mode |
|----------|-----------|----------|
| **Checking status frequently** | 🔴 Bad (overthinking) | 🟢 Good (awareness) |
| **Viewing settings.json** | 🔴 Bad (lack of trust) | 🟢 Good (verification) |
| **Quick sessions** | 🟡 Neutral (iteration) | 🔴 Bad (not reviewing) |
| **Long sessions** | 🟢 Good (flow state) | 🟢 Good (thoroughness) |
| **Auto-accepting changes** | 🟢 Good (trust/speed) | 🔴 Bad (blind acceptance) |
| **Manual edits** | 🟢 Good (refinement) | 🟢 Good (engagement) |
| **Reading docs** | 🟡 Neutral | 🟢 Good (learning) |
| **Rapid file mods** | 🟢 Good (productivity) | 🟡 Neutral |

---

## 📈 Score Interpretation Guide

### VIBE Mode Ranges

| Score | Status | Interpretation | Action |
|-------|--------|----------------|--------|
| 80-100 | 🚀 Blazing | Perfect use of VIBE mode! | Keep it up! |
| 60-79 | ⚡ Fast | Good speed, confident | Minor optimizations |
| 40-59 | 🟡 Moderate | Some hesitation | Trust more, check less |
| 20-39 | 🟠 Hesitant | Too careful for VIBE | Consider DEV mode |
| 0-19 | 🔴 Overthinking | Not using VIBE properly | Switch to DEV mode |

### DEV Mode Ranges

| Score | Status | Interpretation | Action |
|-------|--------|----------------|--------|
| 90-100 | 🟢 Excellent | Masterful awareness | You're a pro! |
| 70-89 | 🟢 Very Good | Thorough and engaged | Great work! |
| 50-69 | 🟡 Good | Decent engagement | Verify more |
| 30-49 | 🟠 Fair | Low awareness | Review carefully |
| 0-29 | 🔴 Low | Blind acceptance | Major concern! |

---

## 💡 Usage Recommendations

### When to Use VIBE Mode
- ✅ Boilerplate code generation
- ✅ Refactoring known patterns
- ✅ Rapid prototyping
- ✅ Repetitive tasks
- ✅ When you're confident and experienced

**Aim for:** VIBE score 65-85  
**Too low (<50)?** You're overthinking, trust the AI more  
**Too high (>90)?** Might be going too fast, occasional review helps

### When to Use DEV Mode
- ✅ Learning new frameworks
- ✅ Critical business logic
- ✅ Complex algorithms
- ✅ Security-sensitive code
- ✅ When code review is important

**Aim for:** DEV score 75-95  
**Too low (<60)?** You're not engaged enough, review more carefully  
**Too high (>95)?** Perfect, but might be slower than needed

---

## 🎯 Optimal Patterns

### Balanced User (Recommended)
```
VIBE Score: 70-80
DEV Score: 75-85

Pattern: Uses VIBE for routine work, DEV for critical code
Result: Fast AND aware!
```

### Speed Demon
```
VIBE Score: 85+
DEV Score: 50-60

Pattern: Heavy VIBE user, minimal DEV usage
Risk: May miss subtle bugs in fast mode
Recommendation: Increase DEV mode usage for reviews
```

### Careful Learner
```
VIBE Score: 40-50
DEV Score: 90+

Pattern: Primarily DEV mode, careful with VIBE
Benefit: High awareness, excellent learning
Trade-off: Slower development speed
```

### At Risk
```
VIBE Score: 30-
DEV Score: 30-

Pattern: Low engagement in both modes
⚠️ WARNING: Blind acceptance risk!
Action: Review SETTINGS-COMPARISON.md, use DEV mode more
```

---

## 📊 Real-World Examples

### Example 1: Experienced Developer
```
Week 1:
VIBE: 78 🚀  "Fast and confident"
DEV: 82 🟢   "Thorough when needed"

Insight: Optimal balance! Uses modes appropriately.
```

### Example 2: Learning Phase
```
Week 1:
VIBE: 42 🟡  "Too hesitant in VIBE"
DEV: 88 🟢   "Excellent in DEV"

Recommendation: Trust automation more in VIBE mode.
              Current pattern is safe but slow.
```

### Example 3: Speed Addiction
```
Week 1:
VIBE: 92 🚀  "Extremely fast"
DEV: 35 🔴   "Low awareness in DEV"

⚠️ WARNING: When using DEV mode, not reviewing carefully!
Action: Slow down in DEV mode, verify changes thoroughly.
```

### Example 4: Over-Cautious
```
Week 1:
VIBE: 25 🔴  "Overthinking everything"
DEV: 78 🟢   "Good in DEV"

Recommendation: VIBE score too low - you're using it like DEV mode.
              Either trust the automation or stay in DEV mode.
```

---

## 🔍 FAQ

### Q: Can I have high scores in both modes?
**A:** Yes! This is ideal. It means you're fast and confident in VIBE, thorough and engaged in DEV.

### Q: My VIBE score is 35, is that bad?
**A:** It depends! If you're new to AI coding, being cautious is fine. But in VIBE mode, the goal is speed. Consider using DEV mode more if you need to be careful.

### Q: My DEV score is only 40, should I worry?
**A:** Yes! DEV mode is about careful review. A low score suggests blind acceptance. Take time to verify settings, read docs, and review changes thoroughly.

### Q: The scores seem opposite - one is high when the other is low?
**A:** That's actually good! It means you're adapting your behavior to the mode. Fast in VIBE, careful in DEV = perfect!

### Q: Can I see both scores at once?
**A:** The status bar shows the score for your CURRENT mode. View full statistics (`VibeSwitch: Show Usage Statistics`) to see both scores side-by-side.

### Q: How often do scores update?
**A:** Real-time! Every action updates your score. The status bar meter refreshes when you switch modes or take tracked actions.

---

## 🎓 Training Your Awareness

### Week 1: Understanding
- [ ] Read this document fully
- [ ] Check status bar meter daily
- [ ] View statistics 2-3 times
- [ ] Notice which actions change your score

### Week 2: Adjusting
- [ ] Try to improve lower score
- [ ] Practice mode-appropriate behavior
- [ ] Review recommendations
- [ ] Aim for 60+ in both modes

### Week 3: Optimizing
- [ ] Fine-tune your workflow
- [ ] Experiment with different patterns
- [ ] Find your optimal balance
- [ ] Maintain 70+ scores

### Week 4: Mastery
- [ ] Consistent high scores
- [ ] Automatic mode switching
- [ ] Teaching others
- [ ] Contributing insights

---

## 📞 Quick Reference

### Check Your Scores
- **Status bar:** Shows current mode's score with visual meter
- **Full stats:** `Ctrl+Shift+P` → "VibeSwitch: Show Usage Statistics"
- **Click meter:** Opens detailed statistics

### Score Goals
- **VIBE:** 65-85 (fast and confident)
- **DEV:** 75-95 (thorough and engaged)

### Improve VIBE Score
- ✅ Modify files rapidly
- ✅ Accept changes quickly
- ✅ Check status less often
- ✅ Trust the system more

### Improve DEV Score
- ✅ Review settings after switches
- ✅ Read documentation
- ✅ Edit AI code manually
- ✅ Take time to understand

---

**Remember:** Different modes, different goals, different scores! 🎯

---

**Last Updated:** 2024-12-03  
**Version:** 2.0.0 (Dual-Score System)


