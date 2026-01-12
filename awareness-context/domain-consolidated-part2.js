/**
 * DOMAIN LAYER - CONSOLIDATED (PART 2/4)
 * 
 * This file contains part 2 of 4 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 12/54
 * Generated: 2026-01-12T18:19:21.013Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 21/54: domain/ports/ILoggerPort.js
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
// FILE 22/54: domain/services/changeClassificationServiceD.js
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
// FILE 23/54: domain/services/debtCalculationServiceD.js
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
     * Calculate debt score (0-30)
     * @param {Map<string, Debt>} debts - Map of debt entities
     * @param {Array<Suggestion>} pendingSuggestions - Pending suggestions
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(debts, pendingSuggestions) {
        if (!debts) debts = new Map();
        if (!pendingSuggestions) pendingSuggestions = [];

        const unreviewedFiles = Array.from(debts.values())
            .filter(d => d && !d.isReviewed());

        // Pending suggestions are also debt - they represent unreviewed AI-generated code
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

        // 3. Age of oldest unreviewed file or pending suggestion (0-10 points)
        const allDebtTimestamps = [
            ...unreviewedFiles.map(d => d.modifiedAt || now),
            ...pending.map(s => s.timestamp || now)
        ];

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
     * Aggregate debt metrics
     * @param {Map<string, Debt>} debts - Map of debt entities
     * @returns {Object} Aggregated metrics
     */
    aggregateDebtMetrics(debts) {
        if (!debts) debts = new Map();

        const debtArray = Array.from(debts.values()).filter(d => d);
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
     * Determine if debt should be evicted
     * @param {Debt} debt - Debt entity
     * @param {number} evictionThreshold - Eviction threshold in milliseconds
     * @returns {boolean} True if should evict
     */
    shouldEvictDebt(debt, evictionThreshold) {
        if (!debt || !evictionThreshold) return false;

        const age = Date.now() - (debt.modifiedAt || 0);
        return age > evictionThreshold;
    }
}

// module.exports = DebtCalculationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/debtCalculationServiceD.js


// ============================================================================
// FILE 24/54: domain/services/eventSubscriptionServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/eventSubscriptionServiceD.js
/**
 * EventSubscriptionServiceD - Domain service for VS Code event subscription
 * 
 * Encapsulates event subscription logic using VS Code port.
 * Service creates instances and passes adapters as ports to methods (following auth module pattern).
 */

class EventSubscriptionServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Subscribe to text document change events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToTextDocumentChanges(handler, vscodePort) {
        return vscodePort.onDidChangeTextDocument(handler);
    }

    /**
     * Subscribe to file creation events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileCreation(handler, vscodePort) {
        return vscodePort.onDidCreateFiles(handler);
    }

    /**
     * Subscribe to file save events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileSave(handler, vscodePort) {
        return vscodePort.onDidSaveTextDocument(handler);
    }

    /**
     * Subscribe to file open events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileOpen(handler, vscodePort) {
        return vscodePort.onDidOpenTextDocument(handler);
    }

    /**
     * Subscribe to file close events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileClose(handler, vscodePort) {
        return vscodePort.onDidCloseTextDocument(handler);
    }

    /**
     * Subscribe to cursor move events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToCursorMove(handler, vscodePort) {
        return vscodePort.onDidChangeTextEditorSelection(handler);
    }

    /**
     * Subscribe to scroll events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToScroll(handler, vscodePort) {
        return vscodePort.onDidChangeTextEditorVisibleRanges(handler);
    }

    /**
     * Subscribe to editor change events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToEditorChange(handler, vscodePort) {
        return vscodePort.onDidChangeActiveTextEditor(handler);
    }
}

// module.exports = EventSubscriptionServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/eventSubscriptionServiceD.js


// ============================================================================
// FILE 25/54: domain/services/keepAllDetector.js
// ============================================================================

(function() { // IIFE scope for domain/services/keepAllDetector.js
/**
 * KeepAllDetector - Domain service for detecting "Keep All" patterns
 * 
 * Encapsulates business logic for detecting when users rapidly accept
 * multiple AI suggestions. This is a domain service.
 */

