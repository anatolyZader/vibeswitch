/**
 * DOMAIN LAYER - CONSOLIDATED (PART 2/3)
 * 
 * This file contains part 2 of 3 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 20/43
 * Generated: 2026-01-14T18:13:49.746Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 18/43: domain/ports/IAwarenessVSCodePort.js
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
// FILE 19/43: domain/ports/IFileSystemPort.js
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
// FILE 20/43: domain/ports/IHashGeneratorPort.js
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
// FILE 21/43: domain/ports/IIdGeneratorPort.js
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
// FILE 22/43: domain/ports/ILoggerPort.js
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
// FILE 23/43: domain/services/changeClassificationServiceD.js
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
// FILE 24/43: domain/services/rangeOperationServiceD.js
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
// FILE 25/43: domain/services/uriPathOperationServiceD.js
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
// FILE 26/43: domain/utils/changeAggregator.js
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
// FILE 27/43: domain/utils/changeClassifier.js
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
     * @param {ILoggerPort} loggerPort - Logger port (optional, for config validation warnings)
     */
    constructor(debounceMs = 200, config = null, loggerPort = null) {
        this.debounceMs = debounceMs;
        this.pendingChanges = new Map(); // document URI -> { changes: [], timer: null, lastChangeTime: 0, documentVersion: null, onClassified: null }
        this.maxChangesPerDocumentBatch = 200; // Cap changes per document batch (safety)
        
        // Production: Metrics for observability
        this.metrics = {
            versionDriftCount: 0, // Track how often drift happens
            totalClassifications: 0
        };
        
        // Create and merge configuration (pass logger for validation warnings)
        this.config = createConfig(config, loggerPort);
        
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


// ============================================================================
// FILE 28/43: domain/utils/classificationScorer.js
// ============================================================================

(function() { // IIFE scope for domain/utils/classificationScorer.js
/**
 * Classification Scorer
 * Accumulates detector scores and determines final classification label and confidence
 */

function accumulateScores(detectors) {
    // Fix: Use probabilistic OR instead of additive scoring
    // Formula: combined = 1 - Π(1 - score_i) per label
    // This prevents score inflation from multiple weak signals
    // and is easier to calibrate than additive with capping
    
    const aiScores = [];
    const formatterScores = [];
    const userScores = [];
    
    // Fix: Store reasons as paired objects to prevent misalignment
    // Some detectors may return reason without reasonTag (e.g., marker detection)
    const reasonObjects = [];
    
    for (const detector of detectors) {
        const result = detector();
        if (!result) continue;
        
        if (result.label === 'formatter') {
            formatterScores.push(result.score);
        } else if (result.label === 'ai') {
            aiScores.push(result.score);
        } else if (result.label === 'user') {
            userScores.push(result.score);
        }
        
        if (result.reason) {
            reasonObjects.push({ tag: result.reasonTag || null, text: result.reason });
        }
    }
    
    // Probabilistic OR: 1 - Π(1 - score_i)
    // If no scores, product is 1, so result is 0 (correct)
    const aiScore = aiScores.length > 0
        ? 1 - aiScores.reduce((product, score) => product * (1 - score), 1)
        : 0;
    
    const formatterScore = formatterScores.length > 0
        ? 1 - formatterScores.reduce((product, score) => product * (1 - score), 1)
        : 0;
    
    const userScore = userScores.length > 0
        ? 1 - userScores.reduce((product, score) => product * (1 - score), 1)
        : 0;
    
    return { aiScore, formatterScore, userScore, reasonObjects };
}

function determineLabel(aiScore, formatterScore, userScore) {
    let label = 'unknown';
    let confidence = 0;
    
    if (formatterScore > aiScore && formatterScore > userScore && formatterScore > 0.5) {
        label = 'formatter';
        confidence = Math.min(formatterScore, 1.0);
    } else if (aiScore > userScore && aiScore > 0.3) {
        label = 'ai';
        confidence = Math.min(aiScore, 1.0);
    } else if (userScore > 0) {
        // Fix: Only label 'user' when we have positive user evidence
        label = 'user';
        confidence = Math.max(0.3, Math.min(userScore, 1.0));
    } else {
        // Fix: If all scores are 0, return 'unknown' (not 'user')
        // This matches the documented behavior where 'unknown' exists
        label = 'unknown';
        confidence = 0.2;
    }
    
    return { label, confidence };
}

// module.exports = { // Commented for consolidation
//     accumulateScores, // Commented for consolidation
//     determineLabel // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/classificationScorer.js


// ============================================================================
// FILE 29/43: domain/utils/configManager.js
// ============================================================================

(function() { // IIFE scope for domain/utils/configManager.js
/**
 * Config Manager
 * Manages classifier configuration: defaults, validation, and merging
 * 
 * Domain layer - no logging dependencies. Validation results are returned
 * for application layer to handle logging.
 */

/**
 * Get default classifier configuration
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    return {
        // VIBE: more permissive (lower thresholds)
        // DEV: more conservative (higher thresholds)
        multiLineThreshold: 50,
        pureInsertionCount: 3,
        pureInsertionSize: 20,
        largeInsertionThreshold: 100,
        scatteredRangeCount: 5,
        scatteredChangeCount: 5,
        scatteredSizeThreshold: 200,
        formatterRangeCount: 8,
        formatterLineSpan: 50,
        aiLineSpan: 30,
        aiMultiLineSize: 50,
        // Rapid scattered changes: AI agents often make many scattered edits quickly
        rapidScatteredTimeWindow: 1000, // Time window in ms for rapid changes (1 second)
        rapidScatteredEventCount: 8, // Minimum number of events in time window (renamed from ChangeCount for clarity)
        rapidScatteredRangeCount: 6, // Minimum distinct line ranges for scattered pattern
        rapidScatteredMinSize: 50, // Minimum total size to avoid false positives on tiny edits
        rapidBurstChangeCount: 10, // Minimum number of changes for rapid burst branch (separate from event count)
        // Marker-only mode: if true, only use @ai marker, ignore heuristics
        // If false, use behavioral heuristics as primary with markers as strong signal when present
        markerOnly: false  // Default: use behavioral inference (heuristics) as primary method
    };
}

/**
 * Validate and sanitize classifier configuration to prevent silent misclassification
 * Fix: Sanitizes user config BEFORE merge to ensure defaults always win
 * @param {Object} config - User configuration to validate (will be mutated)
 * @param {Object} defaultConfig - Default configuration (for reference)
 * @returns {{errors: string[], sanitized: string[]}} Validation result
 */
function validateConfig(config, defaultConfig = {}) {
    const errors = [];
    const sanitized = [];
    
    // Thresholds must be positive numbers
    const thresholdKeys = [
        'multiLineThreshold', 'pureInsertionCount', 'pureInsertionSize',
        'largeInsertionThreshold', 'scatteredRangeCount', 'scatteredChangeCount',
        'scatteredSizeThreshold', 'formatterRangeCount', 'formatterLineSpan',
        'aiLineSpan', 'aiMultiLineSize', 'rapidScatteredTimeWindow',
        'rapidScatteredEventCount', 'rapidScatteredRangeCount', 'rapidScatteredMinSize',
        'rapidBurstChangeCount'
    ];
    
    // Fix: Sanitize invalid values (delete them so defaults win) instead of just warning
    for (const key of thresholdKeys) {
        if (config[key] !== undefined && (typeof config[key] !== 'number' || config[key] < 0)) {
            errors.push(`${key} must be a non-negative number, got: ${config[key]}`);
            delete config[key]; // Remove invalid value so default wins
            sanitized.push(key);
        }
    }
    
    // Boolean flags
    if (config.markerOnly !== undefined && typeof config.markerOnly !== 'boolean') {
        errors.push(`markerOnly must be a boolean, got: ${config.markerOnly}`);
        delete config.markerOnly; // Remove invalid value so default wins
        sanitized.push('markerOnly');
    }
    
    // Fix: Domain layer doesn't log - return validation result for app layer to handle
    // Invalid values have been deleted, so defaults will be used via merge
    return { errors, sanitized };
}

/**
 * Create and merge classifier configuration
 * @param {Object|null} userConfig - User-provided configuration (optional)
 * @param {ILoggerPort} loggerPort - Logger port (optional, for validation warnings)
 * @returns {Object} Final frozen configuration object
 */
function createConfig(userConfig = null, loggerPort = null) {
    const defaultConfig = getDefaultConfig();
    
    // Fix: Sanitize user config BEFORE merging to ensure defaults always win
    // This prevents invalid values from overwriting defaults, then being deleted, leaving undefined
    const sanitizedUserConfig = userConfig ? { ...userConfig } : {};
    const validationResult = validateConfig(sanitizedUserConfig, defaultConfig);
    
    // Log validation warnings at application layer (if logger provided)
    if (validationResult.errors.length > 0 && loggerPort) {
        loggerPort.log(`[ChangeClassifier] Invalid config sanitized: ${validationResult.sanitized.join(', ')}. ${validationResult.errors.length} invalid value(s) removed, defaults applied.`, true);
    }
    
    // Merge sanitized user config with defaults (defaults win for any missing/invalid keys)
    const config = { ...defaultConfig, ...sanitizedUserConfig };
    
    // Freeze config to prevent accidental mutation
    Object.freeze(config);
    
    return config;
}

// module.exports = { // Commented for consolidation
//     getDefaultConfig, // Commented for consolidation
//     validateConfig, // Commented for consolidation
//     createConfig // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/configManager.js


// ============================================================================
// FILE 30/43: domain/utils/detectors/changeAnalyzer.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/changeAnalyzer.js
/**
 * Change Analyzer
 * Analyzes text changes and calculates metrics for detector analysis
 */

/**
 * Calculate metrics from changes for detector analysis
 * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
 * @param {Array<number>} eventTimestamps - Timestamps for each event (for temporal analysis)
 * @param {Array<Set>} eventRangeSets - Range sets for each event (for scattered pattern detection)
 * @param {number} firstChangeTime - Timestamp of first change in batch
 * @param {Object} config - Configuration with rapidScatteredTimeWindow
 * @returns {Object} Metrics object
 */
function calculateMetrics(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null, config = {}) {
    let totalInserted = 0;
    let totalDeleted = 0;
    let hasMultiLine = false;
    let pureInsertionCount = 0;
    let distinctRanges = new Set();
    const startLines = [];
    const endLines = [];
    
    for (const change of changes) {
        const inserted = change.text.length;
        const deleted = change.rangeLength;
        
        totalInserted += inserted;
        totalDeleted += deleted;
        
        if (change.text.includes('\n')) {
            hasMultiLine = true;
        }
        
        if (deleted === 0 && inserted > 0) {
            pureInsertionCount++;
        }
        
        // Use line-based key for scatteredness detection (more stable than character-precise)
        const lineKey = `${change.range.start.line}-${change.range.end.line}`;
        distinctRanges.add(lineKey);
        
        startLines.push(change.range.start.line);
        endLines.push(change.range.end.line);
    }
    
    // Fix: maxLineSpan should consider both start and end lines
    const allLines = [...startLines, ...endLines];
    const maxLineSpan = allLines.length > 0 
        ? Math.max(...allLines) - Math.min(...allLines)
        : 0;
    
    // Fix: Count whitespace-only changes instead of whitespace ratio
    // This avoids false positives on normal code (which naturally contains whitespace)
    // Fix: Only count insertions of whitespace (deletions have empty text but aren't whitespace-only)
    let whitespaceOnlyChangeCount = 0;
    for (const change of changes) {
        if (change.text.length > 0 && change.text.trim().length === 0) {
            whitespaceOnlyChangeCount++;
        }
    }
    const whitespaceOnlyChangeRatio = changes.length > 0 
        ? whitespaceOnlyChangeCount / changes.length 
        : 0;
    
    // Calculate temporal metrics using event timestamps (not per-change timestamps)
    // Fix: Track events, not individual changes, for true "rapid scattered" detection
    // Fix: Optimized from O(n²) to O(n) using sliding window two-pointer technique
    const timeWindow = config.rapidScatteredTimeWindow || 1000;
    let rapidEventCount = 0;
    let rapidRangeSet = new Set();
    let burstDurationMs = 0;
    
    if (eventTimestamps.length > 0 && firstChangeTime) {
        const lastEventTime = eventTimestamps[eventTimestamps.length - 1];
        burstDurationMs = lastEventTime - firstChangeTime;
        
        let maxRapidEventCount = 0;
        let maxRapidRanges = new Set();
        
        // Optimized sliding window: O(n) instead of O(n²)
        // Use two pointers: left (window start) and right (window end)
        let left = 0;
        let right = 0;
        const windowRanges = new Set();
        
        while (right < eventTimestamps.length) {
            // Expand window: move right pointer until window exceeds timeWindow
            while (right < eventTimestamps.length && 
                   eventTimestamps[right] - eventTimestamps[left] <= timeWindow) {
                // Add ranges from this event
                if (right < eventRangeSets.length) {
                    for (const rangeKey of eventRangeSets[right]) {
                        windowRanges.add(rangeKey);
                    }
                }
                right++;
            }
            
            // Current window: [left, right) has all events within timeWindow
            const windowEventCount = right - left;
            if (windowEventCount > maxRapidEventCount) {
                maxRapidEventCount = windowEventCount;
                // Create a copy of current window ranges
                maxRapidRanges = new Set(windowRanges);
            }
            
            // Shrink window: move left pointer and remove ranges from leftmost event
            if (left < eventRangeSets.length) {
                for (const rangeKey of eventRangeSets[left]) {
                    windowRanges.delete(rangeKey);
                }
            }
            left++;
            
            // If right didn't move, advance it to avoid infinite loop
            if (right === left) {
                right++;
            }
        }
        
        rapidEventCount = maxRapidEventCount;
        rapidRangeSet = maxRapidRanges;
    }
    
    return {
        totalInserted,
        totalDeleted,
        hasMultiLine,
        pureInsertionCount,
        distinctRanges,
        distinctRangeCount: distinctRanges.size,
        maxLineSpan,
        whitespaceOnlyChangeRatio,
        rapidEventCount,
        rapidRangeSet,
        rapidRangeCount: rapidRangeSet.size,
        burstDurationMs,
        changeCount: changes.length
    };
}

// module.exports = { // Commented for consolidation
//     calculateMetrics // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/changeAnalyzer.js


// ============================================================================
// FILE 31/43: domain/utils/detectors/formatterDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/formatterDetector.js
/**
 * Formatter Detector
 * Detects formatter patterns (many scattered changes with high whitespace ratio)
 */

/**
 * Detector: Formatter pattern (many scattered changes with high whitespace ratio)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with formatter thresholds
 * @returns {Object|null} Detection result or null
 */
function detectFormatter(metrics, config) {
    // Fix: Use whitespace-only change ratio instead of whitespace character ratio
    // This avoids false positives on normal code (which naturally contains whitespace)
    // Fix: Add guard for small inserted text per change (formatters typically have small inserts)
    // Fix: Also detect formatters with moderate whitespace ratio but strong other signals
    const avgInsertedPerChange = metrics.changeCount > 0 ? metrics.totalInserted / metrics.changeCount : 0;
    const formatterMaxAvgInsert = 30; // Formatters typically insert small amounts per change
    
    // Primary signal: high whitespace-only ratio
    const hasHighWhitespaceRatio = metrics.whitespaceOnlyChangeRatio > 0.6;
    
    // Secondary signal: formatter characteristics (many ranges, wide span, small inserts, both deletes and inserts)
    const hasFormatterCharacteristics = 
        metrics.distinctRangeCount >= config.formatterRangeCount && 
        metrics.maxLineSpan >= config.formatterLineSpan &&
        metrics.totalDeleted > 0 && // Formatters typically have deletes
        (metrics.totalInserted <= 500 || avgInsertedPerChange <= formatterMaxAvgInsert);
    
    // Detect formatter if: (high whitespace ratio) OR (formatter characteristics with moderate whitespace)
    if (hasFormatterCharacteristics) {
        const whitespaceThreshold = hasHighWhitespaceRatio ? 0.6 : 0.3; // Lower threshold if other signals are strong
        if (metrics.whitespaceOnlyChangeRatio > whitespaceThreshold) {
            return {
                label: 'formatter',
                score: hasHighWhitespaceRatio ? 0.9 : 0.7, // Lower confidence if whitespace ratio is moderate
                reason: `formatter pattern: ${metrics.distinctRangeCount} ranges, ${metrics.maxLineSpan} line span, ${(metrics.whitespaceOnlyChangeRatio * 100).toFixed(0)}% whitespace-only changes, avg ${avgInsertedPerChange.toFixed(0)} chars/change`,
                reasonTag: 'fmt:whitespace' // Fix: Add tag for stable filtering
            };
        }
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectFormatter // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/formatterDetector.js


// ============================================================================
// FILE 32/43: domain/utils/detectors/largeInsertionDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/largeInsertionDetector.js
/**
 * Large Insertion Detector
 * Detects large single insertions
 */

/**
 * Detector: Large single insertion
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with large insertion threshold
 * @returns {Object|null} Detection result or null
 */
function detectLargeInsertion(metrics, config) {
    if (metrics.totalInserted > config.largeInsertionThreshold && metrics.totalDeleted === 0) {
        return {
            label: 'ai',
            score: 0.6,
            reason: `large insertion: ${metrics.totalInserted} chars`,
            reasonTag: 'ai:large_insertion' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectLargeInsertion // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/largeInsertionDetector.js


// ============================================================================
// FILE 33/43: domain/utils/detectors/markerDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/markerDetector.js
/**
 * Marker Detector
 * Detects @ai markers in code changes (strong signal when present)
 */

/**
 * Check if changes contain @ai marker (primary signal for AI-generated code)
 * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
 * @returns {boolean} True if @ai marker is found
 */
function hasAIMarker(changes) {
    // Check for @ai marker in various comment formats
    // FIXED: CSS pattern was too strict, now uses flexible block comment matching
    // Fix: HTML marker regex should be case-insensitive and more flexible
    const markerPatterns = [
        /\/\/\s*@ai/i,                    // JavaScript/TypeScript/Java/C/C++/C#
        /#\s*@ai/i,                        // Python/Shell/Bash
        /<!--[\s\S]*?@ai[\s\S]*?-->/i,     // HTML/XML/Markdown - Fix: case-insensitive and flexible whitespace
        /--\s*@ai/i,                       // SQL
        /\/\*[\s\S]*?@ai[\s\S]*?\*\//i     // CSS - FIXED: flexible block comment matching
    ];
    
    for (const change of changes) {
        const text = change.text;
        for (const pattern of markerPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
    }
    // NOTE: Markers may exist in untouched context (AI edits elsewhere)
    // Currently only checking inserted text - could be enhanced to check document context
    return false;
}

// module.exports = { // Commented for consolidation
//     hasAIMarker // Commented for consolidation
// }; // Commented for consolidation



})(); // End IIFE for domain/utils/detectors/markerDetector.js


// ============================================================================
// FILE 34/43: domain/utils/detectors/multiLineDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/multiLineDetector.js
/**
 * Multi-Line Insertion Detector
 * Detects large multi-line insertions in localized area
 */

/**
 * Detector: Large multi-line insertions in localized area
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with multi-line thresholds
 * @returns {Object|null} Detection result or null
 */
function detectMultiLineInsertion(metrics, config) {
    // Fix: Use multiLineThreshold to require minimum multi-line size
    if (metrics.hasMultiLine && 
        metrics.totalInserted >= config.multiLineThreshold &&
        metrics.totalInserted >= config.aiMultiLineSize &&
        metrics.maxLineSpan <= config.aiLineSpan) {
        return {
            label: 'ai',
            score: 0.7,
            reason: `large multi-line insertion: ${metrics.totalInserted} chars, ${metrics.maxLineSpan} line span`,
            reasonTag: 'ai:multi_line' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectMultiLineInsertion // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/multiLineDetector.js


// ============================================================================
// FILE 35/43: domain/utils/detectors/pureInsertionDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/pureInsertionDetector.js
/**
 * Pure Insertion Detector
 * Detects multiple pure insertions (no deletes)
 */

/**
 * Detector: Multiple pure insertions (no deletes)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with pure insertion thresholds
 * @returns {Object|null} Detection result or null
 */
function detectPureInsertions(metrics, config) {
    if (metrics.pureInsertionCount >= config.pureInsertionCount && 
        metrics.totalInserted > config.pureInsertionSize &&
        metrics.totalDeleted === 0) {
        return {
            label: 'ai',
            score: 0.6,
            reason: `pure insertions: ${metrics.pureInsertionCount} insertions, ${metrics.totalInserted} chars`,
            reasonTag: 'ai:pure_insertions' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectPureInsertions // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/pureInsertionDetector.js


// ============================================================================
// FILE 36/43: domain/utils/detectors/rapidScatteredDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/rapidScatteredDetector.js
/**
 * Rapid Scattered Detector
 * Detects rapid scattered changes (strong AI signal)
 */

/**
 * Detector: Rapid scattered changes (strong AI signal)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with rapid scattered thresholds
 * @returns {Object|null} Detection result or null
 */
function detectRapidScattered(metrics, config) {
    // Fix: Use event count instead of change count (events are what matter for "rapid")
    if (metrics.rapidEventCount >= config.rapidScatteredEventCount &&
        metrics.rapidRangeCount >= config.rapidScatteredRangeCount &&
        metrics.totalInserted >= config.rapidScatteredMinSize) {
        return {
            label: 'ai',
            score: 0.8,
            reason: `rapid scattered: ${metrics.rapidEventCount} events in ${config.rapidScatteredTimeWindow}ms window across ${metrics.rapidRangeCount} ranges`,
            reasonTag: 'ai:rapid_scattered' // Fix: Add tag for stable filtering
        };
    }
    
    // Fix: Require at least 2 events for rapid burst (avoid false positives from single large events)
    // Fix: Use separate rapidBurstChangeCount threshold (not rapidScatteredEventCount)
    // Fix: Require rapidRangeCount >= 2 to reduce false positives from tight loop editing one place
    if (metrics.rapidEventCount >= 2 && metrics.burstDurationMs > 0 && metrics.burstDurationMs <= 1200 &&
        metrics.rapidRangeCount >= 2 && // Guard: require scatteredness even in burst branch
        metrics.distinctRangeCount >= config.rapidScatteredRangeCount &&
        metrics.changeCount >= (config.rapidBurstChangeCount || 10) &&
        metrics.totalInserted >= config.rapidScatteredMinSize) {
        return {
            label: 'ai',
            score: 0.7,
            reason: `rapid burst: ${metrics.rapidEventCount} events, ${metrics.changeCount} changes in ${metrics.burstDurationMs}ms`,
            reasonTag: 'ai:rapid_burst' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectRapidScattered // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/rapidScatteredDetector.js


// ============================================================================
// FILE 37/43: domain/utils/detectors/scatteredEditsDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/scatteredEditsDetector.js
/**
 * Scattered Edits Detector
 * Detects scattered edits (could be formatter or AI)
 */

/**
 * Detector: Scattered edits (could be formatter or AI)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with scattered edit thresholds
 * @returns {Object|null} Detection result or null
 */
function detectScatteredEdits(metrics, config) {
    if (metrics.distinctRangeCount >= config.scatteredRangeCount && 
        metrics.changeCount >= config.scatteredChangeCount) {
        if (metrics.totalInserted > config.scatteredSizeThreshold) {
            return {
                label: 'ai',
                score: 0.5,
                reason: `scattered edits: ${metrics.distinctRangeCount} ranges, ${metrics.totalInserted} chars`,
                reasonTag: 'ai:scattered' // Fix: Add tag for stable filtering
            };
        }
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectScatteredEdits // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/scatteredEditsDetector.js

