/**
 * DOMAIN LAYER - CONSOLIDATED (PART 2/3)
 * 
 * This file contains part 2 of 3 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 15/50
 * Generated: 2026-01-13T17:41:29.112Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 18/50: domain/ports/IAwarenessVSCodePort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IAwarenessVSCodePort.js
/**
 * IAwarenessVSCodePort - Interface for VS Code API operations used by the Awareness module
 * 
 * This port abstracts ONLY the VS Code operations that the awareness module requires.
 * It is module-specific and does not include general-purpose VS Code methods.
 * 
 * This enables:
 * - Testability without VS Code extension host
 * - Flexibility to swap implementations
 * - Clear separation between domain and infrastructure
 * - Module-specific contracts (not general-purpose adapters)
 * 
 * Implementations should wrap the actual VS Code API.
 */

/**
 * @interface IAwarenessVSCodePort
 */
class IAwarenessVSCodePort {
    // ============================================================================
    // Document Event Handlers (used by EventHandlers entity)
    // ============================================================================
    
    /**
     * Register a handler for text document changes
     * @param {Function} handler - Handler function receiving TextDocumentChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextDocument(handler) {
        throw new Error('onDidChangeTextDocument not implemented');
    }

    /**
     * Register a handler for file creation events
     * @param {Function} handler - Handler function receiving FileCreateEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidCreateFiles(handler) {
        throw new Error('onDidCreateFiles not implemented');
    }

    /**
     * Register a handler for file save events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidSaveTextDocument(handler) {
        throw new Error('onDidSaveTextDocument not implemented');
    }

    /**
     * Register a handler for file open events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidOpenTextDocument(handler) {
        throw new Error('onDidOpenTextDocument not implemented');
    }

    /**
     * Register a handler for file close events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidCloseTextDocument(handler) {
        throw new Error('onDidCloseTextDocument not implemented');
    }

    // ============================================================================
    // Editor Event Handlers (used by EventHandlers entity)
    // ============================================================================
    
    /**
     * Register a handler for text editor selection changes
     * @param {Function} handler - Handler function receiving TextEditorSelectionChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextEditorSelection(handler) {
        throw new Error('onDidChangeTextEditorSelection not implemented');
    }

    /**
     * Register a handler for text editor visible range changes
     * @param {Function} handler - Handler function receiving TextEditorVisibleRangesChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextEditorVisibleRanges(handler) {
        throw new Error('onDidChangeTextEditorVisibleRanges not implemented');
    }

    /**
     * Register a handler for active text editor changes
     * @param {Function} handler - Handler function receiving TextEditor | undefined
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeActiveTextEditor(handler) {
        throw new Error('onDidChangeActiveTextEditor not implemented');
    }

    // ============================================================================
    // Workspace Operations (used by FileWatcher, ScoreCalculator, EventHandlers)
    // ============================================================================
    
    /**
     * Convert a URI to a relative path string
     * @param {Object} uri - VS Code URI object
     * @returns {string} Relative path string
     */
    asRelativePath(uri) {
        throw new Error('asRelativePath not implemented');
    }

    /**
     * Get workspace folders
     * @returns {Array|undefined} Array of workspace folders or undefined
     */
    get workspaceFolders() {
        throw new Error('workspaceFolders getter not implemented');
    }

    /**
     * Get all open text documents
     * @returns {Array} Array of TextDocument instances
     */
    get textDocuments() {
        throw new Error('textDocuments getter not implemented');
    }

    /**
     * Open a text document
     * @param {Object} uri - VS Code URI object
     * @returns {Promise<Object>} TextDocument instance
     */
    openTextDocument(uri) {
        throw new Error('openTextDocument not implemented');
    }

    // ============================================================================
    // VS Code Types (used for constructing Range, Position, Uri objects)
    // ============================================================================
    
    /**
     * Get VS Code Range constructor
     * @returns {Function} Range constructor
     */
    get Range() {
        throw new Error('Range getter not implemented');
    }

    /**
     * Get VS Code Position constructor
     * @returns {Function} Position constructor
     */
    get Position() {
        throw new Error('Position getter not implemented');
    }

    /**
     * Get VS Code Uri constructor
     * @returns {Function} Uri constructor
     */
    get Uri() {
        throw new Error('Uri getter not implemented');
    }
}

// module.exports = IAwarenessVSCodePort; // Commented for consolidation

})(); // End IIFE for domain/ports/IAwarenessVSCodePort.js


// ============================================================================
// FILE 19/50: domain/ports/IFileSystemPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IFileSystemPort.js
/**
 * IFileSystemPort - Port interface for filesystem operations
 * 
 * Defines the contract for filesystem access.
 * Domain entities should use this port instead of directly importing fs module.
 */

