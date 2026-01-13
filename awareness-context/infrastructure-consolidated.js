/**
 * INFRASTRUCTURE LAYER - CONSOLIDATED
 * 
 * This file contains all code from the infrastructure layer of the awareness module.
 * Generated automatically for ChatGPT context.
 * 
 * Files included: 7
 * Generated: 2026-01-13T15:56:48.098Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 1/7: infrastructure/adapters/awarenessEventEmitterMessagingAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessEventEmitterMessagingAdapter.js
/**
 * AwarenessEventEmitterMessagingAdapter - Messaging adapter using Node.js EventEmitter
 * 
 * This adapter publishes domain events using an EventEmitter pattern.
 * For VS Code extensions, this is a simple in-process messaging solution.
 * Can be replaced with Pub/Sub or other messaging systems if needed.
 */

// const EventEmitter = require('events'); // Commented for consolidation
// const IAwarenessMessagingPort = require('../../domain/ports/IAwarenessMessagingPort'); // Commented for consolidation
// const { getLogger } = require('../../../../logger'); // Commented for consolidation

class AwarenessEventEmitterMessagingAdapter extends IAwarenessMessagingPort {
    constructor(eventEmitter = null) {
        super();
        // Use provided event emitter or create a new one
        this.eventEmitter = eventEmitter || new EventEmitter();
        this.logger = getLogger();
    }

    /**
     * Get the underlying event emitter (for subscribing to events)
     * @returns {EventEmitter} The event emitter instance
     */
    getEventEmitter() {
        return this.eventEmitter;
    }

