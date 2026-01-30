/**
 * DebtService - Application service for managing review debt
 * 
 * Orchestrates debt management: persistence, callbacks, and aggregate calculations.
 * This is an application service that coordinates Debt domain entities.
 */

const FileDebt = require('../../domain/entities/fileDebt');
const vscodeDocUtilities = require('../utilities/vscodeDocUtilities');
const { calculateDebtScore, calculateRiskBasedDebtScore } = require('../scoring/scoreCalculations');
const safe = require('../../../../safe');

class DebtService {
    /**
     * @param {Function} onScoreUpdate - Callback for score updates
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     * @param {Function|null} getSemanticRiskMultiplier - Optional semantic risk multiplier provider
     * @param {TraceRecorder|null} traceRecorder - Optional dev-only trace recorder for replay fixtures
     */
    constructor(onScoreUpdate, updateFileColorsInExplorer = null, persistencePort, loggerPort = null, getSemanticRiskMultiplier = null, traceRecorder = null) {
        if (!persistencePort) {
            throw new Error('DebtService requires persistencePort');
        }
        
        this.onScoreUpdate = onScoreUpdate;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.persistencePort = persistencePort;
        this.loggerPort = loggerPort;
        this.getSemanticRiskMultiplier = typeof getSemanticRiskMultiplier === 'function' ? getSemanticRiskMultiplier : null;
        this.traceRecorder = traceRecorder || null;
        this.fileDebts = new Map(); // URI string -> FileDebt entity (file-level debt only)
        // Note: Suggestion-level debt is tracked via Suggestion entities (status === 'pending')
    }

    /**
     * Clear all file-level debt and persist (for reset/restart).
     * @returns {Promise<void>}
     */
    async clearAll() {
        this.fileDebts.clear();
        await this.saveDebt();
        if (this.loggerPort) {
            this.loggerPort.log('AwarenessMonitor: Cleared all file-level debt');
        }
        safe('updateFileColors', () => this.updateFileColorsInExplorer?.());
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
            // FIXED: Use correct field name (fileDebts, not debts)
            this.fileDebts = new Map();
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
        const uri = vscodeDocUtilities.normalizeToUri(null, filePathOrUri);
        if (!uri) return;
        
        let fileDebt = this.fileDebts.get(uri);
        if (!fileDebt) {
            // Create new FileDebt entity (file-level debt only)
            fileDebt = new FileDebt(uri);
            this.fileDebts.set(uri, fileDebt);
        }
        
        // Use domain entity method
        fileDebt.addChange(changeSize);
        
        if (this.traceRecorder && this.traceRecorder.isRecording && this.traceRecorder.isRecording()) {
            this.traceRecorder.push({ type: 'debt_added', fileUri: uri, size: changeSize, timestamp: Date.now() });
        }
        
        // Save debt (fire-and-forget in sync context)
        this.saveDebt().catch(err => {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error saving debt after add', err);
            }
        });
        
        // Update file colors immediately when debt changes
        safe('updateFileColors', () => this.updateFileColorsInExplorer?.());
        
        // Trigger immediate score update
        safe('updateScore', () => updateScore?.());
    }

    /**
     * Get file-level debt entry for a file
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {FileDebt|null} FileDebt entity or null
     */
    getDebt(filePathOrUri) {
        const uri = vscodeDocUtilities.normalizeToUri(null, filePathOrUri);
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
        const uri = vscodeDocUtilities.normalizeToUri(null, filePathOrUri);
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
            safe('updateFileColors', () => this.updateFileColorsInExplorer?.());
        }
    }

    /**
     * Update file-level debt with session info
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = vscodeDocUtilities.normalizeToUri(null, filePathOrUri);
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
     * @param {Object} options - Optional configuration
     * @param {boolean} options.useRiskBased - Use risk-based calculation (default: true, research-aligned)
     * @param {number} options.alpha - Provenance multiplier coefficient (default: 0.5, only used if useRiskBased=true)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions, options = {}) {
        const useRiskBased = options.useRiskBased !== false; // Default to true (new approach)
        
        // File-level debt: unreviewed file changes
        const unreviewedFiles = Array.from(this.fileDebts.values())
            .filter(d => !d.isReviewed());
        
        // Suggestion-level debt: pending AI suggestions (tracked separately)
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s && s.status === 'pending') : [];
        
        if (useRiskBased) {
            // New: Risk-based calculation (research-aligned)
            return calculateRiskBasedDebtScore(this.fileDebts, pendingSuggestions, {
                alpha: options.alpha,
                getSemanticRiskMultiplier: options.getSemanticRiskMultiplier || this.getSemanticRiskMultiplier || undefined
            });
        } else {
            // Legacy: Count-based calculation (backward compatible)
            return calculateDebtScore(this.fileDebts, pendingSuggestions);
        }
    }
    

    /**
     * Get file-level debt summary for UI
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * - total: full count (used for score and display count)
     * - files: top 10 oldest (for popup/tooltip display only)
     * - allFiles: full list (for file decorations and any logic that must see every file)
     * @returns {Object} Summary with total, files (top 10), allFiles (all)
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
            files: unreviewedFiles.slice(0, 10), // Top 10 oldest (popup only)
            allFiles: unreviewedFiles // Full list (decorations, score, etc.)
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
        const uri = vscodeDocUtilities.normalizeToUri(null, filePathOrUri);
        if (!uri) return false;
        const fileDebt = this.fileDebts.get(uri);
        return fileDebt && !fileDebt.isReviewed();
    }
}

module.exports = DebtService;


// ============================================================================
