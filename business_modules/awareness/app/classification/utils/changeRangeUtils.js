/**
 * Change Range Utilities
 * Shared utilities for calculating range keys and range sets from text changes
 * 
 * Note: This is for classification/scatteredness detection (string-based keys).
 * For VS Code Range object operations, see app/utilities/rangeUtilities.js
 */

/**
 * Calculate a line-based range key for a change
 * Uses line numbers (not character positions) for more stable scatteredness detection
 * 
 * @param {vscode.TextDocumentContentChangeEvent} change - Text change event
 * @returns {string} Range key in format "startLine-endLine"
 */
function calculateRangeKey(change) {
    return `${change.range.start.line}-${change.range.end.line}`;
}

/**
 * Calculate a range set from an array of changes
 * Returns a Set of range keys for scatteredness detection
 * 
 * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Array of text changes
 * @returns {Set<string>} Set of range keys
 */
function calculateRangeSet(changes) {
    const rangeSet = new Set();
    for (const change of changes) {
        rangeSet.add(calculateRangeKey(change));
    }
    return rangeSet;
}

module.exports = {
    calculateRangeKey,
    calculateRangeSet
};
