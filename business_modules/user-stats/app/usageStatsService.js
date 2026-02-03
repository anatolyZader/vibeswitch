/**
 * VibeSwitch Usage Statistics Module
 * Privacy-first, local-only historical usage tracking and statistics
 */

const vscode = require('vscode');
const PersistInSystem = require('../../awareness/infrastructure/legacy/persistInSystem');

class UsageStatsManager {
    constructor(context) {
        this.context = context;
        // Keep 'telemetry.json' filename for backwards compatibility with existing user data
        this.persistence = new PersistInSystem(context, 'global', 'telemetry.json');
        this.currentSession = null;
        this.loadUsageStats();
    }

    loadUsageStats() {
        const defaultData = this.getDefaultData();
        const loaded = this.persistence.load(defaultData);
        
        // If file doesn't exist, we'll get default data - save it to create the file
        if (!this.persistence.exists()) {
            this.data = defaultData;
            this.saveUsageStats();
            } else {
            this.data = loaded;
        }
    }

    getDefaultData() {
        return {
            version: '1.0.0',
            firstUsed: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            
            // Mode usage tracking
            modeUsage: {
                vibe: {
                    totalTime: 0,           // milliseconds
                    sessionCount: 0,
                    switchCount: 0,
                    filesModified: 0,
                    lastUsed: null
                },
                dev: {
                    totalTime: 0,
                    sessionCount: 0,
                    switchCount: 0,
                    filesModified: 0,
                    lastUsed: null
                }
            },
            
            // Switch patterns
            switchHistory: [],
            
            // Mode-specific awareness indicators
            awareness: {
                vibe: {
                    statusBarClicks: 0,
                    settingsFileOpens: 0,
                    cursorrulesFileOpens: 0,
                    documentationViews: 0,
                    manualEditsAfterSwitch: 0,
                    quickSwitches: 0,
                    thoughtfulSwitches: 0,
                    autoAcceptance: 0,              // Good in VIBE (speed)
                    pauseBeforeEdit: 0,             // Less important in VIBE
                    filesModifiedRapidly: 0         // Good in VIBE (productivity)
                },
                dev: {
                    statusBarClicks: 0,
                    settingsFileOpens: 0,
                    cursorrulesFileOpens: 0,
                    documentationViews: 0,
                    manualEditsAfterSwitch: 0,
                    quickSwitches: 0,
                    thoughtfulSwitches: 0,
                    deliberateReview: 0,            // Good in DEV (thoroughness)
                    questionAsking: 0,              // Good in DEV (learning)
                    settingsVerification: 0         // Good in DEV (awareness)
                }
            },
            
            // Statistics
            stats: {
                totalSwitches: 0,
                averageSessionLength: 0,
                mostUsedMode: null,
                totalActiveTime: 0
            }
        };
    }

    saveUsageStats() {
            this.data.lastUpdated = new Date().toISOString();
        this.persistence.save(this.data, null, { pretty: true });
    }

    // Track mode switch
    trackModeSwitch(fromMode, toMode) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const timestamp = Date.now();
        
        // End current session if exists
        if (this.currentSession) {
            this.endSession();
        }

        // Record switch
        this.data.switchHistory.push({
            from: fromMode,
            to: toMode,
            timestamp: new Date().toISOString(),
            workspace: vscode.workspace.name || 'unknown'
        });

        // Keep only last 100 switches
        if (this.data.switchHistory.length > 100) {
            this.data.switchHistory = this.data.switchHistory.slice(-100);
        }

        // Update mode stats
        if (toMode && this.data.modeUsage[toMode]) {
            this.data.modeUsage[toMode].switchCount++;
            this.data.modeUsage[toMode].sessionCount++;
            this.data.modeUsage[toMode].lastUsed = new Date().toISOString();
        }

        this.data.stats.totalSwitches++;

        // Start new session
        this.startSession(toMode, timestamp);

