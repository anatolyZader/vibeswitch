const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const TelemetryManager = require('./telemetry');
const AwarenessMonitor = require('./awareness-monitor');

let statusBarItem;
let awarenessBarItem;
let currentMode = null;
let telemetry = null;
let awarenessMonitor = null;
let extensionContext = null;
let meterUpdateTimer = null;

/**
 * Validates that a path is within the workspace and doesn't contain dangerous patterns
 * @param {string} targetPath - Path to validate
 * @param {string} workspaceRoot - Workspace root path
 * @returns {boolean} True if path is safe
 */
function isPathSafe(targetPath, workspaceRoot) {
    const normalizedTarget = path.normalize(targetPath);
    const normalizedWorkspace = path.normalize(workspaceRoot);
    
    // Check for path traversal attempts
    if (normalizedTarget.includes('..')) {
        return false;
    }
    
    // Ensure path is within workspace
    if (!normalizedTarget.startsWith(normalizedWorkspace)) {
        return false;
    }
    
    return true;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('VibeSwitch extension is now active');
    
    // Store context globally
    extensionContext = context;

    // Initialize telemetry
    telemetry = new TelemetryManager(context);
    
    // Initialize awareness monitor (for real-time DEV mode tracking)
    awarenessMonitor = new AwarenessMonitor();

    // Create status bar items
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vibeswitch.switchMode';
    context.subscriptions.push(statusBarItem);

    // Create awareness meter bar item (appears right next to mode indicator)
    awarenessBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    awarenessBarItem.command = 'vibeswitch.showStats';
    context.subscriptions.push(awarenessBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.switchMode', showModePicker)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.toVibe', () => switchToMode('vibe'))
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.toDev', () => switchToMode('dev'))
    );

    // Register telemetry commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.showStats', showUsageStatistics)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.resetStats', resetUsageStatistics)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.exportStats', exportUsageStatistics)
    );

    // Initialize and show status bar
    updateStatusBar();
    statusBarItem.show();

    // Start awareness monitor if already in DEV mode
    if (currentMode === 'dev' && awarenessMonitor) {
        awarenessMonitor.start(extensionContext);
        console.log('VibeSwitch: Started awareness monitoring (already in DEV mode)');
        
        // Update meter every 10 seconds in DEV mode
        meterUpdateTimer = setInterval(() => {
            if (currentMode === 'dev') {
                updateAwarenessMeter();
            }
        }, 10000);
        
        // Initial meter update
        updateAwarenessMeter();
    }

    // Watch for .cursorrules changes
    watchForModeChanges();

    // Track file opens for awareness metrics
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (telemetry) {
                telemetry.trackFileOpen(document.fileName);
            }
        })
    );

    // Track edits for awareness metrics
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (telemetry && event.contentChanges.length > 0) {
                telemetry.trackEdit();
            }
        })
    );

    // Track saves
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            if (telemetry) {
                telemetry.trackFileSave();
            }
        })
    );

    // End telemetry session on deactivation
    context.subscriptions.push({
        dispose: () => {
            if (telemetry) {
                telemetry.endSession();
            }
        }
    });
}

function showModePicker() {
    // Track status bar click (awareness indicator)
    if (telemetry) {
        telemetry.trackStatusBarClick();
    }

    const modes = [
        {
            label: '$(zap) VIBE Mode',
            description: 'Autonomous - AI works independently with minimal interruptions',
            detail: 'Best for: Building features quickly, refactoring, prototyping',
            mode: 'vibe',
            picked: currentMode === 'vibe'  // Highlight if currently active
        },
        {
            label: '$(book) DEV Mode',
            description: 'Collaborative - AI explains and asks for approval',
            detail: 'Best for: Learning, understanding changes, careful review',
            mode: 'dev',
            picked: currentMode === 'dev'  // Highlight if currently active
        },
        {
            label: '$(info) Current: ' + (currentMode || 'Unknown'),
            description: 'View current mode',
            mode: null
        },
        {
            label: '$(graph) Usage Statistics',
            description: 'View your mode usage and awareness metrics',
            mode: 'stats'
        }
    ];

    vscode.window.showQuickPick(modes, {
        placeHolder: 'Select AI Agent Mode',
        title: 'VibeSwitch - Change AI Agent Behavior'
    }).then(selection => {
        if (selection) {
            if (selection.mode === 'stats') {
                showUsageStatistics();
            } else if (selection.mode) {
                switchToMode(selection.mode);
            }
        }
    });
}

