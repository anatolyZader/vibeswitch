/**
 * Marker Detector
 * Detects @ai markers in code changes (strong signal when present)
 * 
 * Moved from domain/utils/detectors to app/classification/detectors - these are pure functions, not domain logic.
 */

// Shared patterns for @ai marker (comment formats)
const markerPatterns = [
    /\/\/\s*@ai/i,                    // JavaScript/TypeScript/Java/C/C++/C#
    /#\s*@ai/i,                        // Python/Shell/Bash
    /<!--[\s\S]*?@ai[\s\S]*?-->/i,     // HTML/XML/Markdown
    /--\s*@ai/i,                       // SQL
    /\/\*[\s\S]*?@ai[\s\S]*?\*\//i     // CSS block comment
];

/**
 * Check if changes contain @ai marker (primary signal for AI-generated code)
 * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
 * @returns {boolean} True if @ai marker is found
 */
function hasAIMarker(changes) {
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

/**
 * Check if full text (e.g. file content) contains @ai marker.
 * Used to distinguish AI-created files from user-created when processing new files.
 * @param {string} text - Full document or file content
 * @returns {boolean} True if @ai marker is found
 */
function hasAIMarkerInText(text) {
    if (!text || typeof text !== 'string') return false;
    return markerPatterns.some((p) => p.test(text));
}

module.exports = {
    hasAIMarker,
    hasAIMarkerInText
};