        this.saveUsageStats();
    }

    startSession(mode, timestamp) {
        this.currentSession = {
            mode: mode,
            startTime: timestamp,
            editCount: 0,
            filesSaved: 0
        };
    }

    endSession() {
        if (!this.currentSession) return;

        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const duration = Date.now() - this.currentSession.startTime;
        const mode = this.currentSession.mode;

        if (this.data.modeUsage[mode]) {
            this.data.modeUsage[mode].totalTime += duration;
            this.data.modeUsage[mode].filesModified += this.currentSession.filesSaved;
        }

        // Track session length patterns (mode-specific)
        if (mode && this.data.awareness[mode]) {
            if (duration < 30000) { // < 30 seconds
                this.data.awareness[mode].quickSwitches++;
            } else if (duration > 300000) { // > 5 minutes
                this.data.awareness[mode].thoughtfulSwitches++;
                
                // In DEV mode, long sessions = good (deliberate review)
                if (mode === 'dev') {
                    this.data.awareness[mode].deliberateReview++;
                }
            }
            
            // Track productivity in VIBE mode
            if (mode === 'vibe' && this.currentSession.filesSaved > 3) {
                this.data.awareness[mode].filesModifiedRapidly++;
            }
        }

        this.currentSession = null;
        this.updateStats();
        this.saveUsageStats();
    }

    // Track status bar click (mode check)
    trackStatusBarClick() {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        // Track for current mode
        const mode = this.currentSession?.mode;
        if (mode && this.data.awareness[mode]) {
            this.data.awareness[mode].statusBarClicks++;
        }
        this.saveUsageStats();
    }

    // ==================== AI-AWARE TRACKING ====================
    
    /**
     * Track when AI generates a suggestion
     */
    trackAISuggestion(event) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const mode = this.currentSession?.mode;
        if (!mode || !this.data.awareness[mode]) return;

        const bucket = this.data.awareness[mode];
        bucket.aiSuggestions = (bucket.aiSuggestions || 0) + 1;
        bucket.aiTotalSize = (bucket.aiTotalSize || 0) + event.size;

        this.saveUsageStats();
    }

    /**
     * Track outcome of AI suggestion (accepted/rejected/adapted)
     */
    trackAISuggestionOutcome(event) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const mode = this.currentSession?.mode;
        if (!mode || !this.data.awareness[mode]) return;

        const bucket = this.data.awareness[mode];
        bucket.aiAccepted = (bucket.aiAccepted || 0) + (event.status === 'accepted' ? 1 : 0);
        bucket.aiRejected = (bucket.aiRejected || 0) + (event.status === 'rejected' ? 1 : 0);
        bucket.aiAdapted = (bucket.aiAdapted || 0) + (event.status === 'adapted' ? 1 : 0);
        bucket.aiReviewed = (bucket.aiReviewed || 0) + (event.reviewTime > 0 ? 1 : 0);
        bucket.aiTotalReviewTime = (bucket.aiTotalReviewTime || 0) + event.reviewTime;

        this.saveUsageStats();
    }

    /**
     * Track when review debt is cleared
     */
    trackAIDebtCleared(event) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const mode = this.currentSession?.mode;
        if (!mode || !this.data.awareness[mode]) return;

        const bucket = this.data.awareness[mode];
        bucket.aiDebtCleared = (bucket.aiDebtCleared || 0) + 1;
        bucket.aiDebtTotalReviewTime = (bucket.aiDebtTotalReviewTime || 0) + event.totalReviewTime;

        this.saveUsageStats();
    }

    /**
     * Track "Keep All" button clicks (detected via pattern matching)
     * 
     * This tracks when multiple AI suggestions are accepted rapidly,
     * which typically indicates the user clicked Cursor's "Keep All" button.
     * 
     * @param {Object} event - Event data
     * @param {number} event.count - Number of suggestions accepted
     * @param {number} event.fileCount - Number of files affected
     * @param {number} event.totalSize - Total size of accepted changes
     * @param {number} event.timestamp - When the "Keep All" was detected
     * @param {number} event.window - Detection window in milliseconds
     */
    trackKeepAll(event) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const mode = this.currentSession?.mode;
        if (!mode || !this.data.awareness[mode]) return;

        const bucket = this.data.awareness[mode];
        
        // Track "Keep All" events
        bucket.keepAllClicks = (bucket.keepAllClicks || 0) + 1;
        bucket.keepAllTotalSuggestions = (bucket.keepAllTotalSuggestions || 0) + event.count;
        bucket.keepAllTotalFiles = (bucket.keepAllTotalFiles || 0) + event.fileCount;
        bucket.keepAllTotalSize = (bucket.keepAllTotalSize || 0) + event.totalSize;
        
        // Track average suggestions per "Keep All"
        if (bucket.keepAllClicks > 0) {
            bucket.keepAllAvgSuggestions = Math.round(
                bucket.keepAllTotalSuggestions / bucket.keepAllClicks
            );
        }

        this.saveUsageStats();
    }

    // Track file open (awareness indicator)
    trackFileOpen(fileName) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        const mode = this.currentSession?.mode;
        if (!mode || !this.data.awareness[mode]) return;

        if (fileName.includes('settings.json')) {
            this.data.awareness[mode].settingsFileOpens++;
            // In DEV mode, verifying settings is good practice
            if (mode === 'dev') {
                this.data.awareness[mode].settingsVerification++;
            }
        } else if (fileName.includes('.cursorrules') || fileName.includes('.cursor/rules.md') || fileName.includes('.cursor/rules.')) {
            this.data.awareness[mode].cursorrulesFileOpens++;
        } else if (fileName.match(/README|SETTINGS-COMPARISON|TESTING|USAGE-STATS/i)) {
            this.data.awareness[mode].documentationViews++;
            // In DEV mode, reading docs shows learning intent
            if (mode === 'dev') {
                this.data.awareness[mode].questionAsking++;
            }
        }
        this.saveUsageStats();
    }

    // Track edit (awareness indicator)
    // @param {Object} metadata - Optional metadata for future AI vs human inference
    //                            { document, changeCount, timestamp, ... }
    trackEdit(metadata = null) {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        if (this.currentSession) {
            this.currentSession.editCount++;
            // Store metadata for future analysis (AI vs human inference)
            if (metadata && !this.currentSession.editMetadata) {
                this.currentSession.editMetadata = [];
            }
            if (metadata && this.currentSession.editMetadata) {
                this.currentSession.editMetadata.push(metadata);
            }
        }
        
        const mode = this.currentSession?.mode;
        if (!mode || !this.data.awareness[mode]) return;
        
        // If edit happens within 30s of mode switch, it's awareness indicator
        if (Date.now() - this.currentSession.startTime < 30000) {
            this.data.awareness[mode].manualEditsAfterSwitch++;
            
            // In DEV mode, immediate edits show engagement
            // In VIBE mode, this is also good (quick iteration)
            if (mode === 'dev') {
                this.data.awareness[mode].deliberateReview++;
            } else if (mode === 'vibe') {
                this.data.awareness[mode].autoAcceptance++;
            }
            
            this.saveUsageStats();
        }
    }

    // Track file save
    trackFileSave() {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        if (!config.get('enableTelemetry', true)) return;

        if (this.currentSession) {
            this.currentSession.filesSaved++;
        }
    }

    updateStats() {
        const vibe = this.data.modeUsage.vibe;
        const dev = this.data.modeUsage.dev;

        // Calculate total active time
        this.data.stats.totalActiveTime = vibe.totalTime + dev.totalTime;

        // Calculate average session length
        const totalSessions = vibe.sessionCount + dev.sessionCount;
        if (totalSessions > 0) {
            this.data.stats.averageSessionLength = this.data.stats.totalActiveTime / totalSessions;
        }

        // Determine most used mode
        if (vibe.totalTime > dev.totalTime) {
            this.data.stats.mostUsedMode = 'vibe';
        } else if (dev.totalTime > vibe.totalTime) {
            this.data.stats.mostUsedMode = 'dev';
        } else {
            this.data.stats.mostUsedMode = 'balanced';
        }
    }

    // [DEPRECATED] Calculate VIBE mode awareness score (0-100)
    // VIBE mode is about full autonomy - no awareness score needed
    // This is kept for backwards compatibility with existing usage statistics data
    calculateVibeAwarenessScore() {
        const a = this.data.awareness.vibe;
        const usage = this.data.modeUsage.vibe;
        const sessions = usage.sessionCount || 1;

        const factors = {
            // Productivity (30%) - HIGH is GOOD in VIBE
            productivity: Math.min((a.filesModifiedRapidly / sessions) * 30, 30),
            
            // Auto-acceptance (25%) - HIGH is GOOD in VIBE (trust)
            trust: Math.min((a.autoAcceptance / sessions) * 25, 25),
            
            // Thoughtful sessions (20%) - MEDIUM is GOOD (not too careful, not too reckless)
            balance: Math.min(
                (a.thoughtfulSwitches / (a.quickSwitches + a.thoughtfulSwitches || 1)) * 15 + 5,
                20
            ),
            
            // Status checks (15%) - LOW to MEDIUM is GOOD (don't overthink)
            confidence: Math.min(15 - (a.statusBarClicks / sessions) * 3, 15),
            
            // Settings verification (10%) - LOW is GOOD (trust the system)
            automation: Math.min(10 - (a.settingsFileOpens / sessions) * 2, 10)
        };

        const total = Object.values(factors).reduce((sum, val) => sum + val, 0);
        return Math.round(Math.max(0, total));
    }

    // Calculate DEV mode awareness score (0-100)
    // DEV mode values: Thoroughness, learning, verification
    calculateDevAwarenessScore() {
        const a = this.data.awareness.dev;
        const usage = this.data.modeUsage.dev;
        const sessions = usage.sessionCount || 1;

        const factors = {
            // Deliberate review (30%) - HIGH is GOOD in DEV
            thoroughness: Math.min((a.deliberateReview / sessions) * 30, 30),
            
            // Settings verification (25%) - HIGH is GOOD in DEV
            verification: Math.min((a.settingsVerification / sessions) * 25, 25),
            
            // Documentation/learning (20%) - HIGH is GOOD in DEV
            learning: Math.min((a.questionAsking / sessions) * 20, 20),
            
            // Manual edits (15%) - HIGH is GOOD in DEV (engagement)
            engagement: Math.min((a.manualEditsAfterSwitch / sessions) * 15, 15),
            
            // Thoughtful sessions (10%) - HIGH is GOOD in DEV
            mindfulness: Math.min(
                (a.thoughtfulSwitches / (a.quickSwitches + a.thoughtfulSwitches || 1)) * 10,
                10
            )
        };

        const total = Object.values(factors).reduce((sum, val) => sum + val, 0);
        return Math.round(total);
    }

    // Get visual meter for score (speedometer/VU meter style)
    getScoreMeter(score, mode) {
        // Create bar meter (7 segments) - white/neutral bars
        const segments = 7;
        const filled = Math.round((score / 100) * segments);
        
        let meter = '';
        for (let i = 0; i < segments; i++) {
            if (i < filled) {
                meter += '▰';  // Filled segment (better rendering)
            } else {
                meter += '▱';  // Empty segment (better rendering)
            }
        }
        
        return meter;
    }

    // Get emoji indicator
    getScoreEmoji(score, mode) {
        if (mode === 'vibe') {
            if (score >= 70) return '🚀'; // Fast & confident
            if (score >= 50) return '⚡'; // Good speed
            if (score >= 30) return '🟡'; // Acceptable
            return '🔴'; // Too hesitant for VIBE
        } else { // dev
            if (score >= 80) return '🟢'; // Excellent awareness
            if (score >= 60) return '🟡'; // Good
            if (score >= 40) return '🟠'; // Fair
            return '🔴'; // Low awareness
        }
    }

    // Generate usage report
    generateReport() {
        this.updateStats();
        
        const vibe = this.data.modeUsage.vibe;
        const dev = this.data.modeUsage.dev;
        const stats = this.data.stats;
        
        // Calculate separate awareness scores
        const vibeScore = this.calculateVibeAwarenessScore();
        const devScore = this.calculateDevAwarenessScore();

        // Format time durations
        const formatTime = (ms) => {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        };

        const report = {
            summary: {
                totalSwitches: stats.totalSwitches,
                totalActiveTime: formatTime(stats.totalActiveTime),
                mostUsedMode: stats.mostUsedMode,
                awarenessScore: devScore,  // Only DEV mode has awareness score
                firstUsed: this.data.firstUsed,
                lastUpdated: this.data.lastUpdated
            },
            
            vibeMode: {
                usage: formatTime(vibe.totalTime),
                percentage: Math.round((vibe.totalTime / stats.totalActiveTime) * 100) || 0,
                sessions: vibe.sessionCount,
                switches: vibe.switchCount,
                filesModified: vibe.filesModified,
                lastUsed: vibe.lastUsed
                // No awareness score for VIBE mode - it's about full autonomy
            },
            
            devMode: {
                usage: formatTime(dev.totalTime),
                percentage: Math.round((dev.totalTime / stats.totalActiveTime) * 100) || 0,
                sessions: dev.sessionCount,
                switches: dev.switchCount,
                filesModified: dev.filesModified,
                lastUsed: dev.lastUsed,
                awarenessScore: devScore,
                scoreMeter: this.getScoreMeter(devScore, 'dev'),
                scoreEmoji: this.getScoreEmoji(devScore, 'dev')
            },
            
            awarenessMetrics: {
                vibe: {
                    // No score for VIBE mode - it's about full autonomy
                    productivity: this.data.awareness.vibe.filesModifiedRapidly,
                    autoAcceptance: this.data.awareness.vibe.autoAcceptance,
                    statusBarChecks: this.data.awareness.vibe.statusBarClicks,
                    settingsViewed: this.data.awareness.vibe.settingsFileOpens,
                    manualEdits: this.data.awareness.vibe.manualEditsAfterSwitch,
                    thoughtfulSessions: this.data.awareness.vibe.thoughtfulSwitches,
                    quickSwitches: this.data.awareness.vibe.quickSwitches
                },
                dev: {
                    score: devScore,
                    deliberateReview: this.data.awareness.dev.deliberateReview,
                    settingsVerification: this.data.awareness.dev.settingsVerification,
                    questionAsking: this.data.awareness.dev.questionAsking,
                    statusBarChecks: this.data.awareness.dev.statusBarClicks,
                    manualEdits: this.data.awareness.dev.manualEditsAfterSwitch,
                    thoughtfulSessions: this.data.awareness.dev.thoughtfulSwitches,
                    quickSwitches: this.data.awareness.dev.quickSwitches
                }
            },
            
            recommendations: this.generateRecommendations(vibeScore, devScore, vibe, dev)
        };

        return report;
    }

    generateRecommendations(vibeScore, devScore, vibeUsage, devUsage) {
        const recommendations = [];
        
        // VIBE Mode recommendations (no score-based recommendations - VIBE is about full autonomy)
        if (vibeUsage.sessionCount > 0 && vibeUsage.totalTime > 3600000) { // > 1 hour
            recommendations.push({
                mode: 'vibe',
                level: 'info',
                message: 'VIBE Mode: You\'re using VIBE mode for autonomous work. Remember it\'s designed for speed and trust in the AI.'
            });
        }
        
        // DEV Mode recommendations
        if (devUsage.sessionCount > 0) {
            if (devScore < 40) {
                recommendations.push({
                    mode: 'dev',
                    level: 'warning',
                    message: 'DEV Mode: Low awareness! In DEV mode, take time to review, verify settings, and understand changes thoroughly.'
                });
            } else if (devScore >= 80) {
                recommendations.push({
                    mode: 'dev',
                    level: 'success',
                    message: 'DEV Mode: Excellent! 🟢 You\'re carefully reviewing changes and learning effectively.'
                });
            }
        }
        
        // Cross-mode recommendations
        if (vibeUsage.totalTime > devUsage.totalTime * 5) {
            recommendations.push({
                level: 'info',
                message: 'Heavy VIBE user! Great for productivity. Remember to occasionally use DEV mode for critical code review.'
            });
        } else if (devUsage.totalTime > vibeUsage.totalTime * 3) {
            recommendations.push({
                level: 'info',
                message: 'Heavy DEV user! Excellent for learning. Try VIBE mode more for routine tasks to boost speed.'
            });
        }
        
        // Specific metrics
        const vibeAwareness = this.data.awareness.vibe;
        const devAwareness = this.data.awareness.dev;
        
        if (vibeAwareness.statusBarClicks > vibeUsage.sessionCount) {
            recommendations.push({
                level: 'tip',
                message: 'VIBE: You check mode status frequently. In VIBE mode, trust your setup and focus on coding!'
            });
        }
        
        if (devAwareness.settingsVerification === 0 && devUsage.sessionCount > 3) {
            recommendations.push({
                level: 'tip',
                message: 'DEV: Try reviewing settings.json after switches to verify changes - builds awareness!'
            });
        }
        
        if ((devAwareness.documentationViews + vibeAwareness.documentationViews) === 0) {
            recommendations.push({
                level: 'tip',
                message: 'Check out SETTINGS-COMPARISON.md to understand exactly what changes between modes.'
            });
        }
        
        return recommendations;
    }

    // Reset usage statistics (privacy feature)
    reset() {
        this.data = this.getDefaultData();
        this.currentSession = null;
        this.saveUsageStats();
    }

    // Export usage statistics data (privacy feature)
    exportData() {
        return JSON.parse(JSON.stringify(this.data));
    }

    /**
     * Dispose method for VS Code extension lifecycle
     * Called when extension deactivates to clean up resources
     */
    dispose() {
        try {
            this.endSession();
        } catch (error) {
            // Log but don't throw - disposal should always succeed
            console.error('UsageStatsManager: Error during disposal:', error);
        }
    }
}

module.exports = UsageStatsManager;














