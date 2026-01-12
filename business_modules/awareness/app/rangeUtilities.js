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

module.exports = RangeUtilities;