class IFileSystemPort {
    constructor() {
        if (new.target === IFileSystemPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Watch a directory for changes
     * @param {string} path - Path to watch
     * @param {Object} options - Watch options (recursive, etc.)
     * @param {Function} callback - Callback function (eventType, filename)
     * @returns {Object} Watcher object with close() method
     */
    watch(path, options, callback) {
        throw new Error('Method not implemented.');
    }

    /**
     * Get file stats asynchronously
     * @param {string} path - File path
     * @param {Function} callback - Callback function (err, stats)
     */
    stat(path, callback) {
        throw new Error('Method not implemented.');
    }

    /**
     * Read directory contents synchronously
     * @param {string} path - Directory path
     * @param {Object} options - Options (withFileTypes, etc.)
     * @returns {Array} Array of directory entries
     */
    readdirSync(path, options) {
        throw new Error('Method not implemented.');
    }

    /**
     * Read file contents synchronously
     * @param {string} path - File path
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {string|Buffer} File contents
     */
    readFileSync(path, encoding = 'utf8') {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IFileSystemPort; // Commented for consolidation

})(); // End IIFE for domain/ports/IFileSystemPort.js


// ============================================================================
// FILE 20/50: domain/ports/IHashGeneratorPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IHashGeneratorPort.js
/**
 * IHashGeneratorPort - Port interface for hashing operations
 * 
 * Defines the contract for generating hashes.
 * Domain entities should use this port instead of directly using crypto module.
 */

class IHashGeneratorPort {
    constructor() {
        if (new.target === IHashGeneratorPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Create a hash from data
     * @param {string} algorithm - Hash algorithm (e.g., 'md5', 'sha256')
     * @param {string|Buffer} data - Data to hash
     * @returns {string} Hash string (hex)
     */
    createHash(algorithm, data) {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IHashGeneratorPort; // Commented for consolidation

})(); // End IIFE for domain/ports/IHashGeneratorPort.js


// ============================================================================
// FILE 21/50: domain/ports/IIdGeneratorPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IIdGeneratorPort.js
/**
 * IIdGeneratorPort - Port interface for ID generation
 * 
 * Defines the contract for generating unique identifiers.
 * Domain entities should use this port instead of directly using crypto or Date.now().
 */

class IIdGeneratorPort {
    constructor() {
        if (new.target === IIdGeneratorPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Generate a UUID
     * @returns {string} UUID string
     */
    generateUUID() {
        throw new Error('Method not implemented.');
    }

    /**
     * Generate a unique ID (fallback if UUID not available)
     * @returns {string} Unique ID string
     */
    generateId() {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IIdGeneratorPort; // Commented for consolidation

})(); // End IIFE for domain/ports/IIdGeneratorPort.js


// ============================================================================
// FILE 22/50: domain/ports/ILoggerPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/ILoggerPort.js
/**
 * ILoggerPort - Port interface for logging operations
 * 
 * Defines the contract for logging functionality.
 * Domain entities should use this port instead of directly importing logger implementations.
 */

class ILoggerPort {
    constructor() {
        if (new.target === ILoggerPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Log a message
     * @param {string} message - The message to log
     * @param {boolean} force - Force log even if throttled (for important messages)
     * @param {boolean} show - Show output channel
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    log(message, force = false, show = false, sourceKey = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Log a debug message
     * @param {string} message - The debug message to log
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    debug(message, sourceKey = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Log an error message
     * @param {string} message - The error message to log
     * @param {Error} error - Optional error object
     */
    error(message, error = null) {
        throw new Error('Method not implemented.');
    }
}

// module.exports = ILoggerPort; // Commented for consolidation

})(); // End IIFE for domain/ports/ILoggerPort.js


// ============================================================================
// FILE 23/50: domain/services/changeClassificationServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/changeClassificationServiceD.js
/**
 * ChangeClassificationServiceD - Domain service for change classification operations
 * 
 * Encapsulates business logic for classifying changes as AI, user, or formatter.
 * This is a domain service that uses classification detectors and scorers.
 */

// const { accumulateScores, determineLabel } = require('../utils/classificationScorer'); // Commented for consolidation

class ChangeClassificationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Classify a change based on detectors
     * @param {Change} change - Change entity
     * @param {Object} detectors - Classification detectors
     * @param {Object} config - Classification configuration
     * @returns {Object} Classification result {label, confidence, reasons, meta}
     */
    classifyChange(change, detectors, config) {
        if (!change) {
            return { label: 'unknown', confidence: 0, reasons: ['No change provided'] };
        }

        // Calculate scores from detectors
        const scores = this.calculateClassificationScore(detectors, change);
        
        // Determine label from scores
        const label = this.determineClassificationLabel(
            scores.aiScore,
            scores.formatterScore,
            scores.userScore
        );

        // Calculate confidence (normalized to 0-1)
        const totalScore = scores.aiScore + scores.formatterScore + scores.userScore;
        const confidence = totalScore > 0 
            ? Math.max(scores.aiScore, scores.formatterScore, scores.userScore) / totalScore
            : 0;

        // Collect reasons from detectors
        const reasons = scores.reasons || [];

        // Validate classification
        const classification = { label, confidence, reasons, meta: scores.meta || {} };
        if (!this.validateClassification(classification)) {
            return { label: 'unknown', confidence: 0, reasons: ['Invalid classification'] };
        }

        return classification;
    }

    /**
     * Calculate classification scores from detectors
     * @param {Object} detectors - Classification detectors
     * @param {Change} change - Change entity
     * @returns {Object} Scores {aiScore, formatterScore, userScore, reasons, meta}
     */
    calculateClassificationScore(detectors, change) {
        if (!detectors || !change) {
            return { aiScore: 0, formatterScore: 0, userScore: 0, reasons: [] };
        }

        // Use accumulateScores utility if available
        if (typeof accumulateScores === 'function') {
            return accumulateScores(detectors);
        }

        // Fallback: manual accumulation
        let aiScore = 0;
        let formatterScore = 0;
        let userScore = 0;
        const reasons = [];
        const meta = {};

        // Run each detector and accumulate scores
        for (const [name, detector] of Object.entries(detectors)) {
            if (typeof detector === 'function') {
                try {
                    const result = detector(change);
                    if (result) {
                        if (result.label === 'ai') {
                            aiScore += result.scoreDelta || 0;
                        } else if (result.label === 'formatter') {
                            formatterScore += result.scoreDelta || 0;
                        } else if (result.label === 'user') {
                            userScore += result.scoreDelta || 0;
                        }
                        
                        if (result.reason) {
                            reasons.push(result.reason);
                        }
                        
                        if (result.meta) {
                            meta[name] = result.meta;
                        }
                    }
                } catch (error) {
                    // Skip detector on error
                }
            }
        }

        return { aiScore, formatterScore, userScore, reasons, meta };
    }

    /**
     * Determine classification label from scores
     * @param {number} aiScore - AI score
     * @param {number} formatterScore - Formatter score
     * @param {number} userScore - User score
     * @returns {string} Label: 'ai' | 'formatter' | 'user' | 'unknown'
     */
    determineClassificationLabel(aiScore, formatterScore, userScore) {
        if (typeof determineLabel === 'function') {
            return determineLabel(aiScore, formatterScore, userScore);
        }

        // Fallback: manual determination
        const maxScore = Math.max(aiScore, formatterScore, userScore);
        
        if (maxScore <= 0) {
            return 'unknown';
        }

        if (formatterScore === maxScore) {
            return 'formatter';
        }
        
        if (aiScore === maxScore) {
            return 'ai';
        }
        
        if (userScore === maxScore) {
            return 'user';
        }

        return 'unknown';
    }

    /**
     * Validate classification result
     * @param {Object} classification - Classification result
     * @returns {boolean} True if valid
     */
    validateClassification(classification) {
        if (!classification) return false;
        
        const validLabels = ['ai', 'formatter', 'user', 'unknown'];
        if (!validLabels.includes(classification.label)) {
            return false;
        }

        if (typeof classification.confidence !== 'number' || 
            classification.confidence < 0 || 
            classification.confidence > 1) {
            return false;
        }

        if (!Array.isArray(classification.reasons)) {
            return false;
        }

        return true;
    }

    /**
     * Merge classifications for a batch of changes
     * @param {Array<Change>} changes - Array of changes
     * @returns {Object} Merged classification
     */
    mergeBatchClassifications(changes) {
        if (!changes || changes.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: [] };
        }

        // Get all classifications
        const classifications = changes
            .filter(c => c.classification)
            .map(c => c.classification);

        if (classifications.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: [] };
        }

        // Count labels
        const labelCounts = { ai: 0, formatter: 0, user: 0, unknown: 0 };
        let totalConfidence = 0;
        const allReasons = [];

        for (const classification of classifications) {
            labelCounts[classification.label] = (labelCounts[classification.label] || 0) + 1;
            totalConfidence += classification.confidence || 0;
            if (classification.reasons) {
                allReasons.push(...classification.reasons);
            }
        }

        // Determine dominant label
        const dominantLabel = Object.entries(labelCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        // Calculate average confidence
        const avgConfidence = totalConfidence / classifications.length;

        // Deduplicate reasons
        const uniqueReasons = [...new Set(allReasons)];

        return {
            label: dominantLabel,
            confidence: avgConfidence,
            reasons: uniqueReasons,
            meta: {
                totalChanges: changes.length,
                classifiedChanges: classifications.length,
                labelDistribution: labelCounts
            }
        };
    }
}

// module.exports = ChangeClassificationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/changeClassificationServiceD.js


// ============================================================================
// FILE 24/50: domain/services/debtCalculationServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/debtCalculationServiceD.js
/**
 * DebtCalculationServiceD - Domain service for debt calculation operations
 * 
 * Encapsulates business logic for calculating debt scores and aggregating debt metrics.
 * This is a domain service (stateless, no ports needed).
 */

class DebtCalculationServiceD {
    constructor() {
        // No constructor dependencies - stateless domain service
    }

    /**
     * Calculate debt score (0-30) - combines file-level and suggestion-level debt
     * 
     * Properly separates:
     * - FileDebt: Unreviewed changes in files (file-level)
     * - SuggestionDebt: Pending AI suggestions (suggestion-level)
     * 
     * @param {Map<string, FileDebt>} fileDebts - Map of file-level debt entities
     * @param {Array<Suggestion>} pendingSuggestions - Pending suggestions (suggestion-level debt)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(fileDebts, pendingSuggestions) {
        if (!fileDebts) fileDebts = new Map();
        if (!pendingSuggestions) pendingSuggestions = [];

        // File-level debt: unreviewed file changes
        const unreviewedFiles = Array.from(fileDebts.values())
            .filter(d => d && !d.isReviewed());

        // Suggestion-level debt: pending AI suggestions (tracked separately)
        const pending = pendingSuggestions.filter(s => s && s.status === 'pending');

        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pending.length === 0) {
            return 0;
        }

        const now = Date.now();

        // Calculate debt severity
        let debtScore = 0;

        // 1. Number of unreviewed files (0-10 points)
        debtScore += this.calculateDebtCountScore(unreviewedFiles.length);

        // 2. Number of pending suggestions (0-10 points)
        debtScore += this.calculateDebtPendingScore(pending.length);

        // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
        // Combines both file-level and suggestion-level debt timestamps
        const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
        const suggestionDebtTimestamps = pending.map(s => s.timestamp || now);
        const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];

        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            debtScore += this.calculateDebtAgeScore(oldestDebt, now);
        }

        return Math.round(Math.min(debtScore, 30));
    }

    /**
     * Calculate debt age component (0-10)
     * @param {number} oldestDebtTimestamp - Oldest debt timestamp
     * @param {number} now - Current timestamp
     * @returns {number} Age score (0-10)
     */
    calculateDebtAgeScore(oldestDebtTimestamp, now) {
        if (!oldestDebtTimestamp || !now) return 0;

        const ageHours = (now - oldestDebtTimestamp) / (1000 * 60 * 60);
        return Math.min(ageHours * 1.5, 10);
    }

    /**
     * Calculate debt count component (0-10)
     * @param {number} unreviewedFileCount - Count of unreviewed files
     * @returns {number} Count score (0-10)
     */
    calculateDebtCountScore(unreviewedFileCount) {
        if (!unreviewedFileCount || unreviewedFileCount <= 0) return 0;
        return Math.min(unreviewedFileCount * 2, 10);
    }

    /**
     * Calculate debt pending component (0-10)
     * @param {number} pendingSuggestionCount - Count of pending suggestions
     * @returns {number} Pending score (0-10)
     */
    calculateDebtPendingScore(pendingSuggestionCount) {
        if (!pendingSuggestionCount || pendingSuggestionCount <= 0) return 0;
        return Math.min(pendingSuggestionCount * 2, 10);
    }

    /**
     * Aggregate file-level debt metrics
     * Note: This aggregates file-level debt only. Suggestion debt is tracked separately.
     * @param {Map<string, FileDebt>} fileDebts - Map of file-level debt entities
     * @returns {Object} Aggregated metrics
     */
    aggregateDebtMetrics(fileDebts) {
        if (!fileDebts) fileDebts = new Map();

        const debtArray = Array.from(fileDebts.values()).filter(d => d);
        const unreviewed = debtArray.filter(d => !d.isReviewed());

        const totalChanges = debtArray.reduce((sum, d) => sum + (d.totalChanges || 0), 0);
        const totalReviewTime = debtArray.reduce((sum, d) => sum + (d.totalReviewTime || 0), 0);
        const totalSessions = debtArray.reduce((sum, d) => sum + (d.reviewSessions || 0), 0);

        const timestamps = unreviewed.map(d => d.modifiedAt || 0).filter(t => t > 0);
        const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
        const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

        const ages = timestamps.map(t => Date.now() - t);
        const avgAge = ages.length > 0 
            ? ages.reduce((sum, age) => sum + age, 0) / ages.length 
            : 0;

        return {
            total: debtArray.length,
            unreviewed: unreviewed.length,
            totalChanges,
            totalReviewTime,
            totalSessions,
            oldestTimestamp,
            newestTimestamp,
            avgAge,
            oldestAge: oldestTimestamp ? Date.now() - oldestTimestamp : 0
        };
    }

    /**
     * Determine if file-level debt should be evicted
     * @param {FileDebt} fileDebt - File-level debt entity
     * @param {number} evictionThreshold - Eviction threshold in milliseconds
     * @returns {boolean} True if should evict
     */
    shouldEvictDebt(fileDebt, evictionThreshold) {
        if (!fileDebt || !evictionThreshold) return false;

        const age = Date.now() - (fileDebt.modifiedAt || 0);
        return age > evictionThreshold;
    }
}

// module.exports = DebtCalculationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/debtCalculationServiceD.js


// ============================================================================
// FILE 25/50: domain/services/rangeOperationServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/rangeOperationServiceD.js
/**
 * RangeOperationServiceD - Domain service for range and position operations
 * 
 * Encapsulates core domain business logic for range/position operations.
 * Technical utilities (merge, union, intersection, validation) are in app layer.
 */

class RangeOperationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Check if two ranges overlap (domain business logic)
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Range} range1 - First range
     * @param {Range} range2 - Second range
     * @returns {boolean} True if ranges overlap
     */
    rangesOverlap(vscodePort, range1, range2) {
        if (!range1 || !range2) return false;
        // Use VS Code's built-in intersection method for accurate overlap detection
        return range1.intersection(range2) !== undefined;
    }

    /**
     * Check if position is within range (domain business logic)
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Position} position - Position to check
     * @param {Range} range - Range to check against
     * @returns {boolean} True if position is in range
     */
    isPositionInRange(vscodePort, position, range) {
        if (!position || !range) return false;
        
        if (position.line < range.start.line || position.line > range.end.line) {
            return false;
        }
        if (position.line === range.start.line && position.character < range.start.character) {
            return false;
        }
        if (position.line === range.end.line && position.character > range.end.character) {
            return false;
        }
        return true;
    }
}

// module.exports = RangeOperationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/rangeOperationServiceD.js


// ============================================================================
// FILE 26/50: domain/services/reviewSessionServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/reviewSessionServiceD.js
/**
 * ReviewSessionServiceD - Domain service for review session operations
 * 
 * Encapsulates business logic for calculating review session metrics and validations.
 * This is a domain service (stateless, no ports needed).
 */

class ReviewSessionServiceD {
    constructor() {
        // No constructor dependencies - stateless domain service
    }

    /**
     * Calculate engagement score (0-100)
     * @param {ReviewSession} session - Review session entity
     * @returns {number} Engagement score
     */
    calculateEngagementScore(session) {
        if (!session) return 0;

        const duration = session.getDuration ? session.getDuration() : (Date.now() - session.sessionStart);
        const cursorMovements = session.cursorMovements || 0;
        const scrollEvents = session.scrollEvents || 0;

        // Duration score (max 40 points)
        const durationScore = Math.min((duration / 60000) * 40, 40);
        
        // Movement score (max 30 points)
        const movementScore = Math.min((cursorMovements / 20) * 30, 30);
        
        // Scroll score (max 30 points)
        const scrollScore = Math.min((scrollEvents / 10) * 30, 30);
        
        return Math.min(durationScore + movementScore + scrollScore, 100);
    }

    /**
     * Check if session has sufficient engagement
     * @param {ReviewSession} session - Review session entity
     * @param {Object} thresholds - Thresholds {minReviewTime, minMovements, minScrolls}
     * @returns {boolean} True if sufficient engagement
     */
    hasSufficientEngagement(session, thresholds = {}) {
        if (!session) return false;

        const {
            minReviewTime = 30000,
            minMovements = 5,
            minScrolls = 3
        } = thresholds;

        const duration = session.getDuration ? session.getDuration() : (Date.now() - session.sessionStart);
        const cursorMovements = session.cursorMovements || 0;
        const scrollEvents = session.scrollEvents || 0;

        return duration >= minReviewTime && 
               (cursorMovements >= minMovements || scrollEvents >= minScrolls);
    }

    /**
     * Calculate total review time
     * @param {ReviewSession} session - Review session entity
     * @returns {number} Review time in milliseconds
     */
    calculateReviewTime(session) {
        if (!session) return 0;

        if (session.completedAt) {
            return session.completedAt - session.sessionStart;
        }

        return Date.now() - session.sessionStart;
    }

    /**
     * Determine if session should timeout
     * @param {ReviewSession} session - Review session entity
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {boolean} True if should timeout
     */
    shouldTimeoutSession(session, timeoutMs = 60000) {
        if (!session) return false;

        const timeSinceActivity = session.getTimeSinceActivity 
            ? session.getTimeSinceActivity() 
            : (Date.now() - (session.lastActivity || session.sessionStart));

        return timeSinceActivity > timeoutMs;
    }
}

// module.exports = ReviewSessionServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/reviewSessionServiceD.js


// ============================================================================
// FILE 27/50: domain/services/scoreCalculationServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/scoreCalculationServiceD.js
/**
 * ScoreCalculationServiceD - Domain service for calculating awareness score components
 * 
 * Encapsulates pure domain business logic for calculating score components.
 * This is a stateless domain service - no ports, no state, no orchestration.
 * 
 * Orchestration (time filtering, callbacks, state management) is in app layer.
 */

class ScoreCalculationServiceD {
    constructor() {
        // No constructor dependencies - stateless domain service
    }

    /**
     * Calculate review score (0-40)
     * High score = user carefully reviewed code
     * @param {Array<Suggestion>} suggestions - Array of suggestions
     * @returns {number} Review score (0-40)
     */
    calculateReviewScore(suggestions) {
        if (!suggestions || suggestions.length === 0) return 0;

        const reviewedCount = suggestions.filter(s => s.reviewed).length;
        const totalReviewTime = suggestions.reduce((sum, s) => sum + (s.reviewTime || 0), 0);
        const avgReviewTime = totalReviewTime / suggestions.length;
        
        // Review rate (0-20): % of suggestions reviewed
        const reviewRate = (reviewedCount / suggestions.length) * 20;
        
        // Review depth (0-20): Average time spent reviewing
        // Good: 10+ seconds per suggestion = 20 points
        // Fair: 5-10 seconds = 10-20 points
        // Poor: <5 seconds = 0-10 points
        const reviewDepth = Math.min((avgReviewTime / 10000) * 20, 20);
        
        return Math.round(reviewRate + reviewDepth);
    }

    /**
     * Calculate critical evaluation score (0-30)
     * High score = user is selective (accepts some, rejects some)
     * LOW SCORE = GOOD in DEV mode (means careful, not blind acceptance)
     * @param {Array<Suggestion>} suggestions - Array of suggestions
     * @returns {number} Critical score (0-30)
     */
    calculateCriticalScore(suggestions) {
        if (!suggestions || suggestions.length === 0) return 0;

        const accepted = suggestions.filter(s => s.status === 'accepted').length;
        const rejected = suggestions.filter(s => s.status === 'rejected').length;
        const total = suggestions.length;
        
        const acceptRate = accepted / total;
        const rejectRate = rejected / total;
        
        // INVERTED: In DEV mode, blind acceptance = HIGH score (bad)
        // We want LOW scores (careful review, selective acceptance)
        
        if (acceptRate === 1.0) {
            // Accepts everything blindly - WORST (high score = bad in DEV)
            return 30;
        } else if (rejectRate === 1.0) {
            // Rejects everything (not using AI effectively)
            return 20;
        } else if (acceptRate >= 0.6 && acceptRate <= 0.8) {
            // Moderate acceptance - not great, not terrible
            return 15;
        } else if (acceptRate < 0.5) {
            // Low acceptance rate = careful review = BEST
            return 0;
        } else {
            // Linear interpolation for other cases
            return Math.round(acceptRate * 30);
        }
    }

    /**
     * Calculate adaptation score (0-30)
     * High score = user customizes AI suggestions
     * @param {Array<Suggestion>} suggestions - Array of suggestions
     * @returns {number} Adaptation score (0-30)
     */
    calculateAdaptationScore(suggestions) {
        if (!suggestions || suggestions.length === 0) return 0;

        const adapted = suggestions.filter(s => s.status === 'adapted').length;
        const adaptRate = adapted / suggestions.length;
        
        // Average edits per suggestion
        const totalEdits = suggestions.reduce((sum, s) => sum + (s.editCount || 0), 0);
        const avgEdits = totalEdits / suggestions.length;
        
        // Adaptation rate (0-15): % of suggestions user edited
        const adaptationRate = adaptRate * 15;
        
        // Adaptation depth (0-15): How much editing per suggestion
        // Good: 2+ edits = 15 points
        // Fair: 1 edit = 7.5 points
        // Poor: 0 edits = 0 points
        const adaptationDepth = Math.min((avgEdits / 2) * 15, 15);
        
        return Math.round(adaptationRate + adaptationDepth);
    }
}

// module.exports = ScoreCalculationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/scoreCalculationServiceD.js


// ============================================================================
// FILE 28/50: domain/services/suggestionBatchServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/suggestionBatchServiceD.js
/**
 * SuggestionBatchServiceD - Domain service for suggestion batch operations
 * 
 * Encapsulates business logic for managing suggestion batches and detecting patterns.
 * This is a domain service that uses ID generator port for batch creation.
 */

// const SuggestionBatch = require('../entities/suggestionBatch'); // Commented for consolidation

class SuggestionBatchServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Create a new batch
     * @param {IIdGeneratorPort} idGeneratorPort - ID generator port
     * @param {string} documentUri - Document URI
     * @param {string} suggestionId - First suggestion ID
     * @param {number} size - Suggestion size
     * @returns {SuggestionBatch} New batch entity
     */
    createBatch(idGeneratorPort, documentUri, suggestionId, size) {
        if (!idGeneratorPort) {
            throw new Error('SuggestionBatchServiceD.createBatch requires idGeneratorPort');
        }
        if (!documentUri || !suggestionId || size === undefined) {
            throw new Error('SuggestionBatchServiceD.createBatch requires documentUri, suggestionId, and size');
        }

        let batchId;
        try {
            batchId = idGeneratorPort.generateUUID();
        } catch (e) {
            batchId = idGeneratorPort.generateId();
        }

        const batch = new SuggestionBatch(batchId, documentUri, Date.now());
        batch.addSuggestion(suggestionId, size);

        return batch;
    }

    /**
     * Add suggestion to batch
     * @param {SuggestionBatch} batch - Batch entity
     * @param {string} suggestionId - Suggestion ID
     * @param {number} size - Suggestion size
     */
    addSuggestionToBatch(batch, suggestionId, size) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            throw new Error('SuggestionBatchServiceD.addSuggestionToBatch requires SuggestionBatch entity');
        }
        if (!suggestionId || size === undefined) {
            throw new Error('SuggestionBatchServiceD.addSuggestionToBatch requires suggestionId and size');
        }

        batch.addSuggestion(suggestionId, size);
    }

    /**
     * Update batch outcome
     * @param {SuggestionBatch} batch - Batch entity
     * @param {string} suggestionId - Suggestion ID
     * @param {string} outcome - Outcome: 'accepted' | 'rejected' | 'modified'
     */
    updateBatchOutcome(batch, suggestionId, outcome) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            throw new Error('SuggestionBatchServiceD.updateBatchOutcome requires SuggestionBatch entity');
        }
        if (!suggestionId || !outcome) {
            throw new Error('SuggestionBatchServiceD.updateBatchOutcome requires suggestionId and outcome');
        }

