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
        
        // Keep startup quiet by default; enable `vibeswitch.debugLogging` for verbose output.
        this.debug('[FileDecorations] Provider instance created');
    }

    /**
     * Update the awareness engine reference (called when engine starts)
     * @param {Object} awarenessEngine - The awareness engine instance
     */
    // @ai - Added automatic refresh with delay to ensure engine is ready
    setAwarenessEngine(awarenessEngine) {
        this.awarenessEngine = awarenessEngine;
        this.log('[FileDecorations] Awareness engine reference updated', true);
        // @ai - Trigger refresh after engine is set to ensure decorations update
        // Use a small delay to ensure engine is fully initialized and has data
        setTimeout(() => {
            this.log('[FileDecorations] Triggering refresh after engine update', true);
            this.refresh();
        }, 500);
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
            // Only decorate in DEV mode
            const currentMode = this.getCurrentMode ? this.getCurrentMode() : null;
            if (currentMode !== 'dev') {
                this.logger?.debug(`Skipping decoration for ${fileName} (mode=${currentMode}, not dev)`, false, `fileDecorations:skip:${fileName}`);
                return undefined; // VS Code expects undefined for no decoration
            }

            if (!this.awarenessEngine) {
                this.logger?.debug(`No awareness engine available for ${fileName}`, false, `fileDecorations:noEngine:${fileName}`);
                return undefined; // VS Code expects undefined for no decoration
            }

            // Get current score data
            const scoreData = this.awarenessEngine.getScore();
            if (!scoreData) {
                this.logger?.debug(`No score data available for ${fileName}`, false, `fileDecorations:noScore:${fileName}`);
                return undefined; // VS Code expects undefined for no decoration
            }

            const filePath = uri.fsPath;
            const normalizedPath = this.normalizePath(filePath);
            
            // Check if we have debt files (for conditional logging)
            const hasDebtFiles = scoreData.debt && scoreData.debt.files && scoreData.debt.files.length > 0;
            
            // @ai - Enhanced debug logging when we have debt files
            if (hasDebtFiles && this.logger) {
                const debugKey = `fileDecorations:debug:${fileName}`;
                this.logger.debug(
                    `[FileDecorations] Checking ${fileName} (normalized: "${normalizedPath}") against ${scoreData.debt.files.length} debt files`,
                    false,
                    debugKey
                );
            }

            // Check if file is in review debt
            if (scoreData.debt && scoreData.debt.files) {
                for (const debtFile of scoreData.debt.files) {
                    const normalizedDebtPath = this.normalizePath(debtFile.fullPath);
                    const matches = normalizedPath === normalizedDebtPath;
                    
                    // Enhanced debug logging for path matching
                    if (this.logger) {
                        const checkKey = `fileDecorations:checkDebt:${fileName}`;
                        this.logger.debug(
                            `[FileDecorations] Debt check: "${normalizedPath}" vs "${normalizedDebtPath}" (raw: "${debtFile.fullPath}") -> ${matches}`,
                            false,
                            checkKey
                        );
                    }
                    
                    if (matches) {
                        this.log(`[FileDecorations] ✅ MATCH! Returning debt decoration for ${fileName}`, true);
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
                    
                    // Enhanced debug logging for path matching
                    if (this.logger) {
                        const checkKey = `fileDecorations:checkPending:${fileName}`;
                        this.logger.debug(
                            `[FileDecorations] Pending check: "${normalizedPath}" vs "${normalizedPendingPath}" (raw: "${pendingFile.fullPath}") -> ${matches}`,
                            false,
                            checkKey
                        );
                    }
                    
                    if (matches) {
                        const isNewFile = pendingFile.type === 'file creation' || pendingFile.type === 'external file';
                        const colorType = isNewFile ? 'BLUE/PURPLE' : 'ORANGE/YELLOW';
                        this.log(`[FileDecorations] ✅ MATCH! Returning pending decoration for ${fileName} (${colorType})`, true);
                        
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
            if (hasDebtFiles) {
                const noDecoKey = `fileDecorations:noDecoration:${fileName}`;
                this.logger?.debug(`No decoration for ${fileName} (checked ${scoreData.debt.files.length} debt files, ${scoreData.suggestions?.pendingFiles?.length || 0} pending files)`, false, noDecoKey);
            }
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
     */
    // @ai - Improved refresh mechanism with better logging
    refresh(uri = null) {
        this.log(`[FileDecorations] Refreshing file decorations${uri ? ` for ${uri.fsPath}` : ' (all files)'}...`, true);
        try {
            // Fire the event to notify VS Code to refresh decorations
            // If URI is provided, refresh only that file; otherwise refresh all
            if (uri) {
                this._onDidChangeFileDecorations.fire(uri);
                this.log(`[FileDecorations] Refresh event fired for specific file: ${uri.fsPath}`, true);
            } else {
                // To refresh all files, fire with undefined (VS Code API supports this)
                // This tells VS Code to re-query decorations for all visible files
                this._onDidChangeFileDecorations.fire(undefined);
                this.log('[FileDecorations] Refresh event fired for all files (undefined)', true);
                
                // Also try firing with workspace folder URIs as a backup
                try {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders && workspaceFolders.length > 0) {
                        // Fire for each workspace folder root to trigger refresh
                        const uris = workspaceFolders.map(folder => folder.uri);
                        this._onDidChangeFileDecorations.fire(uris);
                        this.log(`[FileDecorations] Also fired refresh for ${uris.length} workspace folders`, true);
                    }
                } catch (workspaceError) {
                    // Ignore workspace errors, we already fired with undefined
                }
            }
        } catch (error) {
            this.log(`[FileDecorations] ❌ Error refreshing: ${error.message}`, true);
            this.log(`[FileDecorations] Stack: ${error.stack}`, true);
        }
    }

    /**
     * Disposes of resources
     */
    dispose() {
        this.debug('[FileDecorations] Disposing file decoration provider', 'fileDecorations:dispose');
        this._onDidChangeFileDecorations.dispose();
    }
}

module.exports = UnreviewedFileDecor;

