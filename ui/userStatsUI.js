/**
 * Statistics display, export, and reset functionality
 */

const vscode = require('vscode');

/**
 * Displays a comprehensive usage statistics report in a new markdown document
 * 
 * Shows:
 * - Overall summary (total switches, active time, most used mode)
 * - VIBE mode metrics (usage percentage, sessions, files modified, productivity metrics)
 * - DEV mode metrics (usage percentage, sessions, files modified, awareness score)
 * - Awareness score breakdown and interpretation
 * - Personalized recommendations based on usage patterns
 * 
 * Opens the report in a new editor tab beside the current one
 * Report is formatted as markdown for easy reading
 * 
 * @param {Object} usageStats - Usage statistics manager instance
 */
async function showUsageStatistics(usageStats) {
    if (!usageStats) {
        vscode.window.showErrorMessage('Usage statistics not initialized');
        return;
    }

    const report = usageStats.generateReport();

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

/**
 * Resets all usage statistics data (mode switches, awareness metrics)
 * 
 * Shows a warning dialog to confirm the action since it cannot be undone
 * Only resets if user confirms with "Yes, Reset"
 * Shows a success message after reset is complete
 * 
 * @param {Object} usageStats - Usage statistics manager instance
 */
async function resetUsageStatistics(usageStats) {
    if (!usageStats) {
        vscode.window.showErrorMessage('Usage statistics not initialized');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to reset all usage statistics? This cannot be undone.',
        'Yes, Reset',
        'Cancel'
    );

    if (confirm === 'Yes, Reset') {
        usageStats.reset();
        vscode.window.showInformationMessage('Usage statistics have been reset');
    }
}

/**
 * Exports all usage statistics data as JSON in a new editor tab
 * 
 * Allows user to:
 * - View raw usage statistics data
 * - Save the data to a file for backup or analysis
 * - Share usage statistics with others
 * 
 * Opens the JSON data in a new editor tab beside the current one
 * Shows an information message explaining the data can be saved
 * 
 * @param {Object} usageStats - Usage statistics manager instance
 */
async function exportUsageStatistics(usageStats) {
    if (!usageStats) {
        vscode.window.showErrorMessage('Usage statistics not initialized');
        return;
    }

    const data = usageStats.exportData();
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

module.exports = {
    showUsageStatistics,
    resetUsageStatistics,
    exportUsageStatistics
};


