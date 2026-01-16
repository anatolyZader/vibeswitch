/**
 * ClassificationService - Application service for change classification
 * 
 * Orchestrates all classification-related business logic:
 * - Manages the ChangeClassifier lifecycle
 * - Converts raw VS Code changes to Change domain entities
 * - Handles classification configuration
 * - Processes classification results (routing, batch recording, diff bullets)
 * - Provides a clean interface for classification workflow
 * 
 * Self-contained service with direct dependencies (no callbacks).
 */

const ChangeClassifier = require('./classification/changeClassifier');
const Change = require('../domain/entities/change');
const IIdGeneratorPort = require('../domain/ports/IIdGeneratorPort');
const ILoggerPort = require('../domain/ports/ILoggerPort');
const { buildDiffBullets } = require('./utilities/diffBulletService');
const { getClassifierConfig } = require('./scoring/classificationConfig');

class ClassificationService {
    /**
     * @param {IIdGeneratorPort} idGeneratorPort - ID generator port for creating change IDs
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     * @param {number} debounceMs - Debounce window in milliseconds (default: 200)
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     * @param {IAwarenessVSCodePort} vscodeAdapter - VS Code adapter (required)
     * @param {ChangeLedgerService} changeLedgerService - Change ledger service for recording batches
     * @param {SuggestionLifecycleService} suggestionLifecycleService - Suggestion service for handling AI/user batches
     */
    constructor({
        idGeneratorPort,
        mode = 'dev',
        debounceMs = 200,
        loggerPort = null,
        vscodeAdapter = null,
        changeLedgerService = null,
        suggestionLifecycleService = null
    }) {
        if (!idGeneratorPort) {
            throw new Error('ClassificationService requires idGeneratorPort');
        }
        if (!vscodeAdapter) {
            throw new Error('ClassificationService requires vscodeAdapter');
        }
        if (!changeLedgerService) {
            throw new Error('ClassificationService requires changeLedgerService');
        }
        if (!suggestionLifecycleService) {
            throw new Error('ClassificationService requires suggestionLifecycleService');
        }
        
        this.idGeneratorPort = idGeneratorPort;
        this.loggerPort = loggerPort;
        this.mode = mode;
        this.vscodeAdapter = vscodeAdapter;
        this.changeLedgerService = changeLedgerService;
        this.suggestionLifecycleService = suggestionLifecycleService;
        
        // Get classification configuration for mode
        const classifierConfig = getClassifierConfig(mode);
        
        // Create change classifier with logger port for config validation warnings
        this.changeClassifier = new ChangeClassifier(debounceMs, classifierConfig, this.loggerPort);
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
     * Automatically handles classified changes (records batch, routes to handlers)
     * @param {vscode.TextDocumentChangeEvent} event - VS Code text document change event
     * @param {Function} onClassified - Optional callback function (document, classification, changes[])
     *   - document: vscode.TextDocument
     *   - classification: {label, confidence, reasons, meta}
     *   - changes: Array<Change> - Domain entities
     */
    classifyEvent(event, onClassified = null) {
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
            
            // Automatically handle classified changes (records batch, routes to handlers)
            this.handleClassifiedChanges(document, classification, changes);
            
            // Call the provided callback with domain entities (for external tracking)
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
        // Record change batch and diff bullets
        this._recordChangeBatch(document, classification, changes);
        
        // Route to appropriate handlers based on classification
        this._routeClassifiedChanges(document, classification, changes);
    }
    
    /**
     * Record change batch and diff bullets
     * @private
     */
    _recordChangeBatch(document, classification, changes) {
        if (!this.changeLedgerService) {
            return;
        }
        
        const uri = document.uri.toString();
        const file = this.vscodeAdapter.asRelativePath(document.uri);
        const inserted = changes.reduce((sum, c) => sum + c.size, 0);
        const deleted = changes.reduce((sum, c) => sum + c.deletedSize, 0);
        
        // Calculate line span and distinct range count
        const startLines = changes.map(c => c.range.start.line);
        const endLines = changes.map(c => c.range.end.line);
        const minLine = Math.min(...startLines, ...endLines);
        const maxLine = Math.max(...startLines, ...endLines);
        const lineSpan = maxLine - minLine;
        const distinctRangeCount = new Set(changes.map(c => c.range.start.line)).size;
        
        // Record batch
        const batchId = this.changeLedgerService.append({
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
        
        // Generate and record diff bullets
        const rawChanges = changes.map(c => ({
            range: c.range,
            text: c.text,
            rangeLength: c.rangeLength
        }));
        const bullets = this._generateDiffBullets(document, rawChanges, classification);
        if (bullets.length > 0) {
            this.changeLedgerService.append({
                ts: Date.now(),
                uri,
                file,
                kind: 'diff_bullets',
                batchId,
                bullets
            });
        }
    }
    
    /**
     * Route classified changes to appropriate handlers
     * @private
     */
    _routeClassifiedChanges(document, classification, changes) {
        const uri = document.uri.toString();
        const label = classification.label;
        
        if (label === 'ai') {
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
            if (this.suggestionLifecycleService) {
                this.suggestionLifecycleService.recordAISuggestionBatch(document, changes);
            }
        } else if (label === 'formatter') {
            if (this.loggerPort) {
                this.loggerPort.log(
                    `AwarenessMonitor: 🔧 Formatter detected: ${classification.reasons.join('; ')}`,
                    false,
                    false,
                    `formatterDetected:${uri}`
                );
            }
            // Formatters are neutral - don't record as user edits
        } else if (label === 'user') {
            if (this.suggestionLifecycleService) {
                this.suggestionLifecycleService.recordUserEditBatch(document, changes);
            }
        }
        // Unknown label: ledger captures it for audit, but don't mark suggestions as adapted
    }
    
    /**
     * Generate diff bullets from changes
     * @param {vscode.TextDocument} document - Document
     * @param {Array} rawChanges - Raw change objects (for buildDiffBullets compatibility)
     * @param {Object} classification - Classification result
     * @returns {Array<string>} Array of diff bullet strings
     */
    _generateDiffBullets(document, rawChanges, classification) {
        return buildDiffBullets(document, rawChanges, classification, this.vscodeAdapter);
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
     * Automatically handles classified changes (records batch, routes to handlers)
     * @param {Function} onClassified - Optional callback for each classified batch
     *   (document, classification, changes[])
     */
    flushAll(onClassified = null) {
        this.changeClassifier.flushAll((document, classification, rawChanges) => {
            const documentUri = document.uri.toString();
            const changes = this._convertToChangeEntities(rawChanges, documentUri);
            
            // Classify each change entity
            changes.forEach(change => {
                change.classify(classification);
            });
            
            // Automatically handle classified changes (records batch, routes to handlers)
            this.handleClassifiedChanges(document, classification, changes);
            
            // Call the provided callback with domain entities (for external tracking)
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