    async publishAISuggestionEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('aiSuggestion', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published AISuggestionEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing AISuggestionEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishAISuggestionOutcomeEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('aiSuggestionOutcome', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published AISuggestionOutcomeEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing AISuggestionOutcomeEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishScoreUpdateEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('scoreUpdate', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published ScoreUpdateEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing ScoreUpdateEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishKeepAllEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('keepAll', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published KeepAllEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing KeepAllEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishDebtClearedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('debtCleared', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published DebtClearedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing DebtClearedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishReviewSessionStartedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('reviewSessionStarted', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published ReviewSessionStartedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing ReviewSessionStartedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishReviewSessionCompletedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('reviewSessionCompleted', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published ReviewSessionCompletedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing ReviewSessionCompletedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishSuggestionBatchCreatedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('suggestionBatchCreated', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published SuggestionBatchCreatedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing SuggestionBatchCreatedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    _generateCorrelationId() {
        return `awareness-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}

// module.exports = AwarenessEventEmitterMessagingAdapter; // Commented for consolidation


})(); // End IIFE for infrastructure/adapters/awarenessEventEmitterMessagingAdapter.js


// ============================================================================
// FILE 2/7: infrastructure/adapters/awarenessFileSystemAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessFileSystemAdapter.js
/**
 * AwarenessFileSystemAdapter - Adapter implementing IFileSystemPort
 * 
 * Wraps Node.js fs module to provide filesystem operations to domain entities.
 */

// const IFileSystemPort = require('../../domain/ports/IFileSystemPort'); // Commented for consolidation
// const fs = require('fs'); // Commented for consolidation

class AwarenessFileSystemAdapter extends IFileSystemPort {
    constructor() {
        super();
    }

    /**
     * Watch a directory for changes
     * @param {string} path - Path to watch
     * @param {Object} options - Watch options (recursive, etc.)
     * @param {Function} callback - Callback function (eventType, filename)
     * @returns {Object} Watcher object with close() method
     */
    watch(path, options, callback) {
        return fs.watch(path, options, callback);
    }

    /**
     * Get file stats asynchronously
     * @param {string} path - File path
     * @param {Function} callback - Callback function (err, stats)
     */
    stat(path, callback) {
        fs.stat(path, callback);
    }

    /**
     * Read directory contents synchronously
     * @param {string} path - Directory path
     * @param {Object} options - Options (withFileTypes, etc.)
     * @returns {Array} Array of directory entries
     */
    readdirSync(path, options) {
        return fs.readdirSync(path, options);
    }

    /**
     * Read file contents synchronously
     * @param {string} path - File path
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {string|Buffer} File contents
     */
    readFileSync(path, encoding = 'utf8') {
        return fs.readFileSync(path, encoding);
    }
}

// module.exports = AwarenessFileSystemAdapter; // Commented for consolidation

})(); // End IIFE for infrastructure/adapters/awarenessFileSystemAdapter.js


// ============================================================================
// FILE 3/7: infrastructure/adapters/awarenessHashGeneratorAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessHashGeneratorAdapter.js
/**
 * AwarenessHashGeneratorAdapter - Adapter implementing IHashGeneratorPort
 * 
 * Provides hashing functionality using crypto module.
 */

// const IHashGeneratorPort = require('../../domain/ports/IHashGeneratorPort'); // Commented for consolidation
// const crypto = require('crypto'); // Commented for consolidation

class AwarenessHashGeneratorAdapter extends IHashGeneratorPort {
    constructor() {
        super();
    }

    /**
     * Create a hash from data
     * @param {string} algorithm - Hash algorithm (e.g., 'md5', 'sha256')
     * @param {string|Buffer} data - Data to hash
     * @returns {string} Hash string (hex)
     */
    createHash(algorithm, data) {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }
}

// module.exports = AwarenessHashGeneratorAdapter; // Commented for consolidation

})(); // End IIFE for infrastructure/adapters/awarenessHashGeneratorAdapter.js


// ============================================================================
// FILE 4/7: infrastructure/adapters/awarenessIdGeneratorAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessIdGeneratorAdapter.js
/**
 * AwarenessIdGeneratorAdapter - Adapter implementing IIdGeneratorPort
 * 
 * Provides ID generation functionality using crypto module.
 */

// const IIdGeneratorPort = require('../../domain/ports/IIdGeneratorPort'); // Commented for consolidation
// const crypto = require('crypto'); // Commented for consolidation

class AwarenessIdGeneratorAdapter extends IIdGeneratorPort {
    constructor() {
        super();
        this._idSeq = 0; // Monotonic counter for fallback IDs
    }

    /**
     * Generate a UUID
     * @returns {string} UUID string
     */
    generateUUID() {
        try {
            if (crypto.randomUUID) {
                return crypto.randomUUID();
            } else {
                // Fallback if randomUUID not available
                return this.generateId();
            }
        } catch (e) {
            return this.generateId();
        }
    }

    /**
     * Generate a unique ID (fallback if UUID not available)
     * @returns {string} Unique ID string
     */
    generateId() {
        this._idSeq = (this._idSeq || 0) + 1;
        return `${Date.now()}-${this._idSeq}`;
    }
}

// module.exports = AwarenessIdGeneratorAdapter; // Commented for consolidation

})(); // End IIFE for infrastructure/adapters/awarenessIdGeneratorAdapter.js


// ============================================================================
// FILE 5/7: infrastructure/adapters/awarenessLoggerAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessLoggerAdapter.js
/**
 * AwarenessLoggerAdapter - Adapter implementing ILoggerPort
 * 
 * Wraps the logger module to provide logging functionality to domain entities.
 */

// const ILoggerPort = require('../../domain/ports/ILoggerPort'); // Commented for consolidation
// const { getLogger } = require('../../../../logger'); // Commented for consolidation

class AwarenessLoggerAdapter extends ILoggerPort {
    constructor() {
        super();
        this.logger = getLogger();
    }

    /**
     * Log a message
     * @param {string} message - The message to log
     * @param {boolean} force - Force log even if throttled
     * @param {boolean} show - Show output channel
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    log(message, force = false, show = false, sourceKey = null) {
        if (this.logger) {
            this.logger.log(message, force, show, sourceKey);
        }
    }

    /**
     * Log a debug message
     * @param {string} message - The debug message to log
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    debug(message, sourceKey = null) {
        if (this.logger) {
            // Use log with debug marker
            this.logger.log(`[DEBUG] ${message}`, false, false, sourceKey);
        }
    }

    /**
     * Log an error message
     * @param {string} message - The error message to log
     * @param {Error} error - Optional error object
     */
    error(message, error = null) {
        if (this.logger) {
            const errorMessage = error ? `${message}: ${error.message || error}` : message;
            this.logger.log(errorMessage, true, false); // force=true, show=false
        }
    }
}

// module.exports = AwarenessLoggerAdapter; // Commented for consolidation

})(); // End IIFE for infrastructure/adapters/awarenessLoggerAdapter.js


// ============================================================================
// FILE 6/7: infrastructure/adapters/awarenessVSCodeAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessVSCodeAdapter.js
/**
 * AwarenessVSCodeAdapter - Awareness module-specific adapter implementing IAwarenessVSCodePort
 * 
 * This adapter implements ONLY the VS Code operations required by the awareness module.
 * It is module-specific and does not include general-purpose VS Code methods.
 * 
 * This enables:
 * - Testability without VS Code extension host
 * - Clear separation of concerns
 * - Module-specific contracts (not general-purpose adapters)
 */

// const IAwarenessVSCodePort = require('../../domain/ports/IAwarenessVSCodePort'); // Commented for consolidation

class AwarenessVSCodeAdapter extends IAwarenessVSCodePort {
    /**
     * @param {Object} vscode - VS Code API module (require('vscode'))
     */
    constructor(vscode) {
        super();
        this.vscode = vscode;
    }

    // ============================================================================
    // Document Event Handlers
    // ============================================================================
    
    onDidChangeTextDocument(handler) {
        return this.vscode.workspace.onDidChangeTextDocument(handler);
    }

    onDidCreateFiles(handler) {
        return this.vscode.workspace.onDidCreateFiles(handler);
    }

    onDidSaveTextDocument(handler) {
        return this.vscode.workspace.onDidSaveTextDocument(handler);
    }

    onDidOpenTextDocument(handler) {
        return this.vscode.workspace.onDidOpenTextDocument(handler);
    }

    onDidCloseTextDocument(handler) {
        return this.vscode.workspace.onDidCloseTextDocument(handler);
    }

    // ============================================================================
    // Editor Event Handlers
    // ============================================================================
    
    onDidChangeTextEditorSelection(handler) {
        return this.vscode.window.onDidChangeTextEditorSelection(handler);
    }

    onDidChangeTextEditorVisibleRanges(handler) {
        return this.vscode.window.onDidChangeTextEditorVisibleRanges(handler);
    }

    onDidChangeActiveTextEditor(handler) {
        return this.vscode.window.onDidChangeActiveTextEditor(handler);
    }

    // ============================================================================
    // Workspace Operations
    // ============================================================================
    
    asRelativePath(uri) {
        return this.vscode.workspace.asRelativePath(uri);
    }

    get workspaceFolders() {
        return this.vscode.workspace.workspaceFolders;
    }

    get textDocuments() {
        return this.vscode.workspace.textDocuments;
    }

    openTextDocument(uri) {
        return this.vscode.workspace.openTextDocument(uri);
    }

    // ============================================================================
    // VS Code Types (for construction)
    // ============================================================================
    
    get Range() {
        return this.vscode.Range;
    }

    get Position() {
        return this.vscode.Position;
    }

    get Uri() {
        return this.vscode.Uri;
    }
}

// module.exports = AwarenessVSCodeAdapter; // Commented for consolidation

})(); // End IIFE for infrastructure/adapters/awarenessVSCodeAdapter.js


// ============================================================================
// FILE 7/7: infrastructure/adapters/awarenessWorkspaceStateAdapter.js
// ============================================================================

(function() { // IIFE scope for infrastructure/adapters/awarenessWorkspaceStateAdapter.js
/**
 * AwarenessWorkspaceStateAdapter - Adapter implementing IAwarenessPersistencePort
 * 
 * Wraps VS Code workspaceState API to implement the IAwarenessPersistencePort interface.
 * This enables testability and the ability to swap storage implementations.
 */

// const IAwarenessPersistencePort = require('../../domain/ports/IAwarenessPersistencePort'); // Commented for consolidation

class AwarenessWorkspaceStateAdapter extends IAwarenessPersistencePort {
    /**
     * @param {Object} context - VS Code ExtensionContext with workspaceState
     */
    constructor(context) {
        super();
        if (!context || !context.workspaceState) {
            throw new Error('WorkspaceStateAdapter requires context with workspaceState');
        }
        this.context = context;
        this.workspaceState = context.workspaceState;
    }

    async save(key, value) {
        await this.workspaceState.update(key, value);
    }

    async load(key) {
        return this.workspaceState.get(key);
    }

    async delete(key) {
        await this.workspaceState.update(key, undefined);
    }

    saveSync(key, value) {
        // workspaceState.update is async, but we provide sync wrapper for compatibility
        // Note: This will still be async under the hood, but matches the interface
        this.workspaceState.update(key, value);
    }

    loadSync(key) {
        return this.workspaceState.get(key);
    }
}

// module.exports = AwarenessWorkspaceStateAdapter; // Commented for consolidation




})(); // End IIFE for infrastructure/adapters/awarenessWorkspaceStateAdapter.js

