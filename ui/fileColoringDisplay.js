/**
 * File Colors in Explorer Provider for VibeSwitch
 * 
 * Provides visual indicators in the VS Code Explorer for unreviewed AI changes:
 * - Review debt files: Violet/purple with ⚠ badge
 * - Pending new files: Blue/purple with ⏳ badge  
 * - Pending changes: Orange/yellow with ⏳ badge
 */

const vscode = require('vscode');
const { getLogger } = require('../logger');

class UnreviewedFileDecor {
    constructor(awarenessEngine, getCurrentMode, logOutput, disableLogging = false) {
        this.awarenessEngine = awarenessEngine;
        this.getCurrentMode = getCurrentMode;
        this.logOutput = logOutput;
        this.disableLogging = disableLogging;
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.debugCallCount = 0;
        this.logger = getLogger();
        
        // Debounce refresh to prevent loops (max 1 refresh per 200ms)
        this.refreshTimer = null;
        this.lastRefreshTime = 0;
        this.REFRESH_DEBOUNCE_MS = 200;
        
        // Keep startup quiet by default; enable `vibeswitch.debugLogging` for verbose output.
        // Silent initialization for performance
    }

    /**
     * Update the awareness engine reference (called when engine starts)
     * @param {Object} awarenessEngine - The awareness engine instance
     */
    setAwarenessEngine(awarenessEngine) {
        this.awarenessEngine = awarenessEngine;
        // Silent update - trigger refresh after engine is set (debounced to prevent loops)
        this.refresh();
    }

    /**
     * Logs a message using throttled logger
     */
    log(message, force = false) {
        if (this.disableLogging && !force) return; // Exit early if logging disabled
        if (this.logger) {
            this.logger.log(message, force);
        } else {
            // Fallback if logger not initialized
            console.log(message);
            if (this.logOutput) {
                this.logOutput.appendLine(message);
            }
        }
    }

    /**
     * Debug log (only visible when debug logging is enabled).
     */
    debug(message, sourceKey = null) {
        if (this.disableLogging) return;
        if (this.logger && typeof this.logger.debug === 'function') {
            this.logger.debug(message, false, sourceKey);
        }
    }

    /**
     * Registers this provider with VS Code
     */
    register(context) {
        this.debug('[FileDecorations] Registering file decoration provider...');
        
        try {
            const provider = vscode.window.registerFileDecorationProvider(this);
            context.subscriptions.push(provider);
            this.debug('[FileDecorations] ✅ File decoration provider registered successfully');
            return provider;
        } catch (error) {
            this.log(`[FileDecorations] ❌ ERROR registering provider: ${error.message}`, true);
            this.log(`[FileDecorations] Stack: ${error.stack}`, true);
            return null;
        }
    }

    /**
     * Normalizes a file path or URI for consistent comparison
     * Handles both absolute and relative paths, URI strings, and normalizes separators
     */
    // @ai - Enhanced to handle URI strings (file:///path/to/file) for proper path matching
    normalizePath(filePathOrUri) {
        if (!filePathOrUri) return '';
        try {
            const path = require('path');
            let filePath = filePathOrUri;
            
            // If it's a URI string (e.g., "file:///path/to/file"), extract the path
            if (typeof filePathOrUri === 'string' && filePathOrUri.includes('://')) {
                try {
                    const uri = vscode.Uri.parse(filePathOrUri);
                    if (uri.scheme === 'file') {
                        filePath = uri.fsPath;
                    } else {
                        // Not a file URI, try to extract pathname
                        const url = new URL(filePathOrUri);
                        filePath = url.pathname;
                    }
                } catch (e) {
                    // If URI parsing fails, try to extract path manually
                    const match = filePathOrUri.match(/file:\/\/\/?(.+)/);
                    if (match) {
                        filePath = match[1];
                    }
                }
            }
            
            // If path is already absolute, use it directly; otherwise resolve it
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.resolve(filePath);
            // Normalize separators and convert to lowercase for comparison
            const normalized = absolutePath.replace(/\\/g, '/').toLowerCase();
            return normalized;
        } catch (error) {
            // Fallback to simple normalization
            return String(filePathOrUri).replace(/\\/g, '/').toLowerCase();
        }
    }