        const validOutcomes = ['accepted', 'rejected', 'modified'];
        if (!validOutcomes.includes(outcome)) {
            throw new Error(`SuggestionBatchServiceD.updateBatchOutcome: invalid outcome '${outcome}'`);
        }

        batch.recordOutcome(suggestionId, outcome);
    }

    /**
     * Detect keep-all pattern
     * @param {SuggestionBatch} batch - Batch entity
     * @returns {boolean} True if keep-all pattern
     */
    detectKeepAllPattern(batch) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            return false;
        }

        return batch.isKeepAllPattern();
    }

    /**
     * Calculate batch acceptance rate
     * @param {SuggestionBatch} batch - Batch entity
     * @returns {number} Acceptance rate (0-1)
     */
    calculateBatchAcceptanceRate(batch) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            return 0;
        }

        return batch.getAcceptanceRate();
    }

    /**
     * Determine if batches should merge
     * @param {SuggestionBatch} batch1 - First batch
     * @param {SuggestionBatch} batch2 - Second batch
     * @param {number} timeWindow - Time window in milliseconds
     * @returns {boolean} True if should merge
     */
    shouldMergeBatches(batch1, batch2, timeWindow) {
        if (!batch1 || !batch2 || !(batch1 instanceof SuggestionBatch) || !(batch2 instanceof SuggestionBatch)) {
            return false;
        }

        // Check if same file
        const filePath1 = batch1.filePath instanceof Object ? batch1.filePath.toString() : String(batch1.filePath);
        const filePath2 = batch2.filePath instanceof Object ? batch2.filePath.toString() : String(batch2.filePath);
        
        if (filePath1 !== filePath2) {
            return false;
        }

        // Check if within time window
        const timeDiff = Math.abs(batch1.timestamp - batch2.timestamp);
        return timeDiff <= timeWindow;
    }

    /**
     * Get batch metrics
     * @param {SuggestionBatch} batch - Batch entity
     * @returns {Object} Batch metrics
     */
    getBatchMetrics(batch) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            return {
                totalSuggestions: 0,
                acceptedCount: 0,
                rejectedCount: 0,
                modifiedCount: 0,
                acceptanceRate: 0,
                totalSize: 0,
                age: 0,
                status: 'unknown'
            };
        }

        return {
            totalSuggestions: batch.suggestionIds.length,
            acceptedCount: batch.acceptedCount,
            rejectedCount: batch.rejectedCount,
            modifiedCount: batch.modifiedCount,
            acceptanceRate: batch.getAcceptanceRate(),
            totalSize: batch.totalSize,
            age: batch.getAge(),
            status: batch.status,
            isFullyResolved: batch.isFullyResolved(),
            isKeepAllPattern: batch.isKeepAllPattern()
        };
    }
}

