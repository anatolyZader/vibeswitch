/**
 * AwarenessController - Input layer controller for awareness monitoring
 * 
 * Thin controller that handles VS Code commands and delegates to app layer service files.
 * Uses explicit dependencies instead of whole DI container for better testability.
 * 
 * Design principles:
 * - Controller throws errors; composition root handles UI
 */

const { isNonCodeDocument, isSkippableUri } = require('../domain/utils/utils');

class AwarenessController {
    /**
     * @param {Object} dependencies - Explicit dependencies
     * @param {AwarenessService} dependencies.awarenessService - Awareness service instance
     * @param {Object} dependencies.logger - Logger instance (optional, expects { error(msg, err?), info(msg)? })
     */
    constructor({ awarenessService, logger = null }) {
        if (!awarenessService) {
            throw new Error('AwarenessController requires awarenessService');
        }
        this.awarenessService = awarenessService;
        this.logger = logger;
    }
    
    /**
     * Start monitoring
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {string} mode - Current mode ('vibe' or 'dev')
     */
    async startMonitoring(context, updateFileColorsInExplorer = null, mode = 'dev') {
        try {
            // Pass self to service so it can create event listener
            await this.awarenessService.start(context, updateFileColorsInExplorer, mode, this);
        } catch (error) {
            this.logger?.error('AwarenessController.startMonitoring failed', error);
            throw error;
        }
    }
    
    /**
     * Stop monitoring
     */
    async stopMonitoring() {
        try {
            await this.awarenessService.stop();
        } catch (error) {
            this.logger?.error('AwarenessController.stopMonitoring failed', error);
            throw error;
        }
    }
    
