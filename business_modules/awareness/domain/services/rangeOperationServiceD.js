/**
 * RangeOperationServiceD - Domain service for range and position operations
 * 
 * Encapsulates core domain business logic for range/position operations.
 * Technical utilities (merge, union, intersection, validation) are in app layer.
 */

class RangeOperationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Check if two ranges overlap (domain business logic)
     * Note: This uses VS Code Range.intersection() method - domain is VS Code-coupled.
     * For a truly portable domain, introduce RangeVO and move this to adapter layer.
     * @param {Range} range1 - First range
     * @param {Range} range2 - Second range
     * @returns {boolean} True if ranges overlap
     */
    rangesOverlap(range1, range2) {
        if (!range1 || !range2) return false;
        // Use VS Code's built-in intersection method for accurate overlap detection
        // TODO: For portable domain, introduce RangeVO and move this to adapter
        return range1.intersection(range2) !== undefined;
    }

    /**
     * Check if position is within range (domain business logic)
     * Note: This uses VS Code Position/Range types - domain is VS Code-coupled.
     * @param {Position} position - Position to check
     * @param {Range} range - Range to check against
     * @returns {boolean} True if position is in range
     */
    isPositionInRange(position, range) {
        if (!position || !range) return false;
        
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
}

module.exports = RangeOperationServiceD;
