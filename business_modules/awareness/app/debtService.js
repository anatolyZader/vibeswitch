/**
 * DebtService - Application service for managing review debt
 * 
 * Orchestrates debt management: persistence, callbacks, and aggregate calculations.
 * This is an application service that coordinates Debt domain entities.
 */

const FileDebt = require('../domain/entities/fileDebt');
const { normalizeToUri } = require('./vscodeDocUtilities');

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
        this.fileDebts = new Map(); // URI string -> FileDebt entity (file-level debt only)
        // Note: Suggestion-level debt is tracked via Suggestion entities (status === 'pending')
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
            
            // Convert plain objects to FileDebt entities
            this.fileDebts = new Map();
            for (const [uri, data] of debtData.entries()) {
                if (data instanceof FileDebt) {
                    this.fileDebts.set(uri, data);
                } else {
                    // Convert plain object to FileDebt entity
                    // Handle legacy "Debt" format for backward compatibility
                    this.fileDebts.set(uri, FileDebt.fromJSON(uri, data));
                }
            }
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: Loaded ${this.fileDebts.size} files with file-level debt`);
            }
            
            // Clean up old file debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [uri, fileDebt] of this.fileDebts.entries()) {
                if (fileDebt.modifiedAt < sevenDaysAgo) {
                    this.fileDebts.delete(uri);
                    if (this.loggerPort) {
                        this.loggerPort.log(`AwarenessMonitor: Removed stale file debt for ${uri}`);
                    }
                }
            }
            
            // Save cleaned up data (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after cleanup', err);
                }
            });
        } catch (error) {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error loading debt', error);
            }
            this.debts = new Map();
        }
    }

    /**
     * Save debt to workspace storage (async)
     * @returns {Promise<void>}
     */
    async saveDebt() {
        if (!this.persistencePort) return;
        
        // Convert Map of FileDebt entities to plain objects for storage
        const debtObject = {};
        for (const [uri, fileDebt] of this.fileDebts.entries()) {
            debtObject[uri] = fileDebt.toJSON();
        }
        await this.persistencePort.save('debt', debtObject);
    }

    /**
     * Add file-level debt (for file changes, not suggestions)
     * Note: Suggestion-level debt is tracked separately via Suggestion entities.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePathOrUri, changeSize, updateScore) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        let fileDebt = this.fileDebts.get(uri);
        if (!fileDebt) {
            // Create new FileDebt entity (file-level debt only)
            fileDebt = new FileDebt(uri);
            this.fileDebts.set(uri, fileDebt);
        }
        
        // Use domain entity method
        fileDebt.addChange(changeSize);
        
        // Save debt (fire-and-forget in sync context)
        this.saveDebt().catch(err => {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error saving debt after add', err);
            }
        });
        
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
     * Get file-level debt entry for a file
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {FileDebt|null} FileDebt entity or null
     */
    getDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.fileDebts.get(uri) || null;
    }

    /**
     * Mark file-level debt as reviewed
     * Note: This only marks FILE-LEVEL debt. Pending suggestions are tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePathOrUri, reviewTime) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const fileDebt = this.fileDebts.get(uri);
        if (fileDebt) {
            // Use domain entity method (file-level debt only)
            fileDebt.markAsReviewed(reviewTime);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after markAsReviewed', err);
                }
            });
            
            // Update file colors immediately when debt is cleared
            if (this.updateFileColorsInExplorer) {
                this.updateFileColorsInExplorer();
            }
        }
    }

    /**
     * Update file-level debt with session info
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const fileDebt = this.fileDebts.get(uri);
        if (fileDebt) {
            // Use domain entity method
            fileDebt.updateSession(sessionData);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after updateSession', err);
                }
            });
        }
    }

    /**
     * Calculate debt score (0-30) - combines file-level and suggestion-level debt
     * High score = lots of unreviewed files + pending suggestions (BAD in DEV mode)
     * 
     * This properly separates:
     * - FileDebt: Unreviewed changes in files (file-level)
     * - SuggestionDebt: Pending AI suggestions (suggestion-level, tracked via Suggestion entities)
     * 
     * @param {Array} aiSuggestions - Array of AI suggestions (for suggestion-level debt)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        // File-level debt: unreviewed file changes
        const unreviewedFiles = Array.from(this.fileDebts.values())
            .filter(d => !d.isReviewed());
        
        // Suggestion-level debt: pending AI suggestions (tracked separately)
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s && s.status === 'pending') : [];
        
        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pendingSuggestions.length === 0) {
            return 0;
        }
        
        const now = Date.now();
        
        // Calculate debt severity (combines both types)
        let debtScore = 0;
        
        // 1. Number of unreviewed files (file-level debt) (0-10 points)
        debtScore += Math.min(unreviewedFiles.length * 2, 10);
        
        // 2. Number of pending suggestions (suggestion-level debt) (0-10 points)
        // Each pending suggestion is unreviewed AI-generated code that needs attention
        debtScore += Math.min(pendingSuggestions.length * 2, 10);
        
        // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
        const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
        const suggestionDebtTimestamps = pendingSuggestions.map(s => s.timestamp || now);
        const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];
        
        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
            debtScore += Math.min(ageHours * 1.5, 10);
        }
        
        return Math.round(Math.min(debtScore, 30));
    }
    
    /**
     * Calculate debt score using domain service (delegates to DebtCalculationServiceD)
     * This properly separates file-level and suggestion-level debt.
     * @param {Array} aiSuggestions - Array of AI suggestions (for suggestion-level debt)
     * @param {DebtCalculationServiceD} debtCalculationServiceD - Domain service for debt calculations
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScoreWithDomainService(aiSuggestions, debtCalculationServiceD) {
        if (!debtCalculationServiceD) {
            // Fallback to app-level calculation if domain service not provided
            return this.calculateDebtScore(aiSuggestions);
        }
        
        // Delegate to domain service with proper separation
        return debtCalculationServiceD.calculateDebtScore(this.fileDebts, aiSuggestions);
    }

    /**
     * Get file-level debt summary for UI
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getDebtSummary() {
        const unreviewedFiles = Array.from(this.fileDebts.entries())
            .filter(([_, fileDebt]) => !fileDebt.isReviewed())
            .map(([path, fileDebt]) => ({
                path: path,
                modifiedAt: fileDebt.modifiedAt,
                age: Date.now() - fileDebt.modifiedAt,
                modificationCount: fileDebt.modificationCount,
                totalChanges: fileDebt.totalChanges
            }))
            .sort((a, b) => b.age - a.age); // Oldest first
        
        return {
            total: unreviewedFiles.length,
            files: unreviewedFiles.slice(0, 10) // Top 10 oldest
        };
    }

    /**
     * Get the file-level debt Map (for direct access when needed)
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @returns {Map<string, FileDebt>} FileDebt Map
     */
    getDebtMap() {
        return this.fileDebts;
    }

    /**
     * Get size of file-level debt
     * Note: This returns file-level debt count only. Suggestion debt is tracked separately.
     * @returns {number} Number of files with file-level debt
     */
    getDebtSize() {
        return this.fileDebts.size;
    }

    /**
     * Check if file has unreviewed file-level debt
     * Note: This checks file-level debt only. Pending suggestions are tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file has unreviewed file-level debt
     */
    hasUnreviewedDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        const fileDebt = this.fileDebts.get(uri);
        return fileDebt && !fileDebt.isReviewed();
    }
}

module.exports = DebtService;
