/**
 * APP LAYER - CONSOLIDATED (PART 2/3)
 * 
 * This file contains part 2 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 5/14
 * Generated: 2026-01-14T18:13:49.751Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 5/14: app/debtService.js
// ============================================================================

(function() { // IIFE scope for app/debtService.js
/**
 * DebtService - Application service for managing review debt
 * 
 * Orchestrates debt management: persistence, callbacks, and aggregate calculations.
 * This is an application service that coordinates Debt domain entities.
 */

// const FileDebt = require('../domain/entities/fileDebt'); // Commented for consolidation
// const { normalizeToUri } = require('./vscodeDocUtilities'); // Commented for consolidation

class DebtService {
    /**
     * @param {Function} onScoreUpdate - Callback for score updates
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onScoreUpdate, updateFileColorsInExplorer = null, persistencePort, loggerPort = null) {
        if (!persistencePort) {
            throw new Error('DebtService requires persistencePort');
        }
        
        this.onScoreUpdate = onScoreUpdate;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.persistencePort = persistencePort;
        this.loggerPort = loggerPort;
        this.fileDebts = new Map(); // URI string -> FileDebt entity (file-level debt only)
        // Note: Suggestion-level debt is tracked via Suggestion entities (status === 'pending')
    }

    /**
     * Load debt from workspace storage
     */
    loadDebt() {
        if (!this.persistencePort) return;
        
        try {
            const stored = this.persistencePort.loadSync('debt');
            // Convert object to Map of Debt entities
            let debtData;
            if (stored instanceof Map) {
                debtData = stored;
            } else if (stored && typeof stored === 'object') {
                debtData = new Map(Object.entries(stored));
            } else {
                debtData = new Map();
            }
            
            // Convert plain objects to FileDebt entities
            this.fileDebts = new Map();
            for (const [uri, data] of debtData.entries()) {
                if (data instanceof FileDebt) {
                    this.fileDebts.set(uri, data);
                } else {
                    // Convert plain object to FileDebt entity
                    // Handle legacy "Debt" format for backward compatibility
                    this.fileDebts.set(uri, FileDebt.fromJSON(uri, data));
                }
            }
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: Loaded ${this.fileDebts.size} files with file-level debt`);
            }
            
            // Clean up old file debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [uri, fileDebt] of this.fileDebts.entries()) {
                if (fileDebt.modifiedAt < sevenDaysAgo) {
                    this.fileDebts.delete(uri);
                    if (this.loggerPort) {
                        this.loggerPort.log(`AwarenessMonitor: Removed stale file debt for ${uri}`);
                    }
                }
            }
            
            // Save cleaned up data (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after cleanup', err);
                }
            });
        } catch (error) {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error loading debt', error);
            }
            this.debts = new Map();
        }
    }

    /**
     * Save debt to workspace storage (async)
     * @returns {Promise<void>}
     */
    async saveDebt() {
        if (!this.persistencePort) return;
        
        // Convert Map of FileDebt entities to plain objects for storage
        const debtObject = {};
        for (const [uri, fileDebt] of this.fileDebts.entries()) {
            debtObject[uri] = fileDebt.toJSON();
        }
        await this.persistencePort.save('debt', debtObject);
    }

    /**
     * Add file-level debt (for file changes, not suggestions)
     * Note: Suggestion-level debt is tracked separately via Suggestion entities.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePathOrUri, changeSize, updateScore) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        let fileDebt = this.fileDebts.get(uri);
        if (!fileDebt) {
            // Create new FileDebt entity (file-level debt only)
            fileDebt = new FileDebt(uri);
            this.fileDebts.set(uri, fileDebt);
        }
        
        // Use domain entity method
        fileDebt.addChange(changeSize);
        
        // Save debt (fire-and-forget in sync context)
        this.saveDebt().catch(err => {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error saving debt after add', err);
            }
        });
        
        // Update file colors immediately when debt changes
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
        
        // Trigger immediate score update
        if (updateScore) {
            updateScore();
        }
    }

    /**
     * Get file-level debt entry for a file
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {FileDebt|null} FileDebt entity or null
     */
    getDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.fileDebts.get(uri) || null;
    }

    /**
     * Mark file-level debt as reviewed
     * Note: This only marks FILE-LEVEL debt. Pending suggestions are tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePathOrUri, reviewTime) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const fileDebt = this.fileDebts.get(uri);
        if (fileDebt) {
            // Use domain entity method (file-level debt only)
            fileDebt.markAsReviewed(reviewTime);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after markAsReviewed', err);
                }
            });
            
            // Update file colors immediately when debt is cleared
            if (this.updateFileColorsInExplorer) {
                this.updateFileColorsInExplorer();
            }
        }
    }

    /**
     * Update file-level debt with session info
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const fileDebt = this.fileDebts.get(uri);
        if (fileDebt) {
            // Use domain entity method
            fileDebt.updateSession(sessionData);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after updateSession', err);
                }
            });
        }
    }

    /**
     * Calculate debt score (0-30) - combines file-level and suggestion-level debt
     * High score = lots of unreviewed files + pending suggestions (BAD in DEV mode)
     * 
     * This properly separates:
     * - FileDebt: Unreviewed changes in files (file-level)
     * - SuggestionDebt: Pending AI suggestions (suggestion-level, tracked via Suggestion entities)
     * 
     * @param {Array} aiSuggestions - Array of AI suggestions (for suggestion-level debt)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        // File-level debt: unreviewed file changes
        const unreviewedFiles = Array.from(this.fileDebts.values())
            .filter(d => !d.isReviewed());
        
        // Suggestion-level debt: pending AI suggestions (tracked separately)
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s && s.status === 'pending') : [];
        
        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pendingSuggestions.length === 0) {
            return 0;
        }
        
        const now = Date.now();
        
        // Calculate debt severity (combines both types)
        let debtScore = 0;
        
        // 1. Number of unreviewed files (file-level debt) (0-10 points)
        debtScore += Math.min(unreviewedFiles.length * 2, 10);
        
        // 2. Number of pending suggestions (suggestion-level debt) (0-10 points)
        // Each pending suggestion is unreviewed AI-generated code that needs attention
        debtScore += Math.min(pendingSuggestions.length * 2, 10);
        
        // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
        const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
        const suggestionDebtTimestamps = pendingSuggestions.map(s => s.timestamp || now);
        const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];
        
        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
            debtScore += Math.min(ageHours * 1.5, 10);
        }
        
        return Math.round(Math.min(debtScore, 30));
    }
    

    /**
     * Get file-level debt summary for UI
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getDebtSummary() {
        const unreviewedFiles = Array.from(this.fileDebts.entries())
            .filter(([_, fileDebt]) => !fileDebt.isReviewed())
            .map(([path, fileDebt]) => ({
                path: path,
                modifiedAt: fileDebt.modifiedAt,
                age: Date.now() - fileDebt.modifiedAt,
                modificationCount: fileDebt.modificationCount,
                totalChanges: fileDebt.totalChanges
            }))
            .sort((a, b) => b.age - a.age); // Oldest first
        
        return {
            total: unreviewedFiles.length,
            files: unreviewedFiles.slice(0, 10) // Top 10 oldest
        };
    }

    /**
     * Get the file-level debt Map (for direct access when needed)
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @returns {Map<string, FileDebt>} FileDebt Map
     */
    getDebtMap() {
        return this.fileDebts;
    }

    /**
     * Get size of file-level debt
     * Note: This returns file-level debt count only. Suggestion debt is tracked separately.
     * @returns {number} Number of files with file-level debt
     */
    getDebtSize() {
        return this.fileDebts.size;
    }

    /**
     * Check if file has unreviewed file-level debt
     * Note: This checks file-level debt only. Pending suggestions are tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file has unreviewed file-level debt
     */
    hasUnreviewedDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        const fileDebt = this.fileDebts.get(uri);
        return fileDebt && !fileDebt.isReviewed();
    }
}

// module.exports = DebtService; // Commented for consolidation

})(); // End IIFE for app/debtService.js


// ============================================================================
// FILE 6/14: app/diffBulletService.js
// ============================================================================

(function() { // IIFE scope for app/diffBulletService.js
/**
 * Diff Bullet Service
 * Application layer service for generating DIFF bullet skeletons from aggregated changes
 * 
 * This is presentation/reporting logic, not domain business logic.
 * Moved from domain/utils/diffBulletBuilder.js to application layer.
 * 
 * Format: - <path> :: <anchor> :: <action> (origin=<ai|human|tool|mixed>, impact=<functional|non-functional|refactor>)
 */

// Keep minimal vscode import for types only
// All API calls should go through vscodeAdapter
// const vscode = require('vscode'); // Commented for consolidation

/**
 * Get workspace-relative path from document
 * @param {vscode.TextDocument} document - Document
 * @param {Object} vscodeAdapter - VS Code adapter (optional, for Ports and Adapters pattern)
 * @returns {string} Relative path or URI string
 */
function relativePathFromDoc(document, vscodeAdapter = null) {
    try {
        // Use vscodeAdapter if available (Ports and Adapters pattern), otherwise fallback to direct vscode
        const asRelativePath = vscodeAdapter 
            ? (uri) => vscodeAdapter.asRelativePath(uri)
            : (uri) => vscode.workspace.asRelativePath(uri);
        return asRelativePath(document.uri);
    } catch {
        return document.uri.toString();
    }
}

/**
 * Find anchor (function/class/method name) for a given line
 * Heuristic-based, no dependencies
 * @param {string} docText - Full document text
 * @param {number} line - Line number (0-indexed)
 * @returns {string} Anchor name or 'top-level'
 */
function findAnchor(docText, line) {
    const lines = docText.split('\n');
    const MAX_SEARCH_LINES = 50; // Limit search to prevent excessive scanning
    
    // Fix: Prefer function/class/const patterns first, only fall back to broad match if needed
    // Search backwards from the changed line
    for (let i = Math.min(line, lines.length - 1); i >= Math.max(0, line - MAX_SEARCH_LINES); i--) {
        const s = lines[i].trim();
        
        // export (default)? class Foo or export class Foo
        const mExportClass = s.match(/\bexport\s+(?:default\s+)?class\s+([A-Za-z0-9_]+)/);
        if (mExportClass) return mExportClass[1];
        
        // class Foo
        const mClass = s.match(/\bclass\s+([A-Za-z0-9_]+)/);
        if (mClass) return mClass[1];
        
        // export (default)? function foo( or export async function foo(
        const mExportFunc = s.match(/\bexport\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
        if (mExportFunc) return mExportFunc[1];
        
        // function foo( or async function foo( or function* foo(
        const mFunc = s.match(/\b(?:async\s+)?function\s*\*\s*([A-Za-z0-9_]+)\s*\(/) ||
                     s.match(/\b(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
        if (mFunc) return mFunc[1];
        
        // export const foo = ( or export const foo = async ( or export const foo = function
        const mExportConstFunc = s.match(/\bexport\s+(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/);
        if (mExportConstFunc) return mExportConstFunc[1];
        
        // const foo = ( or const foo = async ( or const foo = function or const foo = async function
        const mConstFunc = s.match(/\b(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s+)?(?:function\s*)?\(/) ||
                          s.match(/\b(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*async\s+function/);
        if (mConstFunc) return mConstFunc[1];
        
        // class method: public/private/protected foo(...) or foo<T>(...) or foo() {
        const mClassMethod = s.match(/\b(?:public|private|protected)?\s*([A-Za-z0-9_]+)\s*<[^>]*>\s*\(/) ||
                            s.match(/\b(?:public|private|protected)?\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/);
        if (mClassMethod) {
            const methodName = mClassMethod[1];
            // Skip common non-method patterns
            if (!['if', 'for', 'while', 'switch', 'catch', 'with'].includes(methodName)) {
                return methodName;
            }
        }
    }
    
    // Fallback: broad match only if we didn't find a declaration pattern
    // This reduces false positives from function calls, test frameworks, etc.
    for (let i = Math.min(line, lines.length - 1); i >= Math.max(0, line - MAX_SEARCH_LINES); i--) {
        const s = lines[i].trim();
        
        // method: foo = ( or foo: ( or foo(
        // Only use if it looks like a declaration context (assignment, property, or followed by {)
        const mMethod = s.match(/\b([A-Za-z0-9_]+)\s*[:=]?\s*\(/);
        if (mMethod) {
            const methodName = mMethod[1];
            // Skip control flow keywords and test framework keywords
            const skipKeywords = ['if', 'for', 'while', 'switch', 'catch', 'with', 'describe', 'it', 'test', 'before', 'after', 'beforeEach', 'afterEach'];
            if (skipKeywords.includes(methodName)) {
                continue;
            }
            
            // Only use if it looks like a declaration (has assignment/colon or followed by {)
            const hasAssignment = s.includes('=') || s.includes(':');
            const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
            const looksLikeDeclaration = hasAssignment || nextLine.startsWith('{') || nextLine.includes('=>');
            
            if (looksLikeDeclaration) {
                return methodName;
            }
        }
    }
    
    return 'top-level';
}

/**
 * Guess impact from changes (heuristic)
 * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Changes
 * @returns {string} 'functional', 'non-functional', or 'refactor'
 */
function guessImpact(aggregatedChanges) {
    if (!aggregatedChanges || aggregatedChanges.length === 0) {
        return 'non-functional';
    }
    
    // Count non-whitespace characters inserted
    const nonWsInserted = aggregatedChanges.reduce((sum, c) => {
        const text = c.text || '';
        return sum + text.replace(/\s/g, '').length;
    }, 0);
    
    // Count deletions (non-whitespace)
    const nonWsDeleted = aggregatedChanges.reduce((sum, c) => {
        const deletedLength = c.rangeLength || 0;
        // Approximate non-whitespace deleted (heuristic: assume 70% of deleted is non-ws)
        return sum + Math.floor(deletedLength * 0.7);
    }, 0);
    
    // Count distinct line ranges (scattered edits)
    const lineRanges = new Set();
    aggregatedChanges.forEach(c => {
        if (c.range) {
            const startLine = c.range.start?.line ?? 0;
            const endLine = c.range.end?.line ?? 0;
            lineRanges.add(`${startLine}-${endLine}`);
        }
    });
    const distinctRanges = lineRanges.size;
    
    // Refactor heuristic: many small scattered edits with both insert and delete
    // - Multiple distinct ranges (scattered)
    // - Both insertions and deletions (restructuring)
    // - Low non-ws insert ratio (not adding much new content)
    const hasBothInsertAndDelete = nonWsInserted > 0 && nonWsDeleted > 0;
    const isScattered = distinctRanges >= 3;
    const isLowInsertRatio = nonWsInserted < 50; // Small additions
    
    if (isScattered && hasBothInsertAndDelete && isLowInsertRatio) {
        return 'refactor';
    }
    
    // If significant non-whitespace content, likely functional
    // Threshold: 30 characters (rough heuristic)
    return nonWsInserted > 30 ? 'functional' : 'non-functional';
}

// Production: Track last anchor per file for stability (reuse if within ±30 lines)
// Bounded cache to prevent unbounded growth in long sessions
const _lastAnchorCache = new Map(); // file -> { anchor, line }
const MAX_ANCHOR_CACHE_SIZE = 100; // Cap at 100 files (LRU-ish)

/**
 * Build DIFF bullet skeletons from document and changes
 * @param {vscode.TextDocument} document - Document
 * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Aggregated changes
 * @param {Object} classification - Classification result (optional, for origin hint)
 * @param {Object} vscodeAdapter - VS Code adapter (optional, for Ports and Adapters pattern)
 * @returns {Array<string>} Array of DIFF bullet strings
 */
function buildDiffBullets(document, aggregatedChanges, classification = null, vscodeAdapter = null) {
    const path = relativePathFromDoc(document, vscodeAdapter);
    const docText = document.getText();
    
    if (!aggregatedChanges || aggregatedChanges.length === 0) {
        return [];
    }
    
    // Pick first changed line as anchor reference
    const firstChange = aggregatedChanges[0];
    const line = firstChange?.range?.start?.line ?? 0;
    
    // Fix: Reuse anchor if within ±30 lines of previous batch for same file
    // This makes bullets feel less "random" during refactors
    const fileKey = document.uri.toString();
    const lastAnchor = _lastAnchorCache.get(fileKey);
    let anchor;
    
    if (lastAnchor && Math.abs(line - lastAnchor.line) <= 30) {
        // Reuse previous anchor (stable during refactors)
        anchor = lastAnchor.anchor;
    } else {
        // Find new anchor
        anchor = findAnchor(docText, line);
        // Production: Bound cache size (LRU-ish: remove oldest if at limit)
        if (_lastAnchorCache.size >= MAX_ANCHOR_CACHE_SIZE) {
            // Remove first entry (oldest)
            const firstKey = _lastAnchorCache.keys().next().value;
            _lastAnchorCache.delete(firstKey);
        }
        // Cache it
        _lastAnchorCache.set(fileKey, { anchor, line });
    }
    
    // Guess impact from changes
    const impact = guessImpact(aggregatedChanges);
    
    // Infer origin from classification if available
    // Fix: Default to 'mixed' instead of placeholder (must match parser regex)
    let originHint = 'mixed';
    if (classification) {
        if (classification.label === 'ai') {
            originHint = 'ai';
        } else if (classification.label === 'formatter') {
            originHint = 'tool';
        } else if (classification.label === 'user') {
            originHint = 'human';
        }
    }
    
    // Generate bullet with placeholder action
    return [
        `- ${path} :: ${anchor} :: <action> (origin=${originHint}, impact=${impact})`
    ];
}

/**
 * Parse DIFF bullets from text
 * @param {string} text - Text containing DIFF bullets
 * @returns {Array<Object>} Parsed bullets with {path, anchor, action, origin, impact}
 */
function parseDiffBullets(text) {
    const DIFF_RE = /^- (.+?) :: (.+?) :: (.+?) \(origin=(ai|human|tool|mixed), impact=(functional|non-functional|refactor)\)$/;
    
    const lines = text.split('\n');
    return lines
        .map(l => l.trim())
        .filter(l => l.startsWith('- '))
        .map(l => {
            const m = l.match(DIFF_RE);
            if (!m) return null;
            return {
                path: m[1],
                anchor: m[2],
                action: m[3],
                origin: m[4],
                impact: m[5]
            };
        })
        .filter(Boolean);
}

// module.exports = { // Commented for consolidation
//     buildDiffBullets, // Commented for consolidation
//     parseDiffBullets, // Commented for consolidation
//     findAnchor, // Commented for consolidation
//     guessImpact // Commented for consolidation
// }; // Commented for consolidation

})(); // End IIFE for app/diffBulletService.js


// ============================================================================
// FILE 7/14: app/rangeUtilities.js
// ============================================================================

(function() { // IIFE scope for app/rangeUtilities.js
/**
 * RangeUtilities - Application layer utilities for range operations
 * 
 * Contains technical utilities for range calculations and manipulations.
 * These are technical/infrastructure operations - not domain business logic.
 */

class RangeUtilities {
    /**
     * Merge overlapping or touching ranges
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Array<Range>} ranges - Array of ranges to merge
     * @returns {Array<Range>} Merged ranges
     */
    static mergeRanges(vscodePort, ranges) {
        if (!ranges || ranges.length === 0) return [];
        if (ranges.length === 1) return [ranges[0]];

        const Range = vscodePort.Range;
        if (!Range) {
            throw new Error('RangeUtilities.mergeRanges requires Range constructor from vscodePort');
        }

        // Sort ranges by start position
        const sortedRanges = [...ranges].sort((a, b) => {
            const lineDiff = a.start.line - b.start.line;
            if (lineDiff !== 0) return lineDiff;
            return a.start.character - b.start.character;
        });

        const mergedRanges = [];
        for (const range of sortedRanges) {
            if (mergedRanges.length === 0) {
                mergedRanges.push(range);
                continue;
            }

            const lastMerged = mergedRanges[mergedRanges.length - 1];
            const isTouching = range.start.isEqual(lastMerged.end) ||
                range.start.isBefore(lastMerged.end) ||
                (range.start.line === lastMerged.end.line && range.start.character <= lastMerged.end.character);
            const isOverlapping = range.intersection(lastMerged) !== undefined;

            if (isOverlapping || isTouching) {
                const start = range.start.isBefore(lastMerged.start)
                    ? range.start
                    : lastMerged.start;
                const end = range.end.isAfter(lastMerged.end)
                    ? range.end
                    : lastMerged.end;
                mergedRanges[mergedRanges.length - 1] = new Range(start, end);
            } else {
                mergedRanges.push(range);
            }
        }

        return mergedRanges;
    }

    /**
     * Calculate union of ranges
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Array<Range>} ranges - Array of ranges
     * @returns {Range} Union range
     */
    static calculateRangeUnion(vscodePort, ranges) {
        if (!ranges || ranges.length === 0) return null;
        if (ranges.length === 1) return ranges[0];

        const Range = vscodePort.Range;
        if (!Range) {
            throw new Error('RangeUtilities.calculateRangeUnion requires Range constructor from vscodePort');
        }

        // Find minimum start and maximum end
        const start = ranges.reduce((min, r) => 
            r.start.isBefore(min) ? r.start : min,
            ranges[0].start
        );
        const end = ranges.reduce((max, r) => 
            r.end.isAfter(max) ? r.end : max,
            ranges[0].end
        );

        return new Range(start, end);
    }

    /**
     * Calculate intersection of two ranges
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Range} range1 - First range
     * @param {Range} range2 - Second range
     * @returns {Range|null} Intersection range or null
     */
    static calculateRangeIntersection(vscodePort, range1, range2) {
        if (!range1 || !range2) return null;
        return range1.intersection(range2) || null;
    }

    /**
     * Validate range against document
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Range} range - Range to validate
     * @param {TextDocument} document - Document to validate against
     * @returns {Range} Validated range (may be adjusted)
     */
    static validateRange(vscodePort, range, document) {
        if (!range || !document) return range;
        
        // Use document's validateRange method if available
        if (document.validateRange && typeof document.validateRange === 'function') {
            return document.validateRange(range);
        }
        
        // Fallback: manual validation
        const Range = vscodePort.Range;
        if (!Range) return range;

        const lineCount = document.lineCount || 0;
        const startLine = Math.max(0, Math.min(range.start.line, lineCount - 1));
        const endLine = Math.max(0, Math.min(range.end.line, lineCount - 1));
        
        const startLineText = document.lineAt ? document.lineAt(startLine).text : '';
        const endLineText = document.lineAt ? document.lineAt(endLine).text : '';
        
        const startChar = Math.max(0, Math.min(range.start.character, startLineText.length));
        const endChar = Math.max(0, Math.min(range.end.character, endLineText.length));
        
        const Position = vscodePort.Position;
        if (!Position) return range;

        return new Range(
            new Position(startLine, startChar),
            new Position(endLine, endChar)
        );
    }
}

// module.exports = RangeUtilities; // Commented for consolidation

})(); // End IIFE for app/rangeUtilities.js


// ============================================================================
// FILE 8/14: app/scoreCalculations.js
// ============================================================================

(function() { // IIFE scope for app/scoreCalculations.js
/**
 * Score Calculations - Pure functions for calculating awareness score components
 * 
 * Moved from domain layer - these are pure calculations, not invariant protectors.
 * No state, no dependencies, just pure business logic functions.
 */

/**
 * Calculate review score (0-40)
 * High score = user carefully reviewed code
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Review score (0-40)
 */
function calculateReviewScore(suggestions) {
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
function calculateCriticalScore(suggestions) {
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
function calculateAdaptationScore(suggestions) {
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
function calculateDebtScore(fileDebts, pendingSuggestions) {
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
    debtScore += Math.min(unreviewedFiles.length * 2, 10);

    // 2. Number of pending suggestions (0-10 points)
    debtScore += Math.min(pending.length * 2, 10);

    // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
    const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
    const suggestionDebtTimestamps = pending.map(s => s.timestamp || now);
    const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];

    if (allDebtTimestamps.length > 0) {
        const oldestDebt = Math.min(...allDebtTimestamps);
        const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
        debtScore += Math.min(ageHours * 1.5, 10);
    }

    return Math.round(Math.min(debtScore, 30));
}

// module.exports = { // Commented for consolidation
//     calculateReviewScore, // Commented for consolidation
//     calculateCriticalScore, // Commented for consolidation
//     calculateAdaptationScore, // Commented for consolidation
//     calculateDebtScore // Commented for consolidation
// }; // Commented for consolidation

})(); // End IIFE for app/scoreCalculations.js


// ============================================================================
// FILE 9/14: app/sessionService.js
// ============================================================================

(function() { // IIFE scope for app/sessionService.js
/**
 * SessionService - Application service for managing review sessions
 * 
 * Orchestrates review session tracking, coordinates with debt service,
 * and publishes domain events. This is an application service.
 */

// const { normalizeToUri } = require('./vscodeDocUtilities'); // Commented for consolidation
// const ReviewSession = require('../domain/entities/reviewSession'); // Commented for consolidation

class SessionService {
    /**
     * @param {Object} debtService - Debt service (application service)
     * @param {Object} suggestionService - Suggestion service (application service)
     * @param {Function} onDebtCleared - Callback when debt is cleared
     * @param {Function} updateScore - Score update callback
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors (optional)
     * @param {Object} messagingAdapter - Messaging adapter for domain events (optional)
     */
    constructor(debtService, suggestionService, onDebtCleared, updateScore, updateFileColorsInExplorer = null, messagingAdapter = null) {
        this.debtService = debtService;
        this.suggestionService = suggestionService;
        this.onDebtCleared = onDebtCleared;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.messagingAdapter = messagingAdapter; // Optional - for publishing domain events
        
        // Active sessions: URI string -> ReviewSession entity
        this.sessions = new Map();
    }

    /**
     * Initialize session tracking for a file
     * Creates a new ReviewSession entity
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {ReviewSession|null} Created session or null
     */
    initializeSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        
        if (this.sessions.has(uri)) {
            return this.sessions.get(uri); // Return existing session
        }

        const session = new ReviewSession(uri);
        this.sessions.set(uri, session);
        
        // Update debt if file has debt
        if (this.debtService) {
            this.debtService.updateSession(uri, {
                sessionStart: session.sessionStart
            });
        }

        // Publish domain event if messaging adapter is available
        if (this.messagingAdapter) {
            // const ReviewSessionStartedEvent = require('../events/reviewSessionStartedEvent'); // Commented for consolidation
            const event = new ReviewSessionStartedEvent({
                filePath: uri,
                sessionStart: session.sessionStart
            });
            this.messagingAdapter.publishReviewSessionStartedEvent(event).catch(err => {
                // Log but don't throw - event publishing is non-critical
                // Note: loggerPort not available in SessionService, but this is non-critical
                // Consider injecting loggerPort if needed for consistency
            });
        }

        return session;
    }

    /**
     * Update cursor activity for a file being reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateCursorActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const session = this.sessions.get(uri);
        if (session) {
            session.recordCursorMovement();
        }
    }

    /**
     * Update scroll activity for a file being reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateScrollActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const session = this.sessions.get(uri);
        if (session) {
            session.recordScrollEvent();
        }
    }

    /**
     * Check session progress periodically
     * Uses ReviewSession entity methods for business logic
     */
    checkProgress() {
        const MINIMUM_REVIEW_TIME = 30000; // 30 seconds
        const ACTIVITY_TIMEOUT = 60000; // 1 minute
        
        if (this.sessions.size === 0) {
            return;
        }
        
        for (const [uri, session] of this.sessions.entries()) {
            const hasUnreviewedDebt = this.debtService && this.debtService.hasUnreviewedDebt(uri);
            const hasPendingSuggestions = this.suggestionService ? 
                this.suggestionService.getPendingSuggestionsForFile(uri).length > 0 : false;
            
            // If no debt and no pending suggestions, remove session
            if (!hasUnreviewedDebt && !hasPendingSuggestions) {
                this.sessions.delete(uri);
                continue;
            }
            
            // Check if session timed out
            if (session.hasTimedOut(ACTIVITY_TIMEOUT)) {
                if (this.debtService && hasUnreviewedDebt) {
                    const debt = this.debtService.getDebt(uri);
                    if (debt) {
                        session.complete();
                        this.debtService.markAsReviewed(uri, session.reviewTime);
                    }
                }
                this.sessions.delete(uri);
                continue;
            }
            
            // Check if user has reviewed enough
            if (session.hasSufficientEngagement(MINIMUM_REVIEW_TIME, 5, 3)) {
                let needsScoreUpdate = false;
                
                // Mark debt as paid
                if (this.debtService && hasUnreviewedDebt) {
                    const debt = this.debtService.getDebt(uri);
                    if (debt) {
                        session.complete();
                        this.debtService.markAsReviewed(uri, session.reviewTime);
                        
                        // Publish domain event if messaging adapter is available
                        if (this.messagingAdapter) {
                            // const ReviewSessionCompletedEvent = require('../events/reviewSessionCompletedEvent'); // Commented for consolidation
                            const event = new ReviewSessionCompletedEvent({
                                filePath: uri,
                                sessionStart: session.sessionStart,
                                completedAt: session.completedAt,
                                reviewTime: session.reviewTime,
                                engagementScore: session.getEngagementScore()
                            });
                            this.messagingAdapter.publishReviewSessionCompletedEvent(event).catch(err => {
                                // Log but don't throw - event publishing is non-critical
                                // Note: loggerPort not available in SessionService, but this is non-critical
                                // Consider injecting loggerPort if needed for consistency
                            });
                        }
                        
                        // Call optional callback with engagement score
                        if (this.onDebtCleared) {
                            this.onDebtCleared({
                                filePath: uri,
                                totalChanges: debt.totalChanges,
                                totalReviewTime: debt.totalReviewTime + session.reviewTime,
                                modificationCount: debt.modificationCount,
                                engagementScore: session.getEngagementScore()
                            });
                        }
                        
                        needsScoreUpdate = true;
                    }
                }
                
                // Mark all pending suggestions in this file as reviewed
                // Use aggregate methods (single authority) instead of direct entity calls
                if (hasPendingSuggestions && this.suggestionService) {
                    const pendingSuggestions = this.suggestionService.getPendingSuggestionsForFile(uri);
                    for (const suggestion of pendingSuggestions) {
                        // Delegate to SuggestionService which uses aggregate methods
                        this.suggestionService.markSuggestionAsReviewed(suggestion.id, session.reviewTime);
                        needsScoreUpdate = true;
                    }
                }
                
                this.sessions.delete(uri);
                
                // Update file colors and score
                if (needsScoreUpdate && this.updateFileColorsInExplorer) {
                    this.updateFileColorsInExplorer();
                }
                
                if (needsScoreUpdate && this.updateScore) {
                    this.updateScore();
                }
            }
        }
    }

    /**
     * Get session for a file
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {ReviewSession|null} Session or null
     */
    getSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.sessions.get(uri) || null;
    }

    /**
     * Get tracking data for a file (backward compatibility)
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Object|null} Tracking data or null
     */
    getTracking(filePathOrUri) {
        const session = this.getSession(filePathOrUri);
        if (!session) return null;
        
        // Return legacy format for backward compatibility
        return {
            sessionStart: session.sessionStart,
            lastActivity: session.lastActivity,
            cursorMovements: session.cursorMovements,
            scrollEvents: session.scrollEvents
        };
    }

    /**
     * Check if a file is being tracked
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file is being tracked
     */
    isTracking(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        return this.sessions.has(uri);
    }

    /**
     * Clear all tracking sessions
     */
    clear() {
        this.sessions.clear();
    }

    /**
     * Get number of active sessions
     * @returns {number} Number of active sessions
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }

    /**
     * Get all active sessions
     * @returns {Array<ReviewSession>} Array of active sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
}

// module.exports = SessionService; // Commented for consolidation


})(); // End IIFE for app/sessionService.js