/**
 * Get the settings configuration for a specific mode
 * @param {string} mode - 'vibe' or 'dev'
 * @returns {Object} Settings object for the mode
 */
function getModeSettings(mode) {
    const settings = {
        vibe: {
            "cursor.chat.defaultMode": "agent",
            "cursor.agent.requireApproval": false,
            "cursor.agent.autoApplyEdits": true,
            "cursor.ai.autoApply": true,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 1000
        },
        dev: {
            "cursor.chat.defaultMode": "ask",
            "cursor.agent.requireApproval": true,
            "cursor.agent.autoApplyEdits": false,
            "cursor.ai.autoApply": false,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 3000
        }
    };
    return settings[mode] || {};
}

/**
 * Apply mode settings programmatically using VS Code's configuration API
 * This applies settings immediately without requiring a window reload
 * @param {string} mode - 'vibe' or 'dev'
 * @param {boolean} skipCursorSettings - Skip cursor.* settings (they may trigger Cursor to reload)
 */
async function applyModeSettings(mode, skipCursorSettings = false) {
    const settings = getModeSettings(mode);
    const settingsCount = Object.keys(settings).length;
    console.log(`VibeSwitch: Applying ${settingsCount} settings for ${mode} mode...`);
    
    let appliedCount = 0;
    let skippedCount = 0;
    
    for (const [key, value] of Object.entries(settings)) {
        try {
            // Skip cursor.* settings if requested (Cursor may auto-reload when these change)
            if (skipCursorSettings && key.startsWith('cursor.')) {
                console.log(`VibeSwitch: ⏭️  SKIPPED ${key} (skipCursorSettings=true)`);
                skippedCount++;
                continue;
            }
            
            // Split key into section and property (e.g., "cursor.chat.defaultMode" -> ["cursor", "chat.defaultMode"])
            const firstDot = key.indexOf('.');
            if (firstDot === -1) {
                console.log(`VibeSwitch: ⚠️  INVALID ${key} (no dot in key)`);
                continue;
            }
            
            const section = key.substring(0, firstDot);
            const property = key.substring(firstDot + 1);
            
            console.log(`VibeSwitch: ⏳ Applying ${key} = ${JSON.stringify(value)}...`);
            const config = vscode.workspace.getConfiguration(section);
            await config.update(property, value, vscode.ConfigurationTarget.Workspace);
            console.log(`VibeSwitch: ✅ Applied ${key} = ${JSON.stringify(value)}`);
            appliedCount++;
        } catch (error) {
            // Some settings may not exist in all editors (e.g., cursor.* in VS Code)
            console.log(`VibeSwitch: ❌ Failed to apply ${key}: ${error.message}`);
        }
    }
    
    console.log(`VibeSwitch: Settings summary - Applied: ${appliedCount}, Skipped: ${skippedCount}, Total: ${settingsCount}`);
}