class KeepAllDetector {
    /**
     * @param {Function} onKeepAll - Callback when "keep all" pattern detected
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onKeepAll, loggerPort = null) {
        this.onKeepAll = onKeepAll;
        this.loggerPort = loggerPort;
        
        // "Keep All" detection - track rapid acceptances
        this.recentAcceptances = [];
        this.keepAllDetectionWindow = 2000; // 2 seconds
        this.keepAllThreshold = 3; // Minimum acceptances to trigger
    }

    /**
     * Track suggestion acceptance and detect "Keep All" pattern
     * 
     * "Keep All" is detected when multiple suggestions are accepted rapidly
     * (typically 3+ acceptances within 2 seconds)
     * 
     * @param {Object} suggestion - The accepted suggestion object
     */
    trackAcceptance(suggestion) {
        const now = Date.now();
        
        // Add this acceptance to the tracking array
        this.recentAcceptances.push({
            timestamp: now,
            suggestionId: suggestion.id,
            document: suggestion.document,
            size: suggestion.size
        });
        
        // Clean old entries (outside detection window)
        this.recentAcceptances = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        // Check for "Keep All" pattern
        if (this.recentAcceptances.length >= this.keepAllThreshold) {
            this.detectKeepAll();
        }
    }

    /**
     * Detect "Keep All" pattern and emit to usage statistics
     * 
     * Called when threshold is reached (multiple rapid acceptances)
     */
    detectKeepAll() {
        const now = Date.now();
        const recent = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        if (recent.length >= this.keepAllThreshold) {
            // Get unique files affected
            const uniqueFiles = new Set(recent.map(e => e.document));
            const totalSize = recent.reduce((sum, e) => sum + e.size, 0);
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: "Keep All" detected - ${recent.length} suggestions accepted across ${uniqueFiles.size} files`);
            }
            
            // Call optional callback (e.g., for UsageStats)
            if (this.onKeepAll) {
                this.onKeepAll({
                    count: recent.length,
                    fileCount: uniqueFiles.size,
                    totalSize: totalSize,
                    timestamp: now,
                    window: this.keepAllDetectionWindow
                });
            }
            
            // Clear the tracking array to avoid duplicate detections
            // (but keep the most recent one to allow for overlapping detections)
            this.recentAcceptances = recent.slice(-1);
        }
    }

    /**
     * Get number of recent acceptances
     * @returns {number} Number of recent acceptances
     */
    getRecentAcceptanceCount() {
        return this.recentAcceptances.length;
    }

    /**
     * Clear all tracked acceptances
     */
    clear() {
        this.recentAcceptances = [];
    }
}

// module.exports = KeepAllDetector; // Commented for consolidation


})(); // End IIFE for domain/services/keepAllDetector.js


// ============================================================================
// FILE 26/54: domain/services/keepAllDetectorD.js
// ============================================================================

(function() { // IIFE scope for domain/services/keepAllDetectorD.js
/**
 * KeepAllDetectorD - Domain service for detecting "Keep All" patterns
 * 
 * Encapsulates business logic for detecting when users rapidly accept
 * multiple AI suggestions. This is a domain service.
 */

class KeepAllDetectorD {
    /**
     * @param {Function} onKeepAll - Callback when "keep all" pattern detected
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onKeepAll, loggerPort = null) {
        this.onKeepAll = onKeepAll;
        this.loggerPort = loggerPort;
        
        // "Keep All" detection - track rapid acceptances
        this.recentAcceptances = [];
        this.keepAllDetectionWindow = 2000; // 2 seconds
        this.keepAllThreshold = 3; // Minimum acceptances to trigger
    }

    /**
     * Track suggestion acceptance and detect "Keep All" pattern
     * 
     * "Keep All" is detected when multiple suggestions are accepted rapidly
     * (typically 3+ acceptances within 2 seconds)
     * 
     * @param {Object} suggestion - The accepted suggestion object
     */
    trackAcceptance(suggestion) {
        const now = Date.now();
        
        // Add this acceptance to the tracking array
        this.recentAcceptances.push({
            timestamp: now,
            suggestionId: suggestion.id,
            document: suggestion.document,
            size: suggestion.size
        });
        
        // Clean old entries (outside detection window)
        this.recentAcceptances = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        // Check for "Keep All" pattern
        if (this.recentAcceptances.length >= this.keepAllThreshold) {
            this.detectKeepAll();
        }
    }

    /**
     * Detect "Keep All" pattern and emit to usage statistics
     * 
     * Called when threshold is reached (multiple rapid acceptances)
     */
    detectKeepAll() {
        const now = Date.now();
        const recent = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        if (recent.length >= this.keepAllThreshold) {
            // Get unique files affected
            const uniqueFiles = new Set(recent.map(e => e.document));
            const totalSize = recent.reduce((sum, e) => sum + e.size, 0);
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: "Keep All" detected - ${recent.length} suggestions accepted across ${uniqueFiles.size} files`);
            }
            
