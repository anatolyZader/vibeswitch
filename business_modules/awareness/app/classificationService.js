/**
 * ClassificationService - Application service for change classification
 * 
 * Orchestrates all classification-related business logic:
 * - Manages the ChangeClassifier lifecycle
 * - Converts raw VS Code changes to Change domain entities
 * - Handles classification configuration
 * - Processes classification results (routing, batch recording, diff bullets)
 * - Provides a clean interface for classification workflow
 */

const ChangeClassifier = require('../domain/utils/changeClassifier');
const Change = require('../domain/entities/change');
const IIdGeneratorPort = require('../domain/ports/IIdGeneratorPort');
const ILoggerPort = require('../domain/ports/ILoggerPort');
const { buildDiffBullets } = require('../domain/utils/diffBulletBuilder');

class ClassificationService {
    /**
     * @param {IIdGeneratorPort} idGeneratorPort - ID generator port for creating change IDs
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     * @param {number} debounceMs - Debounce window in milliseconds (default: 200)
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     * @param {IAwarenessVSCodePort} vscodeAdapter - VS Code adapter (required for handleClassifiedChanges)
     * @param {Function} recordChangeBatch - Function to record change batches (required for handleClassifiedChanges)
     * @param {Function} generateDiffBullets - Function to generate diff bullets (optional, uses default if not provided)
     * @param {Function} handleAISuggestionBatch - Function to handle AI suggestion batches (required for handleClassifiedChanges)
     * @param {Function} handleUserEditBatch - Function to handle user edit batches (required for handleClassifiedChanges)
     */
    constructor({
        idGeneratorPort,
        mode = 'dev',
        debounceMs = 200,
        loggerPort = null,
        vscodeAdapter = null,
        recordChangeBatch = null,
        generateDiffBullets: generateDiffBulletsFn = null,
        handleAISuggestionBatch = null,
        handleUserEditBatch = null
    }) {
        if (!idGeneratorPort) {
            throw new Error('ClassificationService requires idGeneratorPort');
        }
        
        this.idGeneratorPort = idGeneratorPort;
        this.loggerPort = loggerPort;
        this.mode = mode;
        this.vscodeAdapter = vscodeAdapter;
        this.recordChangeBatch = recordChangeBatch;
        this.generateDiffBulletsFn = generateDiffBulletsFn;
        this.handleAISuggestionBatch = handleAISuggestionBatch;
        this.handleUserEditBatch = handleUserEditBatch;
        
        // Get classification configuration for mode
        const classifierConfig = this._getClassifierConfig(mode);
        
        // Create change classifier
        this.changeClassifier = new ChangeClassifier(debounceMs, classifierConfig);
    }
    
    /**
     * Get classification configuration for mode
     * @param {string} mode - Current mode ('vibe', 'dev')
     * @returns {Object} Configuration object
     */
    _getClassifierConfig(mode) {
        const baseConfig = {
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
            rapidScatteredTimeWindow: 1000, // 1 second window
            rapidScatteredEventCount: 8, // Minimum events in window
            rapidScatteredRangeCount: 6, // Minimum distinct line ranges
            rapidScatteredMinSize: 50, // Minimum total size
            rapidBurstChangeCount: 10, // Minimum changes for rapid burst branch
            // Behavioral inference mode: use heuristics as primary, markers as strong signal when present
            markerOnly: false
        };
        
        // VIBE: more permissive (lower thresholds) - behavioral inference enabled
        if (mode === 'vibe') {
            return {
                ...baseConfig,
                pureInsertionSize: 15,
                largeInsertionThreshold: 80,
                aiMultiLineSize: 40,
                rapidScatteredEventCount: 6, // Lower threshold for vibe mode
                rapidScatteredRangeCount: 5,
                rapidScatteredMinSize: 40,
                rapidBurstChangeCount: 8, // Lower threshold for vibe mode
                markerOnly: false
            };
        }
        
        // DEV: default (conservative) - behavioral inference enabled
        return baseConfig;
    }
    