async function switchToMode(mode) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    // Validate mode parameter
    const validModes = ['vibe', 'dev'];
    if (!validModes.includes(mode)) {
        vscode.window.showErrorMessage(`Invalid mode: ${mode}`);
        console.error('VibeSwitch: Invalid mode attempted:', mode);
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const customPath = config.get('rulesPath');
    const basePath = customPath || workspaceRoot;

    // Validate custom path if provided
    if (customPath) {
        const resolvedPath = path.resolve(workspaceRoot, customPath);
        if (!isPathSafe(resolvedPath, workspaceRoot)) {
            vscode.window.showErrorMessage('Invalid custom rules path');
            console.error('VibeSwitch: Unsafe custom path detected:', customPath);
            return;
        }
    }

    try {
        // Define file paths for .cursorrules
        const cursorrules = path.join(basePath, '.cursorrules');
        const sourceRules = path.join(basePath, `.cursorrules.${mode}`);

        // Validate paths are safe
        if (!isPathSafe(cursorrules, workspaceRoot) || 
            !isPathSafe(sourceRules, workspaceRoot)) {
            vscode.window.showErrorMessage('Invalid file path detected');
            console.error('VibeSwitch: Path validation failed');
            return;
        }

        // Check if source .cursorrules file exists
        if (!fs.existsSync(sourceRules)) {
            const create = await vscode.window.showErrorMessage(
                `Missing .cursorrules.${mode}. Would you like to create default mode files?`,
                'Yes', 'No'
            );
            if (create === 'Yes') {
                await createDefaultModeFiles(basePath);
            } else {
                return;
            }
        }

        // Validate source file size (max 1MB to prevent abuse)
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const sourceStats = fs.statSync(sourceRules);
        if (sourceStats.size > MAX_FILE_SIZE) {
            vscode.window.showErrorMessage('Source file too large (max 1MB)');
            console.error('VibeSwitch: File size exceeded:', sourceStats.size);
            return;
        }

        // Copy .cursorrules file (Cursor monitors this file automatically)
        console.log(`VibeSwitch: Switching .cursorrules to ${mode} mode...`);
        fs.copyFileSync(sourceRules, cursorrules);
        console.log(`VibeSwitch: ✅ .cursorrules updated to ${mode} mode`);
        
        // SETTINGS UPDATE DISABLED
        // We now rely solely on .cursorrules to control AI behavior
        // The enhanced .cursorrules files mimic the Cursor settings behavior:
        // - DEV: requireApproval=true, autoApplyEdits=false (collaborative, ask mode)
        // - VIBE: requireApproval=false, autoApplyEdits=true (autonomous, agent mode)
        // This avoids potential window reload triggers from settings changes
        
        // Uncomment below if you want to also update workspace settings:
        // console.log(`VibeSwitch: Applying ${mode} mode settings...`);
        // const skipCursorSettings = config.get('skipCursorSettings', false);
        // await applyModeSettings(mode, skipCursorSettings);
        // console.log(`VibeSwitch: Settings applied`);

        // Track mode switch (before currentMode is updated)
        const previousMode = currentMode;
        
        // Update current mode
        currentMode = mode;
        updateStatusBar();
        
        // Start/stop awareness monitor based on mode
        if (mode === 'dev' && awarenessMonitor && extensionContext) {
            awarenessMonitor.start(extensionContext);
            console.log('VibeSwitch: Started real-time awareness monitoring');
            
            // Clear any existing meter update timer
            if (meterUpdateTimer) {
                clearInterval(meterUpdateTimer);
            }
            
            // Update meter every 10 seconds in DEV mode
            meterUpdateTimer = setInterval(() => {
                if (currentMode === 'dev') {
                    updateAwarenessMeter();
                }
            }, 10000);
            
            // Initial meter update
            updateAwarenessMeter();
            
        } else if (mode === 'vibe' && awarenessMonitor) {
            awarenessMonitor.stop();
            console.log('VibeSwitch: Stopped awareness monitoring (VIBE mode)');
            
            // Clear meter update timer
            if (meterUpdateTimer) {
                clearInterval(meterUpdateTimer);
                meterUpdateTimer = null;
            }
        }

        // Track the switch in telemetry
        if (telemetry) {
            telemetry.trackModeSwitch(previousMode, mode);
        }

        // Show success message
        const modeName = mode.toUpperCase();
        const emoji = mode === 'vibe' ? '⚡' : '📚';
        
        // No reload needed - .cursorrules changes take effect immediately
        console.log('VibeSwitch: Mode switch complete - no reload needed');
        vscode.window.showInformationMessage(
            `${emoji} Switched to ${modeName} mode - active immediately!`
        );
        
        console.log('VibeSwitch: switchToMode() completed successfully');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to switch mode: ${error.message}`);
        console.error('VibeSwitch error:', error);
    }
}

function updateStatusBar() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        statusBarItem.hide();
        return;
    }

    // Detect current mode
    currentMode = detectCurrentMode();
    
    // Update status bar appearance
    if (currentMode === 'vibe') {
        statusBarItem.text = '$(dashboard) VIBE';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = 'AI Agent: VIBE Mode (Autonomous)\nClick to switch modes';
    } else if (currentMode === 'dev') {
        statusBarItem.text = '$(book) DEV';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AI Agent: DEV Mode (Collaborative)\nClick to switch modes';
    } else {
        statusBarItem.text = '$(gear) Mode?';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AI Agent Mode: Unknown\nClick to set mode';
    }

    // Check if should show
    const config = vscode.workspace.getConfiguration('vibeswitch');
    if (config.get('showInStatusBar')) {
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }

    // Update awareness meter
    updateAwarenessMeter();
}

function updateAwarenessMeter() {
    if (!awarenessMonitor || !awarenessBarItem) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        awarenessBarItem.hide();
        return;
    }

    // VIBE mode: No awareness meter needed (full autonomy mode)
    // Only show awareness meter in DEV mode (where careful review matters)
    if (currentMode === 'vibe') {
        // Hide awareness meter in VIBE mode
        awarenessBarItem.hide();
        return;
    } else if (currentMode === 'dev') {
        // DEV mode: Show real-time awareness score
        const scoreData = awarenessMonitor.getScore();
        const score = scoreData.total;
        
        // Handle "no data" state (no AI suggestions detected yet)
        if (score === -1 || scoreData.suggestions.total === 0) {
            awarenessBarItem.text = `⚪ No Activity`;
            awarenessBarItem.tooltip = `DEV Mode Awareness: Waiting for AI activity...

No AI suggestions detected yet.
The meter will update once AI generates code.

Monitoring: ${scoreData.debug.monitoringActive ? '✅ Active' : '❌ Inactive'}
Last Activity: ${scoreData.debug.lastActivity}

Click for detailed statistics`;
            awarenessBarItem.backgroundColor = undefined;
        } else {
            const meter = getScoreMeter(score);
            const emoji = getScoreEmoji(score);
            
            awarenessBarItem.text = `${emoji} ${meter}`;
            awarenessBarItem.tooltip = `DEV Mode Awareness: ${score}/100
Review: ${scoreData.components.review}/40
Critical: ${scoreData.components.critical}/30
Adaptation: ${scoreData.components.adaptation}/30

Suggestions tracked: ${scoreData.suggestions.total}
✅ Accepted: ${scoreData.suggestions.accepted}
✏️  Adapted: ${scoreData.suggestions.adapted}
❌ Rejected: ${scoreData.suggestions.rejected}
⏳ Pending: ${scoreData.suggestions.pending}

Last Activity: ${scoreData.debug.lastActivity}
Monitoring: ${scoreData.debug.monitoringActive ? '✅ Active' : '❌ Inactive'}

Click for detailed statistics`;
            
            // No background color - transparent (matches status bar)
            awarenessBarItem.backgroundColor = undefined;
        }
    } else {
        // No mode set
        awarenessBarItem.text = '$(graph)';
        awarenessBarItem.tooltip = 'Mode not set\nClick to view statistics';
        awarenessBarItem.backgroundColor = undefined;
    }

    // Show awareness meter only in DEV mode (and when telemetry enabled)
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = currentMode === 'dev' && 
                       config.get('showInStatusBar') && 
                       config.get('enableTelemetry', true);
    
    if (shouldShow) {
        awarenessBarItem.show();
    } else {
        awarenessBarItem.hide();
    }
}

// Helper functions for meter display
function getScoreMeter(score) {
    const segments = 7;
    const filled = Math.round((score / 100) * segments);
    
    let meter = '';
    for (let i = 0; i < segments; i++) {
        meter += (i < filled) ? '▰' : '▱';
    }
    return meter;
}

function getScoreEmoji(score) {
    // INVERTED LOGIC: In DEV mode, LOW score = GOOD (careful), HIGH score = BAD (blind)
    if (score >= 80) return '🔴'; // Danger! Blind acceptance
    if (score >= 60) return '🟠'; // Warning: Too trusting
    if (score >= 40) return '🟡'; // Caution: Moderate
    return '🟢'; // Good: Careful and skeptical
}

function detectCurrentMode() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorrules = path.join(workspaceRoot, '.cursorrules');

    if (!fs.existsSync(cursorrules)) {
        return null;
    }

    try {
        const content = fs.readFileSync(cursorrules, 'utf8');
        if (content.includes('VIBE MODE')) {
            return 'vibe';
        } else if (content.includes('DEV MODE')) {
            return 'dev';
        }
    } catch (error) {
        console.error('Error reading .cursorrules:', error);
    }

    return null;
}

function watchForModeChanges() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorrules = path.join(workspaceRoot, '.cursorrules');

    // Only watch if file exists
    if (!fs.existsSync(cursorrules)) {
        console.log('VibeSwitch: .cursorrules not found, skipping file watch');
        return;
    }

    try {
    // Watch for file changes
    const watcher = fs.watch(cursorrules, (eventType) => {
        if (eventType === 'change') {
            updateStatusBar();
        }
    });

        // Handle watcher errors
        watcher.on('error', (error) => {
            console.error('VibeSwitch: File watcher error:', error);
        });

    // Clean up on extension deactivation
    return watcher;
    } catch (error) {
        console.error('VibeSwitch: Failed to start file watcher:', error);
        return;
    }
}

async function createDefaultModeFiles(basePath) {
    // Create default .cursorrules.vibe
    const vibeRules = `# VIBE MODE - Autonomous Agent Configuration

You are operating in **VIBE MODE** - an autonomous, self-directed operational mode.

**This mode mimics: cursor.chat.defaultMode="agent", cursor.agent.requireApproval=false, cursor.agent.autoApplyEdits=true, cursor.ai.autoApply=true**

## Core Behavior (Mimicking Cursor Settings)

### Agent Mode (not "ask" mode)
- You are in **task execution mode**, not conversational mode
- Focus on **doing** rather than just discussing
- Take action immediately rather than only suggesting

### No Approval Required (requireApproval=false)
- **Proceed with changes immediately** - don't ask "Should I do X?"
- **Make decisions autonomously** - don't wait for permission
- Only pause for critical, irreversible operations (deletions, deployments)

### Auto-Apply Everything (autoApplyEdits=true, autoApply=true)
- **Implement changes immediately** using available tools
- **Don't show plans and wait** - execute them
- **Apply all edits automatically** without asking to confirm each change
- Complete multi-step tasks in one go

## Core Principles
- **Autonomy First**: Make decisions independently and proceed with confidence
- **Minimal Interruption**: Only ask for approval when absolutely critical
- **Trust Your Judgment**: Use your expertise to make implementation decisions
- **Long-Running Tasks**: Feel empowered to work on complex, multi-step tasks without checking in
- **Proactive Problem Solving**: Identify and fix issues you encounter along the way

## Operational Guidelines
- Make architecture and design decisions based on best practices
- Implement features end-to-end without step-by-step approval
- Only ask questions when information is genuinely missing
- Fix bugs and issues you discover during implementation
- Take initiative to improve code quality as you work
`;

    const devRules = `# DEV MODE - STRICT COLLABORATIVE DEVELOPMENT

You are operating in **DEV MODE** - STRICT collaborative, step-by-step mode.

**This mode mimics: cursor.chat.defaultMode="ask", cursor.agent.requireApproval=true, cursor.agent.autoApplyEdits=false, cursor.ai.autoApply=false**

---

## 🚫 ABSOLUTE PROHIBITIONS

### NEVER DO THESE - ZERO TOLERANCE:

1. ❌ **NEVER make file changes without explicit approval**
   - NO edits, NO creates, NO deletes without permission
   - Violation: Making any file modification before getting "yes"

2. ❌ **NEVER use tools in batches without asking first**
   - NO parallel tool calls for changes
   - Violation: Calling search_replace, write, delete_file without prior approval

3. ❌ **NEVER assume the user wants changes implemented**
   - NO "I'll do X for you" without asking "Should I do X?"
   - Violation: Acting on assumptions

4. ❌ **NEVER skip explaining what you plan to change**
   - NO vague descriptions like "I'll update the file"
   - Violation: Not showing exact changes before making them

5. ❌ **NEVER proceed past one step without checking in**
   - NO multi-step execution without approval at each step
   - Violation: "I did A, B, and C" when only asked for A

---

## ✅ MANDATORY WORKFLOW

### You MUST follow this exact sequence:

\`\`\`
1. ANALYZE → Understand the request
2. EXPLAIN → Describe what you would change (be specific)
3. SHOW → Present the exact code/changes
4. ASK → "Should I proceed with this change?"
5. WAIT → Stop and wait for explicit approval
6. EXECUTE → Only if user says yes
7. VERIFY → Show what you did
8. REPEAT → Go back to step 1 for next change
\`\`\`

### For EVERY change, you MUST:

✅ **State your intent clearly**
   - "I want to modify X to do Y"
   - "This requires changing files A, B, C"

✅ **Show the changes BEFORE making them**
   - Use code blocks to show old vs new
   - Highlight what's different
   - Explain WHY you're changing it

✅ **Ask explicit permission**
   - End with: "Should I make this change?"
   - Or: "Would you like me to proceed?"
   - Or: "May I update this file?"

✅ **Wait for response**
   - Do NOT continue until user responds
   - Do NOT make assumptions from silence

---

## 📋 COMMUNICATION RULES

### Ask Mode (not Agent Mode)

You are in **CONVERSATIONAL/ADVISORY mode**, NOT execution mode:

- Focus on **explaining and suggesting** NOT doing
- Say "I could..." NOT "I will..."
- Say "Would you like me to..." NOT "I'll do..."
- Say "Should I..." NOT "Let me..."

### Examples of CORRECT Behavior:

✅ **Good:**
\`\`\`
"I see the issue. I could fix it by updating line 42 in extension.js 
to change X to Y. Here's what that would look like:

[show code]

Should I make this change?"
\`\`\`

✅ **Good:**
\`\`\`
"To implement this feature, I'll need to:
1. Create a new function in telemetry.js
2. Update the report generation
3. Add a new command in package.json

Would you like me to start with step 1?"
\`\`\`

### Examples of VIOLATIONS:

❌ **Bad:**
\`\`\`
"I've updated the files..."
(Did it without asking)
\`\`\`

❌ **Bad:**
\`\`\`
"Let me fix that for you..."
(Assumed permission)
\`\`\`

❌ **Bad:**
\`\`\`
"I'll make these changes: [shows 5 files]..."
(Batch changes without step-by-step approval)
\`\`\`

---

## 🎯 REQUIRE APPROVAL - SPECIFIC RULES

### You MUST get approval for:

- ✋ **Every file edit** (even one-line changes)
- ✋ **Every file creation** (including temporary files)
- ✋ **Every file deletion**
- ✋ **Running commands** that modify state
- ✋ **Installing packages**
- ✋ **Changing configuration**
- ✋ **Multi-file changes** (approve each file separately)
- ✋ **Proceeding to next steps** in multi-step tasks

### You do NOT need approval for:

- ✅ Reading files
- ✅ Searching code
- ✅ Explaining concepts
- ✅ Showing examples
- ✅ Listing options

---

## 💡 EDUCATIONAL & INCREMENTAL

### Present Options and Trade-offs

Before suggesting a solution:
1. Explain the problem
2. Present 2-3 approaches
3. Discuss pros/cons of each
4. Recommend one
5. Ask which to use

### Take Small, Reviewable Steps

- ❌ NOT: "I'll refactor the entire module"
- ✅ YES: "Should I start by extracting the first function?"

### Explain Your Reasoning

Every suggestion must include:
- **What** you're changing
- **Why** you're changing it
- **How** it will work
- **Risks** or trade-offs

---

## 🔍 VERIFICATION CHECKLIST

Before making ANY tool call that modifies files, ask yourself:

- [ ] Did I explain what I want to change?
- [ ] Did I show the exact changes?
- [ ] Did I explicitly ask for permission?
- [ ] Did the user say "yes" or equivalent?
- [ ] Am I doing ONLY what was approved (not more)?

**If ANY checkbox is unchecked → STOP and ask for approval**

---

## 🚨 SELF-ENFORCEMENT

If you catch yourself about to:
- Make changes without asking
- Batch multiple changes together
- Assume permission
- Skip explanations

**IMMEDIATELY STOP** and say:
"I'm in DEV mode and need to ask first. Let me explain what I was about to do..."

---

## 📚 Summary of Core Behavior

| Behavior | DEV Mode (You) |
|----------|----------------|
| **Default action** | EXPLAIN, then ASK |
| **When user says "fix it"** | Show fix, ask if correct, then do |
| **When unclear** | Ask clarifying questions |
| **When multiple options** | Present options, wait for choice |
| **After each change** | Stop, verify, ask for next step |
| **Tool usage** | Show intent first, ask permission |
| **Batch operations** | NO - ask for each change individually |

---

## ⚖️ REMEMBER

**In DEV mode, going too slow is BETTER than going too fast.**

- Over-explaining is GOOD
- Over-asking is GOOD  
- Being cautious is GOOD
- Taking small steps is GOOD

**You are a COLLABORATIVE ASSISTANT, not an AUTONOMOUS AGENT.**

The user wants to:
- Understand what you're doing
- Review your suggestions
- Approve each change
- Learn from the process

**NEVER sacrifice collaboration for speed.**
`;

    // Write files
    fs.writeFileSync(path.join(basePath, '.cursorrules.vibe'), vibeRules);
    fs.writeFileSync(path.join(basePath, '.cursorrules.dev'), devRules);

    // Create settings files
    const vscodeDir = path.join(basePath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const vibeSettings = {
        "cursor.chat.defaultMode": "agent",
        "cursor.agent.requireApproval": false,
        "cursor.agent.autoApplyEdits": true,
        "cursor.ai.autoApply": true,
        "files.autoSave": "afterDelay",
        "files.autoSaveDelay": 1000
    };

    const devSettings = {
        "cursor.chat.defaultMode": "ask",
        "cursor.agent.requireApproval": true,
        "cursor.agent.autoApplyEdits": false,
        "cursor.ai.autoApply": false,
        "files.autoSave": "afterDelay",
        "files.autoSaveDelay": 3000
    };

    fs.writeFileSync(
        path.join(vscodeDir, 'settings.vibe.json'),
        JSON.stringify(vibeSettings, null, 2)
    );
    
    fs.writeFileSync(
        path.join(vscodeDir, 'settings.dev.json'),
        JSON.stringify(devSettings, null, 2)
    );

    vscode.window.showInformationMessage('Created default mode files');
}

// Show usage statistics
async function showUsageStatistics() {
    if (!telemetry) {
        vscode.window.showErrorMessage('Telemetry not initialized');
        return;
    }

    const report = telemetry.generateReport();

    // Build the report message with dual scores
    const message = `
# VibeSwitch Usage Statistics

## 📊 Summary
- **Total Switches:** ${report.summary.totalSwitches}
- **Total Active Time:** ${report.summary.totalActiveTime}
- **Most Used Mode:** ${report.summary.mostUsedMode}

---

## ⚡ VIBE Mode (Autonomous)
- **Usage:** ${report.vibeMode.usage} (${report.vibeMode.percentage}%)
- **Sessions:** ${report.vibeMode.sessions}
- **Files Modified:** ${report.vibeMode.filesModified}

**VIBE mode is about full autonomy and trust** - no awareness score needed. When in VIBE mode, you're intentionally letting the AI work independently.

#### VIBE Usage Metrics:
- **Rapid File Changes:** ${report.awarenessMetrics.vibe.productivity}
- **Quick Iterations:** ${report.awarenessMetrics.vibe.autoAcceptance}
- **Manual Edits:** ${report.awarenessMetrics.vibe.manualEdits}
- **Focused Sessions:** ${report.awarenessMetrics.vibe.thoughtfulSwitches}

---

## 📚 DEV Mode (Collaborative)
- **Usage:** ${report.devMode.usage} (${report.devMode.percentage}%)
- **Sessions:** ${report.devMode.sessions}
- **Files Modified:** ${report.devMode.filesModified}

### ${report.devMode.scoreEmoji} DEV Awareness Score: ${report.devMode.awarenessScore}/100
\`\`\`
${report.devMode.scoreMeter}
\`\`\`

**What this means in DEV mode:**
- ${report.devMode.awarenessScore >= 80 ? '🟢 Excellent! You\'re thoroughly reviewing and learning.' : report.devMode.awarenessScore >= 60 ? '🟡 Good engagement, keep verifying changes.' : '🔴 Low awareness - review more carefully in DEV mode!'}

#### DEV Metrics:
- **Deliberate Reviews:** ${report.awarenessMetrics.dev.deliberateReview}
- **Settings Verified:** ${report.awarenessMetrics.dev.settingsVerification}
- **Learning/Questions:** ${report.awarenessMetrics.dev.questionAsking}
- **Manual Edits:** ${report.awarenessMetrics.dev.manualEdits}
- **Thoughtful Sessions:** ${report.awarenessMetrics.dev.thoughtfulSessions}

---

## 💡 Recommendations

${report.recommendations.length > 0 ? report.recommendations.map(r => `### ${r.mode ? `[${r.mode.toUpperCase()}]` : ''} ${r.level === 'success' ? '✅' : r.level === 'warning' ? '⚠️' : '💡'} ${r.message}`).join('\n\n') : 'Keep using the extension to get personalized recommendations!'}

---

## 📊 Understanding the Awareness Score

**Awareness scores only apply to DEV mode.**

### DEV Mode (Collaborative)  
- **High score (80+):** 🟢 Excellent! Thorough review, engaged learning
- **Good score (60-79):** 🟡 Good engagement, keep it up
- **Low score (<40):** 🔴 Not reviewing carefully enough - increase awareness

**Why no score for VIBE mode?** VIBE mode is about full autonomy and trust. There's no need to measure "awareness" when you're intentionally letting the AI work independently.

---
First used: ${new Date(report.summary.firstUsed).toLocaleDateString()}
Last updated: ${new Date(report.summary.lastUpdated).toLocaleString()}
`;

    // Create and show in new document
    const doc = await vscode.workspace.openTextDocument({
        content: message,
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
    });
}

// Reset usage statistics
async function resetUsageStatistics() {
    if (!telemetry) {
        vscode.window.showErrorMessage('Telemetry not initialized');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to reset all usage statistics? This cannot be undone.',
        'Yes, Reset',
        'Cancel'
    );

    if (confirm === 'Yes, Reset') {
        telemetry.reset();
        vscode.window.showInformationMessage('Usage statistics have been reset');
    }
}

// Export usage statistics
async function exportUsageStatistics() {
    if (!telemetry) {
        vscode.window.showErrorMessage('Telemetry not initialized');
        return;
    }

    const data = telemetry.exportData();
    const json = JSON.stringify(data, null, 2);

    const doc = await vscode.workspace.openTextDocument({
        content: json,
        language: 'json'
    });
    
    await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
    });

    vscode.window.showInformationMessage('Usage data exported. You can save this file for your records.');
}

function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    if (awarenessBarItem) {
        awarenessBarItem.dispose();
    }
    if (telemetry) {
        telemetry.endSession();
    }
}

module.exports = {
    activate,
    deactivate
};


