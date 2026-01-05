/**
 * DIFF Bullet Builder
 * Generates DIFF bullet skeletons from aggregated changes
 * 
 * Format: - <path> :: <anchor> :: <action> (origin=<ai|human|tool|mixed>, impact=<functional|non-functional|refactor>)
 */

const vscode = require('vscode');

/**
 * Get workspace-relative path from document
 * @param {vscode.TextDocument} document - Document
 * @returns {string} Relative path or URI string
 */
function relativePathFromDoc(document) {
    try {
        return vscode.workspace.asRelativePath(document.uri);
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
 * @returns {Array<string>} Array of DIFF bullet strings
 */
function buildDiffBullets(document, aggregatedChanges, classification = null) {
    const path = relativePathFromDoc(document);
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

module.exports = {
    buildDiffBullets,
    parseDiffBullets,
    findAnchor,
    guessImpact
};