    /**
     * Convert raw VS Code changes to Change domain entities
     * @param {Array} rawChanges - Array of TextDocumentContentChangeEvent objects
     * @param {string} documentUri - Document URI string
     * @param {string} batchId - Optional batch ID
     * @returns {Array<Change>} Array of Change entities
     */
    _convertToChangeEntities(rawChanges, documentUri, batchId = null) {
        return rawChanges.map((rawChange, index) => {
            const changeId = this.idGeneratorPort.generateId();
            const timestamp = Date.now();
            
            return new Change(
                changeId,
                documentUri,
                rawChange.range,
                rawChange.text || '',
                rawChange.rangeLength || 0,
                timestamp,
                { batchId }
            );
        });
    }
    
    /**
     * Classify a text document change event
     * @param {vscode.TextDocumentChangeEvent} event - VS Code text document change event
     * @param {Function} onClassified - Callback function (document, classification, changes[])
     *   - document: vscode.TextDocument
     *   - classification: {label, confidence, reasons, meta}
     *   - changes: Array<Change> - Domain entities
     */
    classifyEvent(event, onClassified) {
        if (!event || !event.contentChanges || event.contentChanges.length === 0) {
            return;
        }
        
        const documentUri = event.document.uri.toString();
        
        // Register with classifier - it will debounce and call our callback
        this.changeClassifier.addEvent(event, (document, classification, rawChanges) => {
            // Convert raw changes to Change domain entities
            const changes = this._convertToChangeEntities(rawChanges, documentUri);
            
            // Classify each change entity
            changes.forEach(change => {
                change.classify(classification);
            });
            
            // Call the provided callback with domain entities
            if (onClassified) {
                onClassified(document, classification, changes);
            }
        });
    }
    
