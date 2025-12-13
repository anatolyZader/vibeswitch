/**
 * Status bar management for mode switcher and awareness meter
 */

const vscode = require('vscode');

/**
 * Helper function: Generates a visual meter bar representation of the awareness score
 * 
 * Creates a 7-segment bar where filled segments (▰) represent the score percentage
 * Empty segments (▱) represent remaining capacity
 * 
 * @param {number} score - Awareness score (0-100)
 * @returns {string} Visual meter string (e.g., "▰▰▰▱▱▱▱")
 */
function getScoreMeter(score) {
    const segments = 7;
    const filled = Math.round((score / 100) * segments);
    
    let meter = '';
    for (let i = 0; i < segments; i++) {
        meter += (i < filled) ? '▰' : '▱';
    }
    return meter;
}

/**
 * Helper function: Returns an emoji indicator based on awareness score
 * 
 * In DEV mode, score interpretation is INVERTED:
 * - Low score (0-39) = 🟢 GOOD (careful, skeptical, thorough review)
 * - Medium score (40-59) = 🟡 CAUTION (moderate engagement)
 * - High score (60-79) = 🟠 WARNING (too trusting, not selective enough)
 * - Very high score (80-100) = 🔴 DANGER (blind acceptance, no review)
 * 
 * @param {number} score - Awareness score (0-100)
 * @returns {string} Emoji indicator (🟢/🟡/🟠/🔴)
 */
function getScoreEmoji(score) {
    // INVERTED LOGIC: In DEV mode, LOW score = GOOD (careful), HIGH score = BAD (blind)
    if (score >= 80) return '🔴'; // Danger! Blind acceptance
    if (score >= 60) return '🟠'; // Warning: Too trusting
    if (score >= 40) return '🟡'; // Caution: Moderate
    return '🟢'; // Good: Careful and skeptical
}

/**
 * Updates the status bar item to reflect the current mode and visibility settings
 * 
 * @param {vscode.StatusBarItem} statusBarItem - The status bar item to update
 * @param {string|null} currentMode - Current mode ('vibe', 'dev', or null)
 * @param {vscode.OutputChannel} outputChannel - Optional output channel for logging
 */
function updateStatusBar(statusBarItem, currentMode, outputChannel = null) {
    if (!statusBarItem) {
        if (outputChannel) {
            outputChannel.appendLine('WARNING: statusBarItem not initialized');
        }
        return;
    }
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        // Show status bar even without workspace, but with a message
        statusBarItem.text = '$(gear) VibeSwitch';
        statusBarItem.tooltip = 'VibeSwitch: No workspace folder open\nOpen a folder to use VibeSwitch';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        return;
    }

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

    // Check if should show (default to true if setting not explicitly false)
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = config.get('showInStatusBar', true); // Default to true
    
    // Always show status bar - it's the primary way to access the extension
    if (shouldShow !== false) {
        statusBarItem.show();
        if (outputChannel) {
            outputChannel.appendLine(`Status bar shown (showInStatusBar=${shouldShow})`);
        }
    } else {
        statusBarItem.hide();
        if (outputChannel) {
            outputChannel.appendLine('Status bar hidden by showInStatusBar=false setting');
        }
    }
}

/**
 * Updates the awareness meter status bar item with current awareness score and metrics
 * 
 * @param {vscode.StatusBarItem} awarenessBarItem - The awareness meter status bar item
 * @param {Object} awarenessMonitor - The awareness monitor instance
 * @param {string|null} currentMode - Current mode ('vibe', 'dev', or null)
 * @param {vscode.OutputChannel} outputChannel - Optional output channel for logging
 */
