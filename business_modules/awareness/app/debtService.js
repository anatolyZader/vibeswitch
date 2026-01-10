/**
 * DebtService - Application service for managing review debt
 * 
 * Orchestrates debt management: persistence, callbacks, and aggregate calculations.
 * This is an application service that coordinates Debt domain entities.
 */

const Debt = require('../domain/entities/debt');
const { normalizeToUri } = require('../domain/utils/utils');

class DebtService {
    /**
     * @param {Function} onScoreUpdate - Callback for score updates
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onScoreUpdate, updateFileColorsInExplorer = null, persistencePort, loggerPort = null) {
        if (!persistencePort) {
            throw new Error('DebtService requires persistencePort');
        }
        
        this.onScoreUpdate = onScoreUpdate;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.persistencePort = persistencePort;
        this.loggerPort = loggerPort;
        this.debts = new Map(); // URI string -> Debt entity
    }

    /**
     * Load debt from workspace storage
     */
    loadDebt() {
        if (!this.persistencePort) return;
        
        try {
            const stored = this.persistencePort.loadSync('debt');
            // Convert object to Map of Debt entities
            let debtData;
            if (stored instanceof Map) {
                debtData = stored;
            } else if (stored && typeof stored === 'object') {
                debtData = new Map(Object.entries(stored));
            } else {
                debtData = new Map();
            }
            
            // Convert plain objects to Debt entities
            this.debts = new Map();
            for (const [uri, data] of debtData.entries()) {
                if (data instanceof Debt) {
                    this.debts.set(uri, data);
                } else {
                    // Convert plain object to Debt entity
                    this.debts.set(uri, Debt.fromJSON(uri, data));
                }
            }
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: Loaded ${this.debts.size} files with debt`);
            }
            
            // Clean up old debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [uri, debt] of this.debts.entries()) {
                if (debt.modifiedAt < sevenDaysAgo) {
                    this.debts.delete(uri);
                    if (this.loggerPort) {
                        this.loggerPort.log(`AwarenessMonitor: Removed stale debt for ${uri}`);
                    }
                }
            }
            
            // Save cleaned up data
            this.saveDebt();
        } catch (error) {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error loading debt', error);
            }
            this.debts = new Map();
        }
    }

    /**
     * Save debt to workspace storage
     */
    saveDebt() {
        if (!this.persistencePort) return;
        
        // Convert Map of Debt entities to plain objects for storage
        const debtObject = {};
        for (const [uri, debt] of this.debts.entries()) {
            debtObject[uri] = debt.toJSON();
        }
        this.persistencePort.saveSync('debt', debtObject);
    }

    /**
     * Add file to debt
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePathOrUri, changeSize, updateScore) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        let debt = this.debts.get(uri);
        if (!debt) {
            // Create new Debt entity
            debt = new Debt(uri);
            this.debts.set(uri, debt);
        }
        
        // Use domain entity method
        debt.addChange(changeSize);
        
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
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Debt|null} Debt entity or null
     */
    getDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.debts.get(uri) || null;
    }

    /**
     * Mark debt as reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePathOrUri, reviewTime) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const debt = this.debts.get(uri);
        if (debt) {
            // Use domain entity method
            debt.markAsReviewed(reviewTime);
            this.saveDebt();
            
            // Update file colors immediately when debt is cleared
            if (this.updateFileColorsInExplorer) {
                this.updateFileColorsInExplorer();
            }
        }
    }

    /**
     * Update debt with session info
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const debt = this.debts.get(uri);
        if (debt) {
            // Use domain entity method
            debt.updateSession(sessionData);
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
        const unreviewedFiles = Array.from(this.debts.values())
            .filter(d => !d.isReviewed());
        
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
        const unreviewedFiles = Array.from(this.debts.entries())
            .filter(([_, debt]) => !debt.isReviewed())
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
     * @returns {Map<string, Debt>} Debt Map
     */
    getDebtMap() {
        return this.debts;
    }

    /**
     * Get size of debt
     * @returns {number} Number of files in debt
     */
    getDebtSize() {
        return this.debts.size;
    }

    /**
     * Check if file has unreviewed debt
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file has unreviewed debt
     */
    hasUnreviewedDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        const debt = this.debts.get(uri);
        return debt && !debt.isReviewed();
    }
}

module.exports = DebtService;
