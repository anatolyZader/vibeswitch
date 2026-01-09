/**
 * Debt Manager
 * Manages persistent tracking of unreviewed files and calculates debt scores
 * 
 * Domain entity - uses ports for all infrastructure operations
 */

const { normalizeToUri } = require('../utils/utils');

class DebtManager {
    /**
     * @param {Function} onScoreUpdate - Callback for score updates
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onScoreUpdate, updateFileColorsInExplorer = null, persistencePort, loggerPort = null) {
        if (!persistencePort) {
            throw new Error('DebtManager requires persistencePort');
        }
        
        this.onScoreUpdate = onScoreUpdate;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.persistencePort = persistencePort;
        this.loggerPort = loggerPort;
        this.debt = new Map(); // URI string -> debt object (FIXED: use URI as canonical key)
    }

    /**
     * Load debt from workspace storage
     */
    loadDebt() {
        if (!this.persistencePort) return;
        
        try {
            const stored = this.persistencePort.loadSync('debt');
            // Convert object to Map (workspaceState stores as object)
            let debtData;
            if (stored instanceof Map) {
                debtData = stored;
            } else if (stored && typeof stored === 'object') {
                debtData = new Map(Object.entries(stored));
            } else {
                debtData = new Map();
            }
            
            this.debt = debtData;
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: Loaded ${this.debt.size} files with debt`);
            }
            
            // Clean up old debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [path, debt] of this.debt.entries()) {
                if (debt.modifiedAt < sevenDaysAgo) {
                    this.debt.delete(path);
                    if (this.loggerPort) {
                        this.loggerPort.log(`AwarenessMonitor: Removed stale debt for ${path}`);
                    }
                }
            }
            
            // Save cleaned up data
            this.saveDebt();
        } catch (error) {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error loading debt', error);
            }
            this.debt = new Map();
        }
    }

    /**
     * Save debt to workspace storage
     */
    saveDebt() {
        if (!this.persistencePort) return;
        
        // Convert Map to object for storage (workspaceState stores as object)
        const debtObject = this.debt instanceof Map ? Object.fromEntries(this.debt) : this.debt;
        this.persistencePort.saveSync('debt', debtObject);
    }

    /**
     * Add file to debt
     * FIXED: Accept URI string as canonical identifier (works with remote workspaces)
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePathOrUri, changeSize, updateScore) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        const existing = this.debt.get(uri);
        const now = Date.now();
        
        if (existing && !existing.reviewed) {
            // File already has debt, accumulate it
            existing.totalChanges += changeSize;
            existing.lastModifiedAt = now;
            existing.modificationCount++;
        } else if (existing && existing.reviewed) {
            // File was reviewed but new changes came in - create new entry
            this.debt.set(uri, {
                modifiedAt: now,
                lastModifiedAt: now,
                totalChanges: changeSize,
                modificationCount: 1,
                reviewed: false,
                firstOpenedAt: null,
                totalReviewTime: 0,
                lastVisitedAt: null,
                reviewSessions: 0
            });
        } else {
            // New debt entry
            this.debt.set(uri, {
                modifiedAt: now,
                lastModifiedAt: now,
                totalChanges: changeSize,
                modificationCount: 1,
                reviewed: false,
                firstOpenedAt: null,
                totalReviewTime: 0,
                lastVisitedAt: null,
                reviewSessions: 0
            });
        }
        
        this.saveDebt();
        
        // Update file colors immediately when debt changes
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
        
        // Trigger immediate score update
        if (updateScore) {
            updateScore();
        }
    }

    /**
     * Get debt entry for a file
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Object|null} Debt object or null
     */
    getDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.debt.get(uri) || null;
    }

    /**
     * Mark debt as reviewed
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePathOrUri, reviewTime) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const debt = this.debt.get(uri);
        if (debt) {
            debt.reviewed = true;
            debt.reviewedAt = Date.now();
            debt.totalReviewTime += reviewTime;
            this.saveDebt();
            
            // Update file colors immediately when debt is cleared
            if (this.updateFileColorsInExplorer) {
                this.updateFileColorsInExplorer();
            }
        }
    }

    /**
     * Update debt with session info
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const debt = this.debt.get(uri);
        if (debt) {
            if (!debt.firstOpenedAt) {
                debt.firstOpenedAt = sessionData.sessionStart;
            }
            debt.lastVisitedAt = Date.now();
            debt.reviewSessions = (debt.reviewSessions || 0) + 1;
            this.saveDebt();
        }
    }

    /**
     * Calculate debt score (0-30)
     * High score = lots of unreviewed files (BAD in DEV mode)
     * @param {Array} aiSuggestions - Array of AI suggestions (for pending count)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        const unreviewedFiles = Array.from(this.debt.values())
            .filter(d => !d.reviewed);
        
        // Pending suggestions are also debt - they represent unreviewed AI-generated code
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s.status === 'pending') : [];
        
        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pendingSuggestions.length === 0) {
            return 0;
        }
        
        const now = Date.now();
        
        // Calculate debt severity
        let debtScore = 0;
        
        // 1. Number of unreviewed files (0-10 points)
        debtScore += Math.min(unreviewedFiles.length * 2, 10);
        
        // 2. Number of pending suggestions (0-10 points)
        // Each pending suggestion is unreviewed code that needs attention
        debtScore += Math.min(pendingSuggestions.length * 2, 10);
        
        // 3. Age of oldest unreviewed file or pending suggestion (0-10 points)
        const allDebtTimestamps = [
            ...unreviewedFiles.map(d => d.modifiedAt),
            ...pendingSuggestions.map(s => s.timestamp)
        ];
        
        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
            debtScore += Math.min(ageHours * 1.5, 10);
        }
        
        return Math.round(Math.min(debtScore, 30));
    }

    /**
     * Get debt summary for UI
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getDebtSummary() {
        const unreviewedFiles = Array.from(this.debt.entries())
            .filter(([_, debt]) => !debt.reviewed)
            .map(([path, debt]) => ({
                path: path,
                modifiedAt: debt.modifiedAt,
                age: Date.now() - debt.modifiedAt,
                modificationCount: debt.modificationCount,
                totalChanges: debt.totalChanges
            }))
            .sort((a, b) => b.age - a.age); // Oldest first
        
        return {
            total: unreviewedFiles.length,
            files: unreviewedFiles.slice(0, 10) // Top 10 oldest
        };
    }

    /**
     * Get the debt Map (for direct access when needed)
     * @returns {Map} Debt Map
     */
    getDebtMap() {
        return this.debt;
    }

    /**
     * Get size of debt
     * @returns {number} Number of files in debt
     */
    getDebtSize() {
        return this.debt.size;
    }

    /**
     * Check if file has unreviewed debt
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file has unreviewed debt
     */
    hasUnreviewedDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        const debt = this.debt.get(uri);
        return debt && !debt.reviewed;
    }
}

module.exports = DebtManager;

