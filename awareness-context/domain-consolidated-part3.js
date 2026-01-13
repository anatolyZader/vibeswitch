/**
 * DOMAIN LAYER - CONSOLIDATED (PART 3/3)
 * 
 * This file contains part 3 of 3 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 15/49
 * Generated: 2026-01-13T15:56:48.088Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 35/49: domain/utils/detectors/formatterDetector.js
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
// FILE 36/49: domain/utils/detectors/largeInsertionDetector.js
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
// FILE 37/49: domain/utils/detectors/markerDetector.js
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
// FILE 38/49: domain/utils/detectors/multiLineDetector.js
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
// FILE 39/49: domain/utils/detectors/pureInsertionDetector.js
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
// FILE 40/49: domain/utils/detectors/rapidScatteredDetector.js
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
// FILE 41/49: domain/utils/detectors/scatteredEditsDetector.js
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


// ============================================================================
// FILE 42/49: domain/utils/detectors/smallEditsDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/smallEditsDetector.js
/**
 * Small Edits Detector
 * Detects small edits (likely user formatting)
 */

/**
 * Detector: Small edits (likely user formatting)
 * @param {Object} metrics - Calculated metrics
 * @returns {Object|null} Detection result or null
 */
function detectSmallEdits(metrics) {
    if (metrics.hasMultiLine && metrics.totalInserted < 20) {
        return {
            label: 'user',
            score: 0.4,
            reason: `small multi-line edit: ${metrics.totalInserted} chars (likely formatting)`,
            reasonTag: 'user:small_edit' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectSmallEdits // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/smallEditsDetector.js


// ============================================================================
// FILE 43/49: domain/utils/diffBulletBuilder.js
// ============================================================================

(function() { // IIFE scope for domain/utils/diffBulletBuilder.js
/**
 * DIFF Bullet Builder
 * Generates DIFF bullet skeletons from aggregated changes
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
 * @returns {string} 'functional' or 'non-functional'
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
    let originHint = '<ai|human|tool|mixed>';
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


})(); // End IIFE for domain/utils/diffBulletBuilder.js


// ============================================================================
// FILE 44/49: domain/utils/reasonFilter.js
// ============================================================================

(function() { // IIFE scope for domain/utils/reasonFilter.js
/**
 * Reason Filter
 * Filters classification reasons by tag prefix based on final label
 */

/**
 * Filter reasons by reasonTag prefix based on final classification label
 * This reduces noise in logs and makes debugging easier
 * @param {Array<{tag: string|null, text: string}>} reasonObjects - Array of reason objects with tags
 * @param {string} label - Final classification label ('ai'|'user'|'formatter'|'unknown')
 * @returns {Array<string>} Filtered array of reason strings
 */
function filterReasons(reasonObjects, label) {
    return reasonObjects
        .filter(r => {
            if (!r.tag) return true; // Keep reasons without tags (e.g., marker detection)
            
            if (label === 'formatter') {
                return r.tag.startsWith('fmt:');
            } else if (label === 'ai') {
                return r.tag.startsWith('ai:');
            } else if (label === 'user') {
                return r.tag.startsWith('user:');
            }
            return true; // Keep all reasons for unknown
        })
        .map(r => r.text);
}

// module.exports = { // Commented for consolidation
//     filterReasons // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/reasonFilter.js


// ============================================================================
// FILE 45/49: domain/utils/utils.js
// ============================================================================

(function() { // IIFE scope for domain/utils/utils.js
/**
 * Awareness Monitor Utilities
 * Shared constants and utility functions used across awareness monitor modules
 */

// const vscode = require('vscode'); // Commented for consolidation
// const path = require('path'); // Commented for consolidation

// Constants for file filtering
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
// Fix: Store extensions in lowercase for consistent comparison
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

/**
 * Check if a document should be skipped (non-code documents)
 * FIXED: Consistent API - always accepts document
 * @param {vscode.TextDocument} document - The document to check
 * @returns {boolean} True if the document should be skipped
 */
function isNonCodeDocument(document) {
    if (!document) return true;
    
    const scheme = document.uri.scheme;
    
    // Scheme blacklist (always skip these)
    if (NON_CODE_SCHEMES.includes(scheme)) {
        return true;
    }
    
    // Fix: Filter by file extension (only process code files)
    // Fix: Handle remote/virtual docs properly - prefer uri.path, strip query/fragment
    const p = (document.uri?.path || document.fileName || '');
    const clean = p.split('?')[0].split('#')[0]; // Strip query and fragment
    const ext = path.extname(clean).toLowerCase();
    
    // If we have an extension and it's not in the code extensions list, skip it
    if (ext && !CODE_EXTENSIONS.includes(ext)) {
        return true;
    }
    
    // Handle untitled documents (user-controlled)
    // untitled can be code, so we don't skip it by default if no extension
    
    return false;
}

/**
 * Check if a URI scheme should be skipped (for cases where we only have URI, not document)
 * @param {vscode.Uri|string} uriOrScheme - URI or scheme string
 * @returns {boolean} True if the URI should be skipped
 */
function isSkippableUri(uriOrScheme) {
    let scheme;
    if (typeof uriOrScheme === 'string') {
        scheme = uriOrScheme;
    } else {
        scheme = uriOrScheme.scheme;
    }
    
    return NON_CODE_SCHEMES.includes(scheme);
}

/**
 * Normalize file path or URI to canonical URI string
 * FIXED: Use URI as canonical identifier for remote workspace compatibility
 * @param {string|vscode.Uri} filePathOrUri - File path (fsPath) or URI
 * @returns {string} Canonical URI string
 */
function normalizeToUri(filePathOrUri) {
    if (!filePathOrUri) return null;
    
    // If already a URI string (starts with scheme), return as-is
    if (typeof filePathOrUri === 'string' && filePathOrUri.includes('://')) {
        return filePathOrUri;
    }
    
    // If it's a vscode.Uri object, convert to string
    if (filePathOrUri && typeof filePathOrUri === 'object' && filePathOrUri.toString) {
        return filePathOrUri.toString();
    }
    
    // If it's a file path (fsPath), convert to file:// URI
    if (typeof filePathOrUri === 'string') {
        try {
            const uri = vscode.Uri.file(filePathOrUri);
            return uri.toString();
        } catch (err) {
            // Fallback: treat as relative path or return as-is
            return filePathOrUri;
        }
    }
    
    return filePathOrUri;
}

/**
 * Get relative path from workspace folder
 * @param {string} filePath - Absolute file path
 * @returns {string} Relative path or basename if not in workspace
 */
function getRelativePath(filePath) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return path.basename(filePath);
    }
    
    // Try each workspace folder
    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;
        if (filePath.startsWith(folderPath)) {
            const relative = path.relative(folderPath, filePath);
            return relative || path.basename(filePath);
        }
    }
    
    // Fallback to basename if not in workspace
    return path.basename(filePath);
}

/**
 * Check if a position is within a range
 * @param {vscode.Position} position - The position to check
 * @param {vscode.Range} range - The range to check against
 * @returns {boolean} True if position is within range
 */
function isPositionInRange(position, range) {
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

/**
 * Check if two ranges overlap
 * Fix: Use VS Code's built-in range intersection for accurate overlap detection
 * @param {vscode.Range} range1 - First range
 * @param {vscode.Range} range2 - Second range
 * @returns {boolean} True if ranges overlap
 */
function rangesOverlap(range1, range2) {
    // Fix: Use VS Code's built-in intersection method for accurate overlap detection
    // This properly handles character positions on the same line
    return range1.intersection(range2) !== undefined;
}

// module.exports = { // Commented for consolidation
//     NON_CODE_SCHEMES, // Commented for consolidation
//     CODE_EXTENSIONS, // Commented for consolidation
//     isNonCodeDocument, // Commented for consolidation
//     isSkippableUri, // Commented for consolidation
//     normalizeToUri, // Commented for consolidation
//     getRelativePath, // Commented for consolidation
//     isPositionInRange, // Commented for consolidation
//     rangesOverlap // Commented for consolidation
// }; // Commented for consolidation

})(); // End IIFE for domain/utils/utils.js


// ============================================================================
// FILE 46/49: domain/utils/versionDriftHandler.js
// ============================================================================

(function() { // IIFE scope for domain/utils/versionDriftHandler.js
/**
 * Version Drift Handler
 * Detects document version drift and caps confidence when document changed externally
 */

/**
 * Check if document version has drifted (changed externally)
 * @param {vscode.TextDocument} document - Current document
 * @param {number} lastSeenVersion - Last seen document version
 * @returns {boolean} True if version has drifted
 */
function hasVersionDrift(document, lastSeenVersion) {
    return document && document.version !== lastSeenVersion;
}

/**
 * Apply version drift confidence cap to classification
 * @param {Object} classification - Classification result (will be mutated)
 * @param {vscode.TextDocument} document - Current document
 * @param {number} lastSeenVersion - Last seen document version
 * @param {number} lastSeenTimestamp - Last seen timestamp
 * @param {Object} metrics - Metrics object to update drift count
 * @returns {boolean} True if drift was detected and cap was applied
 */
function applyDriftCap(classification, document, lastSeenVersion, lastSeenTimestamp, metrics) {
    if (!hasVersionDrift(document, lastSeenVersion)) {
        return false;
    }
    
    const originalConfidence = classification.confidence;
    classification.confidence = Math.min(classification.confidence, 0.6); // Cap at 0.6
    
    if (originalConfidence > 0.6) {
        // Production: Track drift for observability
        if (metrics) {
            metrics.versionDriftCount++;
        }
        
        // Fix: Include version and timestamp in drift reason for easier debugging
        // Clarify: version changed after last captured event (could be external edit or missed internal event)
        const driftAge = lastSeenTimestamp ? Date.now() - lastSeenTimestamp : 0;
        classification.reasons.push(`meta:version_drift document version ${document.version} vs last seen ${lastSeenVersion} (age: ${driftAge}ms, version changed after last captured event, confidence capped)`);
        
        // Production: Add meta flag for metrics/observability
        if (!classification.meta) {
            classification.meta = {};
        }
        classification.meta.versionDrift = true;
        
        return true;
    }
    
    return false;
}

// module.exports = { // Commented for consolidation
//     hasVersionDrift, // Commented for consolidation
//     applyDriftCap // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/versionDriftHandler.js


// ============================================================================
// FILE 47/49: domain/value_objects/filePath.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/filePath.js
/**
 * FilePath - Value object for file paths
 * 
 * Encapsulates file path validation and normalization.
 */

class FilePath {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('FilePath must be a non-empty string');
        }
        this.value = value.trim();
        if (this.value.length === 0) {
            throw new Error('FilePath cannot be empty');
        }
    }

    equals(other) {
        return other instanceof FilePath && this.value === other.value;
    }

    toString() {
        return this.value;
    }

    /**
     * Get the file name (last segment of path)
     * @returns {string} File name
     */
    getFileName() {
        const parts = this.value.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * Get the directory path
     * @returns {string} Directory path
     */
    getDirectory() {
        const lastSlash = Math.max(this.value.lastIndexOf('/'), this.value.lastIndexOf('\\'));
        if (lastSlash === -1) return '';
        return this.value.substring(0, lastSlash);
    }
}

// module.exports = FilePath; // Commented for consolidation


})(); // End IIFE for domain/value_objects/filePath.js


// ============================================================================
// FILE 48/49: domain/value_objects/score.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/score.js
/**
 * Score - Value object for awareness scores
 * 
 * Encapsulates score validation and business rules.
 */

class Score {
    constructor(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error('Score must be a valid number');
        }
        if (value < 0 || value > 100) {
            throw new Error('Score must be between 0 and 100');
        }
        this.value = Math.round(value * 100) / 100; // Round to 2 decimal places
    }

    equals(other) {
        return other instanceof Score && this.value === other.value;
    }

    toNumber() {
        return this.value;
    }

    toString() {
        return this.value.toString();
    }

    /**
     * Check if score is in a critical range (high awareness needed)
     * @returns {boolean} True if score >= 70
     */
    isCritical() {
        return this.value >= 70;
    }

    /**
     * Check if score is in a warning range
     * @returns {boolean} True if score >= 40 and < 70
     */
    isWarning() {
        return this.value >= 40 && this.value < 70;
    }

    /**
     * Check if score is in a safe range
     * @returns {boolean} True if score < 40
     */
    isSafe() {
        return this.value < 40;
    }
}

// module.exports = Score; // Commented for consolidation


})(); // End IIFE for domain/value_objects/score.js


// ============================================================================
// FILE 49/49: domain/value_objects/suggestionId.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/suggestionId.js
/**
 * SuggestionId - Value object for AI suggestion identifiers
 * 
 * Encapsulates suggestion ID validation.
 */

class SuggestionId {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('SuggestionId must be a non-empty string');
        }
        this.value = value.trim();
        if (this.value.length === 0) {
            throw new Error('SuggestionId cannot be empty');
        }
    }

    equals(other) {
        return other instanceof SuggestionId && this.value === other.value;
    }

    toString() {
        return this.value;
    }
}

// module.exports = SuggestionId; // Commented for consolidation


})(); // End IIFE for domain/value_objects/suggestionId.js

