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
        
        // Only log important initialization messages
        this.log('[FileDecorations] Provider instance created', true);
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
     * Registers this provider with VS Code
     */
    register(context) {
        this.log('[FileDecorations] Registering file decoration provider...');
        
        try {
            const provider = vscode.window.registerFileDecorationProvider(this);
            context.subscriptions.push(provider);
            this.log('[FileDecorations] ✅ File decoration provider registered successfully');
            return provider;
        } catch (error) {
            this.log(`[FileDecorations] ❌ ERROR registering provider: ${error.message}`, true);
            this.log(`[FileDecorations] Stack: ${error.stack}`, true);
            return null;
        }
    }

    /**
     * Normalizes a file path for consistent comparison
     */
    normalizePath(filePath) {
        if (!filePath) return '';
        try {
            // Resolve to absolute path and normalize separators
            const normalized = require('path').resolve(filePath).replace(/\\/g, '/').toLowerCase();
            return normalized;
        } catch (error) {
            // Fallback to simple normalization
            return filePath.replace(/\\/g, '/').toLowerCase();
        }
    }

    /**
     * Provides file decoration for a given URI
     * Called by VS Code for each file in the Explorer
     */
    provideFileDecoration(uri, token) {
        this.debugCallCount++;
        const fileName = require('path').basename(uri.fsPath);
        
        // Rate-limited logging via logger's built-in rate limiter
        const logKey = `fileDecorations:provideFileDecoration:${fileName}`;
        this.logger?.log(`[FileDecorations] provideFileDecoration called ${this.debugCallCount} times`, false, false, logKey);

        try {
            // Only decorate in DEV mode
            const currentMode = this.getCurrentMode ? this.getCurrentMode() : null;
            if (currentMode !== 'dev') {
                this.logger?.debug(`Skipping decoration for ${fileName} (mode=${currentMode}, not dev)`, false, `fileDecorations:skip:${fileName}`);
                return null;
            }

            if (!this.awarenessEngine) {
                this.logger?.debug(`No awareness engine available for ${fileName}`, false, `fileDecorations:noEngine:${fileName}`);
                return null;
            }

            // Get current score data
            const scoreData = this.awarenessEngine.getScore();
            if (!scoreData) {
                this.logger?.debug(`No score data available for ${fileName}`, false, `fileDecorations:noScore:${fileName}`);
                return null;
            }

            const filePath = uri.fsPath;
            const normalizedPath = this.normalizePath(filePath);
            
            // Check if we have debt files (for conditional logging)
            const hasDebtFiles = scoreData.debt && scoreData.debt.files && scoreData.debt.files.length > 0;

            // Check if file is in review debt
            if (scoreData.debt && scoreData.debt.files) {
                for (const debtFile of scoreData.debt.files) {
                    const normalizedDebtPath = this.normalizePath(debtFile.fullPath);
                    const matches = normalizedPath === normalizedDebtPath;
                    
                    // Rate-limited debug logging
                    const checkKey = `fileDecorations:checkDebt:${fileName}`;
                    this.logger?.debug(`Checking debt for ${fileName}: "${normalizedPath}" vs "${normalizedDebtPath}" -> ${matches}`, false, checkKey);
                    
                    if (matches) {
                        this.log(`[FileDecorations] ✅ RETURNING VIOLET DECORATION for ${fileName} (${debtFile.modifications} modifications, ${debtFile.ageMinutes}m ago)`);
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
                    
                    // Rate-limited debug logging
                    const checkKey = `fileDecorations:checkPending:${fileName}`;
                    this.logger?.debug(`Checking pending for ${fileName}: "${normalizedPath}" vs "${normalizedPendingPath}" -> ${matches}`, false, checkKey);
                    
                    if (matches) {
                        const isNewFile = pendingFile.type === 'file creation' || pendingFile.type === 'external file';
                        const colorType = isNewFile ? 'BLUE/PURPLE' : 'ORANGE/YELLOW';
                        this.log(`[FileDecorations] ✅ RETURNING ${colorType} DECORATION for ${fileName} (${pendingFile.type}, ${pendingFile.ageMinutes}m ago)`);
                        
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
            return null;

        } catch (error) {
            this.log(`[FileDecorations] ❌ ERROR in provideFileDecoration: ${error.message}`, true);
            this.log(`[FileDecorations] Stack: ${error.stack}`, true);
            return null;
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
    refresh(uri = null) {
        this.log(`[FileDecorations] 🔄 Refreshing file decorations${uri ? ` for ${uri.fsPath}` : ' (all files)'}...`);
        try {
            // Fire the event to notify VS Code to refresh decorations
            // If URI is provided, refresh only that file; otherwise refresh all
            if (uri) {
                this._onDidChangeFileDecorations.fire(uri);
                this.log(`[FileDecorations] ✅ Refresh event fired for specific file: ${uri.fsPath}`);
            } else {
                // Fire with undefined to refresh all files
                this._onDidChangeFileDecorations.fire(undefined);
                this.log('[FileDecorations] ✅ Refresh event fired for all files');
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
        this.log('[FileDecorations] Disposing file decoration provider');
        this._onDidChangeFileDecorations.dispose();
    }
}

module.exports = UnreviewedFileDecor;