    /**
     * Handle classified changes (orchestrates all post-classification logic)
     * @param {vscode.TextDocument} document - The document
     * @param {Object} classification - Classification result {label, confidence, reasons, meta}
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleClassifiedChanges(document, classification, changes) {
        const isAI = classification.label === 'ai';
        const isFormatter = classification.label === 'formatter';
        
        // Convert Change entities to raw format for buildDiffBullets (if needed)
        const rawChanges = changes.map(change => ({
            range: change.range,
            text: change.text,
            rangeLength: change.rangeLength
        }));
        
        // DIFF bullet tracking: record batch event and generate bullets
        const uri = document.uri.toString();
        const file = this.vscodeAdapter ? this.vscodeAdapter.asRelativePath(document.uri) : document.uri.toString();
        const inserted = changes.reduce((sum, c) => sum + c.size, 0);
        const deleted = changes.reduce((sum, c) => sum + c.deletedSize, 0);
        
        // Calculate line span and distinct range count
        const startLines = changes.map(c => c.range.start.line);
        const endLines = changes.map(c => c.range.end.line);
        const minLine = Math.min(...startLines, ...endLines);
        const maxLine = Math.max(...startLines, ...endLines);
        const lineSpan = maxLine - minLine;
        
        // Count distinct ranges (by start line for simplicity)
        const distinctRanges = new Set(changes.map(c => c.range.start.line));
        const distinctRangeCount = distinctRanges.size;
        
        // Record change batch
        if (this.recordChangeBatch) {
            const batchId = this.recordChangeBatch({
                ts: Date.now(),
                uri,
                file,
                label: classification.label,
                confidence: classification.confidence,
                reasons: classification.reasons,
                changeCount: changes.length,
                inserted,
                deleted,
                lineSpan,
                distinctRangeCount,
                kind: 'batch'
            });
            
            // Generate and record DIFF bullet skeletons (explicitly linked via batchId)
            const bullets = this._generateDiffBullets(document, rawChanges, classification);
            if (bullets.length > 0) {
                this.recordChangeBatch({
                    ts: Date.now(),
                    uri,
                    file,
                    kind: 'diff_bullets',
                    batchId, // Fix: Explicit link to batch entry
                    bullets
                });
            }
        }
        
        // Route based on classification
        if (isAI) {
            const totalSize = changes.reduce((sum, c) => sum + c.size, 0);
            const reasonsStr = classification.reasons.join('; ');
            if (this.loggerPort) {
                this.loggerPort.log(
                    `AwarenessMonitor: ✅ AI change detected (confidence=${(classification.confidence * 100).toFixed(0)}%): size=${totalSize}, changes=${changes.length}, reasons=[${reasonsStr}], file=${document.fileName}`,
                    false,
                    false,
                    `aiDetected:${uri}`
                );
            }
            // Record as single batch suggestion (not per-change)
            // This prevents dozens of "pending suggestions" from a single AI refactor
            // Pass Change entities directly (optimized - preserves classification metadata)
            if (this.handleAISuggestionBatch) {
                this.handleAISuggestionBatch(document, changes);
            }
        } else if (isFormatter) {
            // Formatters should not mark AI suggestions as adapted
            // Treat formatter detection as "neutral" - don't call recordUserEdit
            // This prevents auto-formatters from accidentally marking AI suggestions as adapted
            if (this.loggerPort) {
                this.loggerPort.log(
                    `AwarenessMonitor: 🔧 Formatter detected: ${classification.reasons.join('; ')}`,
                    false,
                    false,
                    `formatterDetected:${uri}`
                );
            }
            // Don't record formatter edits - they're not user edits and shouldn't affect suggestion status
        } else if (classification.label === 'user') {
            // Only record user edits for explicit 'user' label, not 'unknown'
            // Unknown means we couldn't determine origin - don't assume it's user
            // Pass Change entities directly
            if (this.handleUserEditBatch) {
                this.handleUserEditBatch(document, changes);
            }
        } else {
            // Unknown label - don't record as user edits (could be AI we missed, or ambiguous)
            // Ledger will still capture it for audit trail, but don't mark suggestions as adapted
        }
    }
    
    /**
     * Generate diff bullets from changes
     * @param {vscode.TextDocument} document - Document
     * @param {Array} rawChanges - Raw change objects (for buildDiffBullets compatibility)
     * @param {Object} classification - Classification result
     * @returns {Array<string>} Array of diff bullet strings
     */
    _generateDiffBullets(document, rawChanges, classification) {
        if (this.generateDiffBulletsFn) {
            return this.generateDiffBulletsFn(document, rawChanges, classification);
        }
        
        // Fallback to default implementation
        if (this.vscodeAdapter) {
            return buildDiffBullets(document, rawChanges, classification, this.vscodeAdapter);
        }
        
        return [];
    }
    
    /**
     * Flush pending changes for a document
     * @param {vscode.TextDocument} document - Document to flush
     * @param {Object} options - Flush options
     * @param {string} options.source - Source of flush ('close', 'switch', etc.)
     */
    flush(document, options = {}) {
        this.changeClassifier.flush(document, options);
    }
    
    /**
     * Flush all pending changes
     * @param {Function} onClassified - Callback for each classified batch
     *   (document, classification, changes[])
     */
    flushAll(onClassified) {
        this.changeClassifier.flushAll((document, classification, rawChanges) => {
            const documentUri = document.uri.toString();
            const changes = this._convertToChangeEntities(rawChanges, documentUri);
            
            // Classify each change entity
            changes.forEach(change => {
                change.classify(classification);
            });
            
            // Call the provided callback with domain entities
            if (onClassified) {
                onClassified(document, classification, changes);
            }
        });
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        if (this.changeClassifier) {
            this.changeClassifier.clear();
        }
    }
    
    /**
     * Get classification statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return this.changeClassifier ? this.changeClassifier.getStatistics() : null;
    }
}

module.exports = ClassificationService;