function updateAwarenessMeter(awarenessBarItem, awarenessMonitor, currentMode, outputChannel = null) {
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
        // Check if we have ANY suggestions (including pending) to show activity
        const hasAnySuggestions = scoreData.suggestions.total > 0;
        const hasRecentActivity = scoreData.debug.recentWindowCount > 0;
        const hasReviewDebt = scoreData.debt.unreviewedFiles > 0;
        
        if (score === -1 && !hasAnySuggestions && !hasReviewDebt) {
            // Truly no activity - no suggestions and no debt
            awarenessBarItem.text = `⚪ No Activity`;
            awarenessBarItem.tooltip = `DEV Mode Awareness: Waiting for AI activity...

No AI suggestions detected yet.
The meter will update once AI generates code.

Monitoring: ${scoreData.debug.monitoringActive ? '✅ Active' : '❌ Inactive'}
Last Activity: ${scoreData.debug.lastActivity}
Total Tracked: ${scoreData.debug.totalTrackedCount}
Recent (10s): ${scoreData.debug.recentWindowCount}

Click for detailed statistics`;
            awarenessBarItem.backgroundColor = undefined;
        } else if (score === -1 && hasReviewDebt) {
            // No recent suggestions, but there's review debt - show debt indicator
            const debtScore = scoreData.components.debt;
            const meter = getScoreMeter(debtScore);
            const emoji = getScoreEmoji(debtScore);
            
            awarenessBarItem.text = `${emoji} ${meter} (${scoreData.debt.unreviewedFiles})`;
            awarenessBarItem.tooltip = `DEV Mode Awareness: Review Debt Detected

📁 ${scoreData.debt.unreviewedFiles} unreviewed file(s) with AI-generated changes

Recent Activity: None (last 10 seconds)
Review Debt Score: ${debtScore}/30

${scoreData.debt.files.slice(0, 5).map(f => `• ${f.path} (${f.ageMinutes}m ago)`).join('\n')}
${scoreData.debt.files.length > 5 ? `\n... and ${scoreData.debt.files.length - 5} more` : ''}

Click for detailed statistics`;
            awarenessBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            // Show meter even if score is 50 (pending suggestions) or if we have any suggestions
            const displayScore = hasAnySuggestions && score === -1 ? 50 : score;
            const meter = getScoreMeter(displayScore);
            const emoji = getScoreEmoji(displayScore);
            
            awarenessBarItem.text = `${emoji} ${meter}`;
            
            // Build tooltip with debt information
            let tooltip = `DEV Mode Awareness: ${score}/100
Review: ${scoreData.components.review}/40
Critical: ${scoreData.components.critical}/30
Adaptation: ${scoreData.components.adaptation}/30
Debt: ${scoreData.components.debt}/30

Suggestions tracked: ${scoreData.suggestions.total}
✅ Accepted: ${scoreData.suggestions.accepted}
✏️  Adapted: ${scoreData.suggestions.adapted}
❌ Rejected: ${scoreData.suggestions.rejected}
⏳ Pending: ${scoreData.suggestions.pending}`;

            // Add debt section if there are unreviewed files
            if (scoreData.debt.unreviewedFiles > 0) {
                tooltip += `\n\n📁 UNREVIEWED AI CHANGES: ${scoreData.debt.unreviewedFiles} files`;
                
                // Show top 5 oldest files
                const filesToShow = scoreData.debt.files.slice(0, 5);
                filesToShow.forEach(file => {
                    const timeStr = file.ageMinutes < 60 ? 
                        `${file.ageMinutes}m ago` : 
                        `${Math.round(file.ageMinutes / 60)}h ago`;
                    tooltip += `\n  • ${file.path} (${timeStr})`;
                });
                
                if (scoreData.debt.unreviewedFiles > 5) {
                    tooltip += `\n  ... and ${scoreData.debt.unreviewedFiles - 5} more`;
                }
                
                tooltip += `\n\n⚠️  Open and review these files to clear debt!`;
            } else {
                tooltip += `\n\n✅ No unreviewed files - great job!`;
            }

            tooltip += `\n\nLast Activity: ${scoreData.debug.lastActivity}
Monitoring: ${scoreData.debug.monitoringActive ? '✅ Active' : '❌ Inactive'}

Click for detailed statistics`;
            
            awarenessBarItem.tooltip = tooltip;
            
            // No background color - transparent (matches status bar)
            awarenessBarItem.backgroundColor = undefined;
        }
    } else {
        // No mode set
        awarenessBarItem.text = '$(graph)';
        awarenessBarItem.tooltip = 'Mode not set\nClick to view statistics';
        awarenessBarItem.backgroundColor = undefined;
    }

    // Show awareness meter only in DEV mode (meter doesn't depend on usage statistics)
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = currentMode === 'dev' && config.get('showInStatusBar', true); // Default to true
    
    if (shouldShow) {
        awarenessBarItem.show();
    } else {
        awarenessBarItem.hide();
        if (outputChannel && currentMode !== 'dev') {
            outputChannel.appendLine(`Awareness meter hidden: currentMode=${currentMode}, showInStatusBar=${config.get('showInStatusBar', true)}`);
        }
    }
}

module.exports = {
    updateStatusBar,
    updateAwarenessMeter,
    getScoreMeter,
    getScoreEmoji
};