    /**
     * Get current awareness score
     * @returns {Object} Score data
     */
    getScore() {
        try {
            return this.awarenessService.getScore();
        } catch (error) {
            this.logger?.error('AwarenessController.getScore failed', error);
            throw error;
        }
    }
    
    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        try {
            this.awarenessService.handleExternallyCreatedFile(filePath);
        } catch (error) {
            this.logger?.error('AwarenessController.handleExternallyCreatedFile failed', error);
            throw error;
        }
    }
    
    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        try {
            return this.awarenessService.getStatus();
        } catch (error) {
            this.logger?.error('AwarenessController.getStatus failed', error);
            throw error;
        }
    }
    
    // ============================================
    // Event Handling Methods - Called by AwarenessEventListener
    // ============================================
    
    /**
     * Classify text document change event and handle classification results
     * @param {vscode.TextDocumentChangeEvent} event - VS Code text document change event
     */
    classifyTextChange(event) {
        try {
            // Validate document (early return if invalid)
            if (!this.awarenessService.isValidCodeDocument(event.document)) {
                return;
            }
            
            // Log the event
            const scheme = event.document.uri.scheme;
            const fileName = event.document.fileName || 'unknown';
            const uri = event.document.uri.toString();
            this.log(`AwarenessMonitor: Text change detected - scheme: ${scheme}, file: ${fileName}, changes: ${event.contentChanges.length}`, `onTextChange:${uri}`);
            
            // Classify and handle results automatically
            this.awarenessService.classifyTextChange(event, (document, classification, changes) => {
                // Automatically handle classified changes (no need for external callback)
                this.awarenessService.handleClassifiedChanges(document, classification, changes);
            });
        } catch (error) {
            this.logger?.error('AwarenessController.classifyTextChange failed', error);
            throw error;
        }
    }
    
    /**
     * Handle AI suggestion batch (from text change classification)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleAISuggestionBatch(document, changes) {
        try {
            this.awarenessService.handleAISuggestionBatch(document, changes);
        } catch (error) {
            this.logger?.error('AwarenessController.handleAISuggestionBatch failed', error);
            throw error;
        }
    }
    
    /**
     * Handle user edit batch (from text change classification)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleUserEditBatch(document, changes) {
        try {
            this.awarenessService.handleUserEditBatch(document, changes);
        } catch (error) {
            this.logger?.error('AwarenessController.handleUserEditBatch failed', error);
            throw error;
        }
    }
    
    /**
     * Handle classified changes (orchestrates all post-classification logic)
     * @param {vscode.TextDocument} document - The document
     * @param {Object} classification - Classification result {label, confidence, reasons, meta}
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleClassifiedChanges(document, classification, changes) {
        try {
            this.awarenessService.handleClassifiedChanges(document, classification, changes);
        } catch (error) {
            this.logger?.error('AwarenessController.handleClassifiedChanges failed', error);
            throw error;
        }
    }
    
    /**
     * Handle file created event
     * @param {vscode.Uri} fileUri - The file URI
     * @param {Object} options - Options
     * @returns {Promise} Promise resolving to suggestion or null
     */
    async handleFileCreated(fileUri, options = {}) {
        try {
            // Validate URI (early return if invalid)
            if (!this.awarenessService.isValidUri(fileUri)) {
                return Promise.resolve(null);
            }
            
            // Log the event
            this.log(`AwarenessMonitor: Processing file creation - ${fileUri.toString()}`, `fileCreated:${fileUri.toString()}`);
            
            const suggestion = await this.awarenessService.handleFileCreated(fileUri, options);
            
            // Log success if suggestion created
            if (suggestion) {
                this.log(`AwarenessMonitor: Detected AI file creation - ${suggestion.size} chars`, `fileCreatedSuccess:${fileUri.toString()}`);
            }
            
            return suggestion;
        } catch (error) {
            this.logError('AwarenessMonitor: Error reading created file', error);
            throw error;
        }
    }
    
    /**
     * Handle file saved event
     * @param {vscode.TextDocument} document - The saved document
     * @param {Map} saveCache - Cache for duplicate detection (uri:version -> {hash, timestamp})
     */
    handleFileSaved(document, saveCache) {
        try {
            // Validate document (early return if invalid)
            if (!this.awarenessService.isValidCodeDocument(document)) {
                return;
            }
            
            const content = document.getText();
            const uri = document.uri.toString();
            
            // Lowered threshold to catch more AI file operations
            if (content.length > 200) {
                // Improved duplicate detection: primary key is uri + version (fast, deterministic)
                const cacheKey = `${uri}:${document.version}`;
                const cached = saveCache.get(cacheKey);
                
                // If we already processed this exact version, skip
                if (cached) {
                    return; // Already processed
                }
                
                // Log the event
                this.log(`AwarenessMonitor: Large file saved - ${content.length} chars in ${document.fileName}`, `fileSaved:${uri}`);
                
                // Fixed: Range math bug - lineCount is 1-based count, but line indices are 0-based
                const lastLine = Math.max(0, document.lineCount - 1);
                const lastLineText = document.lineAt(lastLine).text;
                const lastChar = lastLineText.length;
                
                // Get Range constructor
                const Range = this.awarenessService.getRange();
                if (!Range) {
                    return; // Cannot create range without Range constructor
                }
                
                // Create and track suggestion
                this.awarenessService.handleFileSaved(document, {
                    range: new Range(0, 0, lastLine, lastChar),
                    text: content,
                    size: content.length,
                    isFileWrite: true
                });
                
                // Update cache (primary key: version)
                saveCache.set(cacheKey, {
                    hash: this._simpleHash(content),
                    timestamp: Date.now()
                });
                
                // Clean old cache entries (keep last 100)
                if (saveCache.size > 100) {
                    const entries = Array.from(saveCache.entries());
                    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
                    saveCache.clear();
                    entries.slice(0, 100).forEach(([key, value]) => {
                        saveCache.set(key, value);
                    });
                }
            }
        } catch (error) {
            this.logger?.error('AwarenessController.handleFileSaved failed', error);
            throw error;
        }
    }
    
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }
    
    /**
     * Handle file opened event
     * @param {vscode.TextDocument} document - The opened document
     */
    handleFileOpened(document) {
        try {
            // Validate document (early return if invalid)
            if (!this.awarenessService.isValidCodeDocument(document)) {
                return;
            }
            
            // Extract URI string for service
            const uri = document.uri.toString();
            this.awarenessService.handleFileOpened(uri);
        } catch (error) {
            this.logger?.error('AwarenessController.handleFileOpened failed', error);
            throw error;
        }
    }
    
    /**
     * Handle cursor move event and check for suggestion review
     * @param {string} uri - Document URI string
     * @param {vscode.Position} position - Cursor position
     * @returns {Object} Review tracking info {pendingSuggestions, isPositionInRange function}
     */
    handleCursorMove(uri, position) {
        try {
            this.awarenessService.handleCursorMove(uri, position);
            
            // Return helper functions for review tracking (input layer responsibility)
            return {
                getPendingSuggestions: () => this.awarenessService.getSuggestionsByStatus('pending'),
                isPositionInRange: (pos, range) => this.awarenessService.isPositionInRange(pos, range)
            };
        } catch (error) {
            this.logger?.error('AwarenessController.handleCursorMove failed', error);
            throw error;
        }
    }
    
    /**
     * Handle scroll event
     * @param {string} uri - Document URI string
     */
    handleScroll(uri) {
        try {
            this.awarenessService.handleScroll(uri);
        } catch (error) {
            this.logger?.error('AwarenessController.handleScroll failed', error);
            throw error;
        }
    }
    
    /**
     * Handle editor change (flush previous document)
     * @param {vscode.TextEditor} editor - The active editor
     * @param {string} previousActiveDocumentUri - Previous document URI
     */
    handleEditorChange(editor, previousActiveDocumentUri) {
        try {
            // Flush classifier for previous document (prevent memory leaks)
            if (previousActiveDocumentUri) {
                // Get document from workspace
                const textDocuments = this.awarenessService.getTextDocuments();
                const previousDoc = textDocuments.find(
                    d => d.uri.toString() === previousActiveDocumentUri
                );
                // Fix: Emit with source meta instead of silent flush to preserve evidence
                // Silent flush drops potentially important data (user moved away quickly)
                // Emit with source='switch' so downstream can filter if needed
                if (previousDoc) {
                    this.awarenessService.flushChanges(previousDoc, { source: 'switch' });
                }
            }
        } catch (error) {
            this.logger?.error('AwarenessController.handleEditorChange failed', error);
            throw error;
        }
    }
    
    /**
     * Record change batch in ledger
     * @param {Object} entry - Change ledger entry
     * @returns {string} Batch ID
     */
    recordChangeBatch(entry) {
        try {
            return this.awarenessService.recordChangeBatch(entry);
        } catch (error) {
            this.logger?.error('AwarenessController.recordChangeBatch failed', error);
            throw error;
        }
    }
    
    /**
     * Get suggestions
     * @returns {Array} Array of suggestions
     */
    getSuggestions() {
        try {
            return this.awarenessService.getSuggestions();
        } catch (error) {
            this.logger?.error('AwarenessController.getSuggestions failed', error);
            throw error;
        }
    }
    
    /**
     * Get suggestions by status
     * @param {string} status - Status filter
     * @returns {Array} Array of suggestions
     */
    getSuggestionsByStatus(status) {
        try {
            return this.awarenessService.getSuggestionsByStatus(status);
        } catch (error) {
            this.logger?.error('AwarenessController.getSuggestionsByStatus failed', error);
            throw error;
        }
    }
    
    /**
     * Update suggestion review time
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Review time in milliseconds
     */
    updateSuggestionReviewTime(suggestionId, reviewTime) {
        try {
            this.awarenessService.updateSuggestionReviewTime(suggestionId, reviewTime);
        } catch (error) {
            this.logger?.error('AwarenessController.updateSuggestionReviewTime failed', error);
            throw error;
        }
    }
    
    /**
     * Mark suggestion as reviewed
     * @param {string} suggestionId - Suggestion ID
     */
    markSuggestionAsReviewed(suggestionId) {
        try {
            this.awarenessService.markSuggestionAsReviewed(suggestionId);
        } catch (error) {
            this.logger?.error('AwarenessController.markSuggestionAsReviewed failed', error);
            throw error;
        }
    }
    
    /**
     * Check suggestion status
     * @param {string} suggestionId - Suggestion ID
     * @returns {Promise}
     */
    async checkSuggestionStatus(suggestionId) {
        try {
            await this.awarenessService.checkSuggestionStatus(suggestionId);
        } catch (error) {
            this.logger?.error('AwarenessController.checkSuggestionStatus failed', error);
            throw error;
        }
    }
    
    /**
     * Flush pending changes for a document
     * @param {vscode.TextDocument} document - Document to flush
     * @param {Object} options - Flush options
     * @param {string} options.source - Source of flush ('close', 'switch', etc.)
     */
    flushChanges(document, options = {}) {
        try {
            this.awarenessService.flushChanges(document, options);
        } catch (error) {
            this.logger?.error('AwarenessController.flushChanges failed', error);
            throw error;
        }
    }
    
    /**
     * Flush all pending changes
     * @param {Function} onClassified - Callback for each classified batch
     */
    flushAllChanges() {
        try {
            // Flush all pending changes and automatically handle classification results
            this.awarenessService.flushAllChanges((document, classification, changes) => {
                // Automatically handle classified changes (no need for external callback)
                this.awarenessService.handleClassifiedChanges(document, classification, changes);
            });
        } catch (error) {
            this.logger?.error('AwarenessController.flushAllChanges failed', error);
            throw error;
        }
    }
    
    /**
     * Validate if document is a code document (input validation)
     * @param {vscode.TextDocument} document - Document to validate
     * @returns {boolean} True if document should be processed
     */
    isValidCodeDocument(document) {
        return !isNonCodeDocument(document);
    }
    
    /**
     * Validate if URI should be processed (input validation)
     * @param {vscode.Uri|string} uriOrScheme - URI or scheme string
     * @returns {boolean} True if URI should be processed
     */
    isValidUri(uriOrScheme) {
        return !isSkippableUri(uriOrScheme);
    }
    
    /**
     * Generate diff bullets (delegates to service)
     * @param {vscode.TextDocument} document - Document
     * @param {Array} rawChanges - Raw change objects
     * @param {Object} classification - Classification result
     * @returns {Array<string>} Array of diff bullet strings
     */
    generateDiffBullets(document, rawChanges, classification) {
        try {
            return this.awarenessService.generateDiffBullets(document, rawChanges, classification);
        } catch (error) {
            this.logger?.error('AwarenessController.generateDiffBullets failed', error);
            return [];
        }
    }
    
    /**
     * Check if position is within range (delegates to service)
     * @param {vscode.Position} position - Position to check
     * @param {vscode.Range} range - Range to check against
     * @returns {boolean} True if position is within range
     */
    isPositionInRange(position, range) {
        try {
            return this.awarenessService.isPositionInRange(position, range);
        } catch (error) {
            this.logger?.error('AwarenessController.isPositionInRange failed', error);
            return false;
        }
    }
    
    /**
     * Get relative path from URI (delegates to service)
     * @param {vscode.Uri} uri - URI to convert
     * @returns {string} Relative path
     */
    asRelativePath(uri) {
        try {
            return this.awarenessService.asRelativePath(uri);
        } catch (error) {
            this.logger?.error('AwarenessController.asRelativePath failed', error);
            return uri.fsPath || uri.toString();
        }
    }
    
    /**
     * Get Range constructor (delegates to service)
     * @returns {Function} Range constructor
     */
    getRange() {
        try {
            return this.awarenessService.getRange();
        } catch (error) {
            this.logger?.error('AwarenessController.getRange failed', error);
            return null;
        }
    }
    
    /**
     * Get text documents from workspace (delegates to service)
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    getTextDocuments() {
        try {
            return this.awarenessService.getTextDocuments();
        } catch (error) {
            this.logger?.error('AwarenessController.getTextDocuments failed', error);
            return [];
        }
    }
    
    /**
     * Log message (uses controller logger)
     * @param {string} message - Message to log
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    log(message, sourceKey = null) {
        if (this.logger) {
            this.logger.info(message);
        }
    }
    
    /**
     * Log error (uses controller logger)
     * @param {string} message - Error message
     * @param {Error} error - Error object (optional)
     */
    logError(message, error = null) {
        if (this.logger) {
            this.logger.error(message, error);
        }
    }
}

module.exports = AwarenessController;