            // Call optional callback (e.g., for UsageStats)
            if (this.onKeepAll) {
                this.onKeepAll({
                    count: recent.length,
                    fileCount: uniqueFiles.size,
                    totalSize: totalSize,
                    timestamp: now,
                    window: this.keepAllDetectionWindow
                });
            }
            
            // Clear the tracking array to avoid duplicate detections
            // (but keep the most recent one to allow for overlapping detections)
            this.recentAcceptances = recent.slice(-1);
        }
    }

    /**
     * Get number of recent acceptances
     * @returns {number} Number of recent acceptances
     */
    getRecentAcceptanceCount() {
        return this.recentAcceptances.length;
    }

    /**
     * Clear all tracked acceptances
     */
    clear() {
        this.recentAcceptances = [];
    }
}

// module.exports = KeepAllDetectorD; // Commented for consolidation


})(); // End IIFE for domain/services/keepAllDetectorD.js


// ============================================================================
// FILE 27/54: domain/services/rangeOperationServiceD.js
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
// FILE 28/54: domain/services/reviewSessionServiceD.js
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
// FILE 29/54: domain/services/scoreCalculator.js
// ============================================================================

(function() { // IIFE scope for domain/services/scoreCalculator.js
/**
 * ScoreCalculator - Domain service for calculating awareness scores
 * 
 * Encapsulates business logic for calculating awareness scores based on
 * user review behavior and AI suggestions. This is a domain service.
 */

// const { getRelativePath } = require('../utils/utils'); // Commented for consolidation

class ScoreCalculator {
    /**
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface, optional)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(vscodePort = null, loggerPort = null) {
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        this.currentScore = 0;
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points
        };
    }

    /**
     * Calculate awareness score based on suggestions and review debt
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getDebtScore - Function to get debt score
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @param {Function} onScoreUpdate - Callback when score updates
     * @returns {Object} Score object with total and components
     */
    updateScore(aiSuggestions, getDebtScore, getReviewDebtSummary, onScoreUpdate) {
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for "recent activity" calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // BUT: If we have older suggestions but no recent ones, and we have review debt,
        // preserve the score based on debt rather than resetting to zero
        const hasOlderSuggestions = aiSuggestions.length > 0 && recentSuggestions.length === 0;
        const debtScore = getDebtScore();
        const hasDebt = debtScore > 0;
        
        // Rate-limited debug logging via logger port
        if (this.loggerPort) {
            this.loggerPort.debug(`Updating score: ${recentSuggestions.length} recent, ${aiSuggestions.length} total, debt: ${debtScore}`, 'scoreCalculator:updateScore');
        }
        
        // Only calculate if we have suggestions in the last 10 seconds
        if (recentSuggestions.length === 0) {
            // Even with no recent suggestions, calculate debt score if there's review debt
            if (debtScore > 0) {
                // If there's review debt but no pending, show debt score
                this.currentScore = Math.min(debtScore, 100); // Cap at 100
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else if (hasOlderSuggestions && hasDebt) {
                // We have older suggestions and debt - preserve a minimum score based on debt
                // This prevents the meter from dropping to zero when monitor restarts
                this.currentScore = Math.max(debtScore, 20); // Minimum 20 to show activity
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else {
                // No recent activity and no debt
                this.currentScore = -1; // Special value: no data yet
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            }
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // Include pending suggestions in score calculation (they count as activity)
        // This ensures meter shows activity even when suggestions are still pending
        const allRecent = recentSuggestions;
        
        // Filter to completed suggestions only for detailed scoring
        const completed = recentSuggestions.filter(s => s.status !== 'pending');
        const pending = recentSuggestions.filter(s => s.status === 'pending');
        
        if (completed.length === 0 && allRecent.length > 0) {
            // Still pending, but we have activity - show partial score based on pending count
            // This ensures meter shows activity instead of "No Activity"
            this.currentScore = 50; // Neutral - pending activity detected
            this.scores = { 
                review: 0, 
                critical: 0, 
                adaptation: 0, 
                debt: debtScore // Still calculate debt
            };
            
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            this.currentScore = -1;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // 1. Code Review Rate (40 points)
        this.scores.review = this.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.calculateAdaptationScore(completed);
        
        // 4. Review Debt (30 points)
        this.scores.debt = debtScore;
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        // Trigger callback for immediate meter update
        if (onScoreUpdate) {
            onScoreUpdate();
        }
    }

    /**
     * Calculate review score (0-40)
     * High score = user carefully reviewed code
     */
    calculateReviewScore(suggestions) {
        const reviewedCount = suggestions.filter(s => s.reviewed).length;
        const totalReviewTime = suggestions.reduce((sum, s) => sum + s.reviewTime, 0);
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
     */
    calculateCriticalScore(suggestions) {
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
     */
    calculateAdaptationScore(suggestions) {
        const adapted = suggestions.filter(s => s.status === 'adapted').length;
        const adaptRate = adapted / suggestions.length;
        
        // Average edits per suggestion
        const totalEdits = suggestions.reduce((sum, s) => sum + s.editCount, 0);
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

    /**
     * Get current awareness score and breakdown
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     */
    getScore(aiSuggestions, getReviewDebtSummary) {
        const debtSummary = getReviewDebtSummary();
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for score calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // For display: show ALL suggestions (not just last 10 seconds) so meter shows activity
        // But use recentSuggestions for actual score calculation
        const allSuggestions = aiSuggestions;
        
        // Get pending suggestions with file paths
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                // Extract file path from document URI
                let filePath = null;
                if (s.document) {
                    try {
                        // Use VS Code port for URI creation
                        const Uri = this.vscodePort ? this.vscodePort.Uri : null;
                        if (!Uri) {
                            return null; // Skip if no port available
                        }
                        const uri = Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        if (this.loggerPort) {
                            this.loggerPort.error('AwarenessMonitor: Error parsing document URI', err);
                        }
                    }
                }
                return {
                    path: filePath ? getRelativePath(filePath) : 'Unknown',
                    fullPath: filePath || '',
                    ageMinutes: Math.round((now - s.timestamp) / (1000 * 60)),
                    type: s.isFileCreation ? 'file creation' : 
                          s.isExternalCreation ? 'external file' :
                          s.isFileWrite ? 'file write' : 'text change'
                };
            })
            .filter(Boolean); // Remove null entries
        
        return {
            total: this.currentScore,
            components: { ...this.scores },
            suggestions: {
                // Show all suggestions for meter display (so it doesn't disappear after 10s)
                total: allSuggestions.length,
                pending: allSuggestions.filter(s => s.status === 'pending').length,
                accepted: allSuggestions.filter(s => s.status === 'accepted').length,
                rejected: allSuggestions.filter(s => s.status === 'rejected').length,
                adapted: allSuggestions.filter(s => s.status === 'adapted').length,
                // Also include recent count for debugging
                recentTotal: recentSuggestions.length,
                // Include pending suggestions with file info
                pendingFiles: pendingSuggestions
            },
            // Review debt information
            debt: {
                unreviewedFiles: debtSummary.total,
                files: debtSummary.files.map(f => ({
                    path: getRelativePath(f.path), // Relative path instead of just filename
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                }))
            },
            // Add debug info for troubleshooting
            debug: {
                lastActivity: recentSuggestions.length > 0 ? 
                    new Date(recentSuggestions[recentSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    (aiSuggestions.length > 0 ? 
                    new Date(aiSuggestions[aiSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: true, // Will be set by main class
                totalDebtEntries: debtSummary.total,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: aiSuggestions.length
            }
        };
    }

    /**
     * Get current score value
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Get score components
     */
    getScoreComponents() {
        return { ...this.scores };
    }
}

// module.exports = ScoreCalculator; // Commented for consolidation


})(); // End IIFE for domain/services/scoreCalculator.js


// ============================================================================
// FILE 30/54: domain/services/scoreCalculatorD.js
// ============================================================================

(function() { // IIFE scope for domain/services/scoreCalculatorD.js
/**
 * ScoreCalculatorD - Domain service for calculating awareness scores
 * 
 * Encapsulates business logic for calculating awareness scores based on
 * user review behavior and AI suggestions. This is a domain service.
 */

// const { getRelativePath } = require('../utils/utils'); // Commented for consolidation

class ScoreCalculatorD {
    /**
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface, optional)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(vscodePort = null, loggerPort = null) {
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        this.currentScore = 0;
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points
        };
    }

    /**
     * Calculate awareness score based on suggestions and review debt
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getDebtScore - Function to get debt score
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @param {Function} onScoreUpdate - Callback when score updates
     * @returns {Object} Score object with total and components
     */
    updateScore(aiSuggestions, getDebtScore, getReviewDebtSummary, onScoreUpdate) {
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for "recent activity" calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // BUT: If we have older suggestions but no recent ones, and we have review debt,
        // preserve the score based on debt rather than resetting to zero
        const hasOlderSuggestions = aiSuggestions.length > 0 && recentSuggestions.length === 0;
        const debtScore = getDebtScore();
        const hasDebt = debtScore > 0;
        
        // Rate-limited debug logging via logger port
        if (this.loggerPort) {
            this.loggerPort.debug(`Updating score: ${recentSuggestions.length} recent, ${aiSuggestions.length} total, debt: ${debtScore}`, 'scoreCalculator:updateScore');
        }
        
        // Only calculate if we have suggestions in the last 10 seconds
        if (recentSuggestions.length === 0) {
            // Even with no recent suggestions, calculate debt score if there's review debt
            if (debtScore > 0) {
                // If there's review debt but no pending, show debt score
                this.currentScore = Math.min(debtScore, 100); // Cap at 100
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else if (hasOlderSuggestions && hasDebt) {
                // We have older suggestions and debt - preserve a minimum score based on debt
                // This prevents the meter from dropping to zero when monitor restarts
                this.currentScore = Math.max(debtScore, 20); // Minimum 20 to show activity
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else {
                // No recent activity and no debt
                this.currentScore = -1; // Special value: no data yet
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            }
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // Include pending suggestions in score calculation (they count as activity)
        // This ensures meter shows activity even when suggestions are still pending
        const allRecent = recentSuggestions;
        
        // Filter to completed suggestions only for detailed scoring
        const completed = recentSuggestions.filter(s => s.status !== 'pending');
        const pending = recentSuggestions.filter(s => s.status === 'pending');
        
        if (completed.length === 0 && allRecent.length > 0) {
            // Still pending, but we have activity - show partial score based on pending count
            // This ensures meter shows activity instead of "No Activity"
            this.currentScore = 50; // Neutral - pending activity detected
            this.scores = { 
                review: 0, 
                critical: 0, 
                adaptation: 0, 
                debt: debtScore // Still calculate debt
            };
            
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            this.currentScore = -1;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // 1. Code Review Rate (40 points)
        this.scores.review = this.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.calculateAdaptationScore(completed);
        
        // 4. Review Debt (30 points)
        this.scores.debt = debtScore;
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        // Trigger callback for immediate meter update
        if (onScoreUpdate) {
            onScoreUpdate();
        }
    }

    /**
     * Calculate review score (0-40)
     * High score = user carefully reviewed code
     */
    calculateReviewScore(suggestions) {
        const reviewedCount = suggestions.filter(s => s.reviewed).length;
        const totalReviewTime = suggestions.reduce((sum, s) => sum + s.reviewTime, 0);
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
     */
    calculateCriticalScore(suggestions) {
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
     */
    calculateAdaptationScore(suggestions) {
        const adapted = suggestions.filter(s => s.status === 'adapted').length;
        const adaptRate = adapted / suggestions.length;
        
        // Average edits per suggestion
        const totalEdits = suggestions.reduce((sum, s) => sum + s.editCount, 0);
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

    /**
     * Get current awareness score and breakdown
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     */
    getScore(aiSuggestions, getReviewDebtSummary) {
        const debtSummary = getReviewDebtSummary();
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for score calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // For display: show ALL suggestions (not just last 10 seconds) so meter shows activity
        // But use recentSuggestions for actual score calculation
        const allSuggestions = aiSuggestions;
        
        // Get pending suggestions with file paths
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                // Extract file path from document URI
                let filePath = null;
                if (s.document) {
                    try {
                        // Use VS Code port for URI creation
                        const Uri = this.vscodePort ? this.vscodePort.Uri : null;
                        if (!Uri) {
                            return null; // Skip if no port available
                        }
                        const uri = Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        if (this.loggerPort) {
                            this.loggerPort.error('AwarenessMonitor: Error parsing document URI', err);
                        }
                    }
                }
                return {
                    path: filePath ? getRelativePath(filePath) : 'Unknown',
                    fullPath: filePath || '',
                    ageMinutes: Math.round((now - s.timestamp) / (1000 * 60)),
                    type: s.isFileCreation ? 'file creation' : 
                          s.isExternalCreation ? 'external file' :
                          s.isFileWrite ? 'file write' : 'text change'
                };
            })
            .filter(Boolean); // Remove null entries
        
        return {
            total: this.currentScore,
            components: { ...this.scores },
            suggestions: {
                // Show all suggestions for meter display (so it doesn't disappear after 10s)
                total: allSuggestions.length,
                pending: allSuggestions.filter(s => s.status === 'pending').length,
                accepted: allSuggestions.filter(s => s.status === 'accepted').length,
                rejected: allSuggestions.filter(s => s.status === 'rejected').length,
                adapted: allSuggestions.filter(s => s.status === 'adapted').length,
                // Also include recent count for debugging
                recentTotal: recentSuggestions.length,
                // Include pending suggestions with file info
                pendingFiles: pendingSuggestions
            },
            // Review debt information
            debt: {
                unreviewedFiles: debtSummary.total,
                files: debtSummary.files.map(f => ({
                    path: getRelativePath(f.path), // Relative path instead of just filename
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                }))
            },
            // Add debug info for troubleshooting
            debug: {
                lastActivity: recentSuggestions.length > 0 ? 
                    new Date(recentSuggestions[recentSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    (aiSuggestions.length > 0 ? 
                    new Date(aiSuggestions[aiSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: true, // Will be set by main class
                totalDebtEntries: debtSummary.total,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: aiSuggestions.length
            }
        };
    }

    /**
     * Get current score value
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Get score components
     */
    getScoreComponents() {
        return { ...this.scores };
    }
}

// module.exports = ScoreCalculatorD; // Commented for consolidation


})(); // End IIFE for domain/services/scoreCalculatorD.js


// ============================================================================
// FILE 31/54: domain/services/suggestionBatchServiceD.js
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
// FILE 32/54: domain/services/suggestionLifecycleServiceD.js
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

