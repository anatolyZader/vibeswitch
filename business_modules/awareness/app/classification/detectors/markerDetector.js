/**
 * Marker Detector
 * Detects @ai markers in code changes (strong signal when present)
 * 
 * Moved from domain/utils/detectors to app/classification/detectors - these are pure functions, not domain logic.
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

module.exports = {
    hasAIMarker
};


