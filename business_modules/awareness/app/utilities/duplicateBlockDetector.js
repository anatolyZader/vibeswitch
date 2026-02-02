/**
 * Duplicate block detection (GitClear-style): find runs of 5+ consecutive lines
 * that appear more than once in the same file (Type 1 clone: identical save whitespace).
 * Used for Duplication Drift antipattern (research: GitClear AI Code Quality 2025.2.5).
 */

const MIN_LINES = 5;

/**
 * Normalize a line for Type 1 comparison (trim, collapse internal spaces).
 * @param {string} line
 * @returns {string}
 */
function normalizeLine(line) {
    return (line || '').trim().replace(/\s+/g, ' ');
}

/**
 * Detect duplicate blocks in file content: runs of minLines+ consecutive (normalized) lines
 * that appear more than once. Returns count of files that have at least one such block,
 * and total duplicate-block count across the content.
 * @param {string} content - Full file content
 * @param {number} minLines - Minimum run length (default 5, GitClear A8)
 * @returns {{ hasDuplicateBlock: boolean, duplicateBlockCount: number }}
 */
function detectDuplicateBlocks(content, minLines = MIN_LINES) {
    if (!content || typeof content !== 'string') {
        return { hasDuplicateBlock: false, duplicateBlockCount: 0 };
    }
    const lines = content.split(/\r?\n/).map(normalizeLine);
    if (lines.length < minLines) {
        return { hasDuplicateBlock: false, duplicateBlockCount: 0 };
    }

    // Map: hash of run -> [start indices]. Runs are minLines consecutive normalized lines.
    const runToStarts = new Map();
    for (let i = 0; i <= lines.length - minLines; i++) {
        const run = lines.slice(i, i + minLines).join('\n');
        if (!runToStarts.has(run)) runToStarts.set(run, []);
        runToStarts.get(run).push(i);
    }

    let duplicateBlockCount = 0;
    for (const starts of runToStarts.values()) {
        if (starts.length > 1) {
            // Count non-overlapping duplicate occurrences (each run that repeats)
            duplicateBlockCount += starts.length;
        }
    }
    const hasDuplicateBlock = duplicateBlockCount > 0;
    return { hasDuplicateBlock, duplicateBlockCount };
}

/**
 * Given an array of { filePath, content }, return aggregation for Duplication Drift risk.
 * @param {Array<{ filePath: string, content: string }>} filesWithContent
 * @param {number} minLines
 * @returns {{ fileCountWithDuplicates: number, totalDuplicateBlocks: number, risk0To100: number }}
 */
function aggregateDuplicateRisk(filesWithContent, minLines = MIN_LINES) {
    let fileCountWithDuplicates = 0;
    let totalDuplicateBlocks = 0;
    for (const { content } of filesWithContent) {
        const { hasDuplicateBlock, duplicateBlockCount } = detectDuplicateBlocks(content, minLines);
        if (hasDuplicateBlock) {
            fileCountWithDuplicates += 1;
            totalDuplicateBlocks += duplicateBlockCount;
        }
    }
    // Risk: scale by files with duplicates (GitClear: 8× rise in commits with dupe blocks).
    // Heuristic: 1 file = 25%, 2 = 50%, 3 = 75%, 4+ = 100%.
    const risk0To100 = Math.min(100, fileCountWithDuplicates * 25);
    return { fileCountWithDuplicates, totalDuplicateBlocks, risk0To100 };
}

module.exports = {
    detectDuplicateBlocks,
    aggregateDuplicateRisk,
    MIN_LINES
};