// module.exports = SuggestionBatchServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/suggestionBatchServiceD.js


// ============================================================================
// FILE 29/50: domain/services/suggestionLifecycleServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/suggestionLifecycleServiceD.js
/**
 * SuggestionLifecycleServiceD - Domain service for suggestion lifecycle operations
 * 
 * Encapsulates business logic for determining suggestion status and tracking user interactions.
 * This is a domain service that uses VS Code port for document operations.
 */

class SuggestionLifecycleServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Determine suggestion status based on current state
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {string} currentText - Current text in document
     * @param {number} currentSize - Current size in characters
     * @returns {string} Status: 'accepted' | 'rejected' | 'adapted' | 'pending'
     */
    determineSuggestionStatus(vscodePort, suggestion, currentText, currentSize) {
        if (!suggestion) return 'pending';
        
        const MIN_SIZE_FOR_RATIO = 10;
        
        // Handle tiny suggestions
        if (!suggestion.size || suggestion.size < MIN_SIZE_FOR_RATIO) {
            if (currentSize === 0) {
                return 'rejected';
            }
            return 'pending';
        }

        const sizeRatio = this.calculateSizeRatio(suggestion.size, currentSize);

        // Check rejection first (most definitive)
        if (this.shouldMarkAsRejected(sizeRatio)) {
            return 'rejected';
        }

        // Check adaptation (user modified it)
        if (this.shouldMarkAsAdapted(suggestion, suggestion.userEdited)) {
            return 'adapted';
        }

        // Check acceptance (reviewed and unchanged)
        if (this.shouldMarkAsAccepted(suggestion, sizeRatio, suggestion.userEdited)) {
            return 'accepted';
        }

        // Still pending
        return 'pending';
    }

    /**
     * Detect if user edits overlap with suggestion
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {Array<Range>} userEditRanges - User edit ranges
     * @returns {boolean} True if overlaps
     */
    detectUserEditOverlap(vscodePort, suggestion, userEditRanges) {
        if (!suggestion || !userEditRanges || userEditRanges.length === 0) {
            return false;
        }

        // Use RangeOperationServiceD for overlap detection
        // For now, we'll use the vscodePort directly
        for (const editRange of userEditRanges) {
            if (suggestion.range && editRange) {
                const intersection = suggestion.range.intersection(editRange);
                if (intersection !== undefined) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Calculate size ratio for status determination
     * @param {number} originalSize - Original suggestion size
     * @param {number} currentSize - Current size
     * @returns {number} Size ratio (0-1+)
     */
    calculateSizeRatio(originalSize, currentSize) {
        if (!originalSize || originalSize === 0) return 1;
        return currentSize / originalSize;
    }

    /**
     * Determine if suggestion should be marked as rejected
     * @param {number} sizeRatio - Size ratio
     * @param {number} minRatio - Minimum ratio threshold (default: 0.4)
     * @returns {boolean} True if should reject
     */
    shouldMarkAsRejected(sizeRatio, minRatio = 0.4) {
        return sizeRatio < minRatio;
    }

    /**
     * Determine if suggestion should be marked as adapted
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {boolean} hasUserEdits - Whether user edits detected
     * @returns {boolean} True if should mark as adapted
     */
    shouldMarkAsAdapted(suggestion, hasUserEdits) {
        if (!suggestion) return false;
        return hasUserEdits && suggestion.reviewed;
    }

    /**
     * Determine if suggestion should be marked as accepted
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {number} sizeRatio - Size ratio
     * @param {boolean} hasUserEdits - Whether user edits detected
     * @returns {boolean} True if should mark as accepted
     */
    shouldMarkAsAccepted(suggestion, sizeRatio, hasUserEdits) {
        if (!suggestion) return false;
        
        // Must be reviewed and not edited by user
        if (!suggestion.reviewed || hasUserEdits) {
            return false;
        }

        // Size should be close to original (within reasonable range)
        // Accept if size ratio is between 0.8 and 1.2 (allows for minor formatting changes)
        return sizeRatio >= 0.8 && sizeRatio <= 1.2;
    }
}

// module.exports = SuggestionLifecycleServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/suggestionLifecycleServiceD.js


// ============================================================================
// FILE 30/50: domain/services/uriPathOperationServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/uriPathOperationServiceD.js
/**
 * UriPathOperationServiceD - Domain service for URI and path validation
 * 
 * Encapsulates core domain business rules for URI/path validation.
 * Technical utilities (normalization, extraction) are in app layer.
 */

// const path = require('path'); // Commented for consolidation

// Constants for file filtering (domain business rules)
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

class UriPathOperationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Check if document is a code document (domain business rule)
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {TextDocument} document - Document to check
     * @returns {boolean} True if code document
     */
    isCodeDocument(vscodePort, document) {
        if (!document) return false;
        
        const scheme = document.uri?.scheme || '';
        
        // Scheme blacklist (always skip these)
        if (NON_CODE_SCHEMES.includes(scheme)) {
            return false;
        }
        
        // Filter by file extension (only process code files)
        const p = (document.uri?.path || document.fileName || '');
        const clean = p.split('?')[0].split('#')[0]; // Strip query and fragment
        const ext = path.extname(clean).toLowerCase();
        
        // If we have an extension and it's not in the code extensions list, skip it
        if (ext && !CODE_EXTENSIONS.includes(ext)) {
            return false;
        }
        
        // Handle untitled documents (user-controlled)
        // untitled can be code, so we don't skip it by default if no extension
        
        return true;
    }

    /**
     * Check if URI should be skipped (domain business rule)
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Uri|string} uri - URI to check
     * @returns {boolean} True if should skip
     */
    isSkippableUri(vscodePort, uri) {
        if (!uri) return true;
        
        let scheme;
        if (typeof uri === 'string') {
            // Extract scheme from URI string
            const match = uri.match(/^([^:]+):/);
            scheme = match ? match[1] : '';
        } else {
            scheme = uri.scheme || '';
        }
        
        return NON_CODE_SCHEMES.includes(scheme);
    }
}

// module.exports = UriPathOperationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/uriPathOperationServiceD.js


// ============================================================================
// FILE 31/50: domain/utils/changeAggregator.js
// ============================================================================

(function() { // IIFE scope for domain/utils/changeAggregator.js
/**
 * Change Aggregator
 * Manages pending changes aggregation: tracking, capping, and event metadata
 */

function createPendingEntry() {
    return {
        changes: [],
        eventTimestamps: [], // Track one timestamp per event (for rapid change detection)
        eventRangeSets: [], // Track range set per event (for scattered pattern detection)
        eventChangeCounts: [], // Track number of changes per event (for cleanup)
        timer: null,
        lastChangeTime: 0,
        firstChangeTime: 0, // Track first change time for temporal analysis
        documentVersion: null, // Track document version to detect drift (last seen version)
        onClassified: null,
        document: null, // Store document reference for flush
        flushSource: null // Source of flush (for meta tracking)
    };
}

function calculateEventRangeSet(contentChanges) {
    const eventRangeSet = new Set();
    for (const change of contentChanges) {
        // Use line-based key to reduce noise from character-level variations
        const lineKey = `${change.range.start.line}-${change.range.end.line}`;
        eventRangeSet.add(lineKey);
    }
    return eventRangeSet;
}

function addChangesWithCapping(pending, contentChanges, maxChangesPerDocumentBatch, timestamp) {
    // Track first change time if this is the first batch
    if (pending.changes.length === 0) {
        pending.firstChangeTime = timestamp;
    }
    
    // Add all changes from event as one batch
    for (const change of contentChanges) {
        // Cap pending changes per document (safety)
        if (pending.changes.length >= maxChangesPerDocumentBatch) {
            // Drop oldest change
            pending.changes.shift();
            // Check if we've removed all changes from the first event
            if (pending.eventChangeCounts.length > 0) {
                pending.eventChangeCounts[0]--;
                if (pending.eventChangeCounts[0] <= 0) {
                    // Remove the first event's metadata
                    pending.eventChangeCounts.shift();
                    pending.eventTimestamps.shift();
                    pending.eventRangeSets.shift();
                    // Update first change time if we removed the first event
                    if (pending.eventTimestamps.length > 0) {
                        pending.firstChangeTime = pending.eventTimestamps[0];
                    }
                }
            }
        }
        pending.changes.push(change);
    }
}

function recordEventMetadata(pending, timestamp, eventRangeSet, changeCount) {
    // Track one timestamp per event (not per change)
    pending.eventTimestamps.push(timestamp);
    pending.eventRangeSets.push(eventRangeSet);
    pending.eventChangeCounts.push(changeCount);
    pending.lastChangeTime = timestamp;
}

// module.exports = { // Commented for consolidation
//     createPendingEntry, // Commented for consolidation
//     calculateEventRangeSet, // Commented for consolidation
//     addChangesWithCapping, // Commented for consolidation
//     recordEventMetadata // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/changeAggregator.js


// ============================================================================
// FILE 32/50: domain/utils/changeClassifier.js
// ============================================================================

(function() { // IIFE scope for domain/utils/changeClassifier.js
/**
 * Change Classifier
 * Debounced aggregation and AI/user classification for text changes
 * 
 * PRIMARY DETECTION: Behavioral inference via heuristics (edit patterns, batch characteristics, temporal patterns)
 * - Aggregates rapid changes within a time window
 * - Analyzes batch characteristics (total size, range count, distribution, scatteredness)
 * - Detects AI-like patterns: large multi-line insertions, pure insertions, scattered edits
 * - **Rapid scattered changes**: Measures many scattered edits within short time window (strong AI signal)
 *   - AI agents often make many scattered edits very quickly (within seconds)
 *   - Humans typically make more focused, sequential edits
 *   - This temporal pattern is a key behavioral differentiator
 * - Distinguishes formatters from AI edits (many scattered changes with deletes across wide span)
 * - This is the reliable method since markers cannot be guaranteed to survive edit pipeline
 * 
 * SECONDARY SIGNAL: @ai marker (strong signal when present)
 * - Checks for @ai marker in various comment formats (// @ai, # @ai, <!-- @ai -->, etc.)
 * - When marker is present, it's a definitive signal (100% accurate)
 * - When marker is absent, we cannot assume human origin - must use behavioral inference
 * 
 * Strategy: Behavioral heuristics are primary. Markers are helpful hints that strengthen
 * confidence when present, but absence of marker does NOT mean human origin.
 * 
 * DESIGN IMPROVEMENT: Composable detector pipeline
 * - Each detector returns {scoreDelta, reason, label}
 * - Final classification combines scores to determine label with confidence
 * - Returns {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
 * 
 * FIXED: Stores callback once per document to prevent double recording
 */


// Import detectors
// const { hasAIMarker } = require('./detectors/markerDetector'); // Commented for consolidation
// const { calculateMetrics } = require('./detectors/changeAnalyzer'); // Commented for consolidation
// const { detectFormatter } = require('./detectors/formatterDetector'); // Commented for consolidation
// const { detectRapidScattered } = require('./detectors/rapidScatteredDetector'); // Commented for consolidation
// const { detectMultiLineInsertion } = require('./detectors/multiLineDetector'); // Commented for consolidation
// const { detectPureInsertions } = require('./detectors/pureInsertionDetector'); // Commented for consolidation
// const { detectLargeInsertion } = require('./detectors/largeInsertionDetector'); // Commented for consolidation
// const { detectScatteredEdits } = require('./detectors/scatteredEditsDetector'); // Commented for consolidation
// const { detectSmallEdits } = require('./detectors/smallEditsDetector'); // Commented for consolidation

// Import extracted modules
// const { createConfig } = require('./configManager'); // Commented for consolidation
// const { createPendingEntry, calculateEventRangeSet, addChangesWithCapping, recordEventMetadata } = require('./changeAggregator'); // Commented for consolidation
// const { accumulateScores, determineLabel } = require('./classificationScorer'); // Commented for consolidation
// const { applyDriftCap } = require('./versionDriftHandler'); // Commented for consolidation
// const { filterReasons } = require('./reasonFilter'); // Commented for consolidation

class ChangeClassifier {
    /**
     * @param {number} debounceMs - Debounce window in milliseconds
     * @param {Object} config - Classification configuration (mode-specific thresholds)
     */
    constructor(debounceMs = 200, config = null) {
        this.debounceMs = debounceMs;
        this.pendingChanges = new Map(); // document URI -> { changes: [], timer: null, lastChangeTime: 0, documentVersion: null, onClassified: null }
        this.maxChangesPerDocumentBatch = 200; // Cap changes per document batch (safety)
        
        // Production: Metrics for observability
        this.metrics = {
            versionDriftCount: 0, // Track how often drift happens
            totalClassifications: 0
        };
        
        // Create and merge configuration
        this.config = createConfig(config);
        
        // Fix: Use strict boolean check (more explicit than || false)
        this.markerOnly = this.config.markerOnly === true;
    }
    

    /**
     * Add a batch of changes from a TextDocumentChangeEvent
     * FIXED: Accepts whole event, stores callback once per document
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     * @param {Function} onClassified - Callback with (document, classification, aggregatedChanges)
     *   - classification: {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
     */
    addEvent(event, onClassified) {
        if (!event || !event.contentChanges || event.contentChanges.length === 0) {
            return;
        }
        
        const uri = event.document.uri.toString();
        const now = Date.now();
        
        if (!this.pendingChanges.has(uri)) {
            this.pendingChanges.set(uri, createPendingEntry());
        }
        
        const pending = this.pendingChanges.get(uri);
        
        // Store callback once per document (prevents double recording)
        // Use latest callback if provided, otherwise keep existing
        if (onClassified) {
            pending.onClassified = onClassified;
        }
        pending.document = event.document; // Update document reference
        pending.documentVersion = event.document.version;
        
        // Calculate event range set for scatteredness detection
        const eventRangeSet = calculateEventRangeSet(event.contentChanges);
        
        // Add changes with capping
        addChangesWithCapping(pending, event.contentChanges, this.maxChangesPerDocumentBatch, now);
        
        // Record event metadata
        recordEventMetadata(pending, now, eventRangeSet, event.contentChanges.length);
        
        // Fix: Removed lastBatchFingerprint - fingerprint comparison was ineffective
        // (compared same array to itself). Using version drift alone is the actual signal.
        
        // Clear existing timer
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null; // Clear timer ref
        }
        
        // Set new timer
        pending.timer = setTimeout(() => {
            this._classifyAndEmit(uri);
        }, this.debounceMs);
    }

    _classifyAndEmit(uri) {
        const pending = this.pendingChanges.get(uri);
        if (!pending || pending.changes.length === 0) {
            if (pending && pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
            this.pendingChanges.delete(uri);
            return;
        }
        
        const changes = pending.changes;
        const eventTimestamps = pending.eventTimestamps || [];
        const eventRangeSets = pending.eventRangeSets || [];
        const document = pending.document;
        const onClassified = pending.onClassified;
        const documentVersion = pending.documentVersion;
        
        // Classify changes
        let classification = this._classify(changes, eventTimestamps, eventRangeSets, pending.firstChangeTime);
        
        // Fix: Ensure classification has meta object for source tracking
        if (!classification.meta) {
            classification.meta = {};
        }
        
        // Fix: Add source meta from flush context (if available)
        if (pending.flushSource) {
            classification.meta.source = pending.flushSource;
        }
        
        // Apply version drift cap if document changed externally
        const lastSeenVersion = documentVersion;
        const lastSeenTs = pending.lastChangeTime || pending.firstChangeTime;
        applyDriftCap(classification, document, lastSeenVersion, lastSeenTs, this.metrics);
        
        // Production: Track total classifications
        this.metrics.totalClassifications++;
        
        // Clear timer ref
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null;
        }
        
        // Clear pending
        this.pendingChanges.delete(uri);
        
        // Emit classification (single callback, prevents double recording)
        // ALWAYS use classification object format (single protocol)
        if (onClassified && document) {
            onClassified(document, classification, changes);
        }
    }

    _hasAIMarker(changes) {
        return hasAIMarker(changes);
    }

    _classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        if (changes.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: ['no changes'] };
        }
        
        // STRONG SIGNAL: Check for @ai marker (definitive when present)
        // Fix: Use only reasons array (single contract), no reason field
        if (this._hasAIMarker(changes)) {
            return {
                label: 'ai',
                confidence: 1.0,
                reasons: ['@ai marker found in changes']
            };
        }
        
        // If marker-only mode is enabled, skip heuristics entirely
        // Fix: Return unknown (not user) when no marker found - "no marker" ≠ "user"
        if (this.markerOnly) {
            return {
                label: 'unknown',
                confidence: 0.2,
                reasons: ['marker-only mode: no marker found']
            };
        }
        
        // PRIMARY DETECTION: Behavioral inference via heuristics
        // This is the reliable method since markers cannot be guaranteed
        // Aggregate metrics for all detectors
        const metrics = calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime, this.config);
        
        // Fix: Clean detector API - remove reasons parameter (detectors don't use it)
        // Run composable detectors in pipeline
        const detectors = [
            () => detectFormatter(metrics, this.config),
            () => detectRapidScattered(metrics, this.config),
            () => detectLargeInsertion(metrics, this.config),
            () => detectMultiLineInsertion(metrics, this.config),
            () => detectPureInsertions(metrics, this.config),
            () => detectScatteredEdits(metrics, this.config),
            () => detectSmallEdits(metrics)
        ];
        
        // Accumulate scores from detectors
        const { aiScore, formatterScore, userScore, reasonObjects } = accumulateScores(detectors);
        
        // Determine final label and confidence
        const { label, confidence } = determineLabel(aiScore, formatterScore, userScore);
        
        // Filter reasons by tag prefix
        const filteredReasons = filterReasons(reasonObjects, label);
        
        return { label, confidence, reasons: filteredReasons };
    }
    
    
    _classifyAsAI(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        const result = this._classify(changes, eventTimestamps, eventRangeSets, firstChangeTime);
        return result.label === 'ai';
    }
    
    /**
     * Public method for testing - classifies changes and returns rich result
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @param {Array<number>} eventTimestamps - Timestamps for each event (optional)
     * @param {Array<Set>} eventRangeSets - Range sets for each event (optional)
     * @param {number} firstChangeTime - Timestamp of first change (optional)
     * @returns {{label: 'ai'|'user'|'formatter'|'unknown', confidence: number, reasons: string[]}} Classification result
     */
    classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        return this._classify(changes, eventTimestamps, eventRangeSets, firstChangeTime);
    }

    /**
     * Force classification of pending changes for a document (for cleanup/flush)
     * Fix: Support silent mode to prevent emission during cleanup
     * @param {vscode.TextDocument} document - The document
     * @param {Function|Object} onClassifiedOrOptions - Optional callback or options {emit: boolean}
     *   - If Function: callback to use (uses stored if not provided)
     *   - If Object: {emit: false} for silent flush (cleanup without recording)
     */
    flush(document, onClassifiedOrOptions) {
        if (!document) return;
        
        const uri = document.uri.toString();
        const pending = this.pendingChanges.get(uri);
        if (pending) {
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
            
            // Fix: Support silent mode and source meta for cleanup without emission
            const options = typeof onClassifiedOrOptions === 'object' && onClassifiedOrOptions !== null ? onClassifiedOrOptions : null;
            const onClassified = typeof onClassifiedOrOptions === 'function' ? onClassifiedOrOptions : null;
            const shouldEmit = options ? (options.emit !== false) : true; // Default to true for backward compatibility
            
            // Fix: Store source meta if provided (for downstream filtering)
            if (options && options.source) {
                pending.flushSource = options.source;
            }
            
            if (onClassified) {
                pending.onClassified = onClassified;
            }
            
            pending.document = document; // Update document reference
            
            if (shouldEmit) {
                this._classifyAndEmit(uri);
            } else {
                // Silent flush: just clear without emitting
                this.pendingChanges.delete(uri);
            }
        }
    }

    /**
     * Flush all pending changes (for cleanup on extension stop)
     * FIXED: Actually calls callbacks before clearing
     * IMPORTANT: Callbacks should respect "formatter is neutral" rule - formatter classifications
     * should not trigger user edit recording or suggestion adaptation marking.
     * @param {Function} onClassified - Optional callback for all flushed documents
     *   - Callback signature: (document, classification, changes)
     *   - classification: {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
     *   - Callbacks should handle formatter classifications as neutral (do nothing)
     */
    flushAll(onClassified) {
        const uris = Array.from(this.pendingChanges.keys());
        for (const uri of uris) {
            const pending = this.pendingChanges.get(uri);
            if (pending) {
                if (pending.timer) {
                    clearTimeout(pending.timer);
                    pending.timer = null;
                }
                // Use provided callback or stored callback
                if (onClassified) {
                    pending.onClassified = onClassified;
                }
                // Emit if we have document and callback
                if (pending.document && pending.onClassified) {
                    // Fix: Set source for flushAll (dispose context) if not already set
                    // Then reuse _classifyAndEmit() for consistency (single code path for drift cap, meta.source, etc.)
                    if (!pending.flushSource) {
                        pending.flushSource = 'dispose';
                    }
                    
                    // Fix: Reuse _classifyAndEmit() instead of duplicating logic
                    // This ensures consistency: meta.source, drift cap, fingerprint check all use same code path
                    // Less divergence = fewer future regressions
                    this._classifyAndEmit(uri);
                }
            }
        }
        this.pendingChanges.clear();
    }

    /**
     * Clear all pending changes (for cleanup)
     */
    clear() {
        for (const pending of this.pendingChanges.values()) {
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
        }
        this.pendingChanges.clear();
    }

    /**
     * Calculate statistics about pending changes
     * @returns {Object} Statistics object with counts and metrics
     */
    getStatistics() {
        const stats = {
            totalDocuments: this.pendingChanges.size,
            totalPendingChanges: 0,
            documentsWithTimers: 0,
            averageChangesPerDocument: 0
        };

        for (const pending of this.pendingChanges.values()) {
            stats.totalPendingChanges += pending.changes.length;
            if (pending.timer) {
                stats.documentsWithTimers++;
            }
        }

        if (stats.totalDocuments > 0) {
            stats.averageChangesPerDocument = Math.round(
                stats.totalPendingChanges / stats.totalDocuments
            );
        }

        return stats;
    }

}

// module.exports = ChangeClassifier; // Commented for consolidation

})(); // End IIFE for domain/utils/changeClassifier.js