    /**
     * Provides file decoration for a given URI
     * Called by VS Code for each file in the Explorer
     */
    // @ai - Enhanced with better logging and path matching
    provideFileDecoration(uri, token) {
        this.debugCallCount++;
        const fileName = require('path').basename(uri.fsPath);
        
        // @ai - Log first few calls to verify provider is being invoked
        if (this.debugCallCount <= 5) {
            this.log(`[FileDecorations] provideFileDecoration called ${this.debugCallCount} times for: ${fileName}`, true);
        }
        
        // Rate-limited debug logging via logger's built-in rate limiter
        const logKey = `fileDecorations:provideFileDecoration:${fileName}`;
        this.debug(`[FileDecorations] provideFileDecoration called ${this.debugCallCount} times`, logKey);

        try {
            // Mode switching removed: no mode check
            if (!this.awarenessEngine) {
                return undefined; // VS Code expects undefined for no decoration
            }

            // Get current score data
            const scoreData = this.awarenessEngine.getScore();
            if (!scoreData) {
                return undefined; // VS Code expects undefined for no decoration
            }

            const filePath = uri.fsPath;
            const normalizedPath = this.normalizePath(filePath);

            // Check if file is in review debt (use allFiles so every unreviewed file gets decorated, not just top 10)
            const debtFilesForDecor = (scoreData.debt && scoreData.debt.allFiles) || (scoreData.debt && scoreData.debt.files) || [];
            if (debtFilesForDecor.length > 0) {
                for (const debtFile of debtFilesForDecor) {
                    const normalizedDebtPath = this.normalizePath(debtFile.fullPath);
                    const matches = normalizedPath === normalizedDebtPath;
                    
                    if (matches) {
                        return {
                            badge: '⚠',
                            tooltip: `Unreviewed AI changes: ${debtFile.modifications} modifications, ${debtFile.ageMinutes}m ago`,
                            color: new vscode.ThemeColor('textLink.activeForeground') // Violet/purple
                        };
                    }
                }
            }

            // Check if file is in pending suggestions
            if (scoreData.suggestions && scoreData.suggestions.pendingFiles) {
                for (const pendingFile of scoreData.suggestions.pendingFiles) {
                    const normalizedPendingPath = this.normalizePath(pendingFile.fullPath);
                    const matches = normalizedPath === normalizedPendingPath;
                    
                    if (matches) {
                        const isNewFile = pendingFile.type === 'file creation' || pendingFile.type === 'external file';
                        
                        // Different colors for different types
                        return {
                            badge: '⏳',
                            tooltip: `Pending review: ${pendingFile.type}, ${pendingFile.ageMinutes}m ago`,
                            color: isNewFile 
                                ? new vscode.ThemeColor('textLink.foreground') // Blue/purple for new files
                                : new vscode.ThemeColor('warningForeground') // Orange/yellow for changes
                        };
                    }
                }
            }

            // Rate-limited debug logging when we have debt files
            // Silent return - no decoration needed
            return undefined; // VS Code expects undefined for no decoration

        } catch (error) {
            this.log(`[FileDecorations] ❌ ERROR in provideFileDecoration: ${error.message}`, true);
            this.log(`[FileDecorations] Stack: ${error.stack}`, true);
            return undefined; // Return undefined on error to avoid breaking VS Code
        }
    }

    /**
     * Event emitter for decoration changes
     */
    get onDidChangeFileDecorations() {
        return this._onDidChangeFileDecorations.event;
    }

    /**
     * Triggers a refresh of all file decorations
     * Can optionally refresh a specific URI
     * Debounced to prevent refresh loops
     */
    refresh(uri = null) {
        const now = Date.now();
        
        // Debounce: skip if called too recently
        if (now - this.lastRefreshTime < this.REFRESH_DEBOUNCE_MS) {
            // Clear existing timer and set a new one (debounce pattern)
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer);
            }
            this.refreshTimer = setTimeout(() => {
                this._doRefresh(uri);
            }, this.REFRESH_DEBOUNCE_MS);
            return;
        }
        
        // Clear any pending timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        this._doRefresh(uri);
    }
    
    /**
     * Internal method to actually perform the refresh
     * @private
     */
    _doRefresh(uri = null) {
        this.lastRefreshTime = Date.now();
        // Silent refresh - this is called frequently, don't log
        
        try {
            // Fire the event to notify VS Code to refresh decorations
            // If URI is provided, refresh only that file; otherwise refresh all
            if (uri) {
                this._onDidChangeFileDecorations.fire(uri);
            } else {
                // Fire with undefined to refresh all files (VS Code API)
                this._onDidChangeFileDecorations.fire(undefined);
            }
        } catch (error) {
            this.log(`[FileDecorations] ❌ Error refreshing: ${error.message}`, true);
        }
    }

    /**
     * Disposes of resources
     */
    dispose() {
        // Silent disposal for performance
        
        // Clear any pending refresh timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        this._onDidChangeFileDecorations.dispose();
    }
}

module.exports = UnreviewedFileDecor;

