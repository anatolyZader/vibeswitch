/**
 * AdditiveBiasDetector - New helper/function with high name similarity to existing => possible reuse missed.
 */

function extractSymbolNames(content) {
    if (typeof content !== 'string') return [];
    const names = new Set();
    const funcRe = /\b(?:function|const|let|var)\s+(\w+)\s*[=(]/g;
    const classRe = /\bclass\s+(\w+)/g;
    let m;
    while ((m = funcRe.exec(content)) !== null) names.add(m[1]);
    while ((m = classRe.exec(content)) !== null) names.add(m[1]);
    return Array.from(names);
}

function normalizeForSimilarity(name) {
    return (name || '').toLowerCase().replace(/_/g, '').replace(/[^a-z0-9]/g, '');
}

function similarity(a, b) {
    const na = normalizeForSimilarity(a);
    const nb = normalizeForSimilarity(b);
    if (na === nb) return 1;
    if (na.length < 2 || nb.length < 2) return 0;
    if (na.includes(nb) || nb.includes(na)) return 0.8;
    let match = 0;
    const minLen = Math.min(na.length, nb.length);
    for (let i = 0; i < minLen; i++) {
        if (na[i] === nb[i]) match++;
    }
    return match / Math.max(na.length, nb.length);
}

/**
 * Compute additive bias: new symbols that resemble existing ones (possible duplicate).
 * @param {Object} ctx - { filesWithContent: Array<{ filePath: string, content: string }>, allFilesContent?: Array<{ filePath: string, content: string }> }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number, maxFilesPerCycle?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, duplicationCandidates: Array<{ newSymbol: string, existingSymbol: string }>, consolidationQueue: string[] }>}
 */
async function compute(ctx, cancelToken, budget) {
    const filesWithContent = ctx.filesWithContent || [];
    const allFilesContent = ctx.allFilesContent || filesWithContent;
    const maxFiles = (budget && budget.maxFilesPerCycle) != null ? budget.maxFilesPerCycle : 30;
    const maxMs = (budget && budget.maxWorkMsPerTick) != null ? budget.maxWorkMsPerTick : 40;
    const SIM_THRESHOLD = 0.75;

    const start = Date.now();
    const symbolToFile = new Map();
    const fileToSymbols = new Map();

    for (let i = 0; i < Math.min(allFilesContent.length, maxFiles * 2); i++) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) break;
        if (Date.now() - start > maxMs) break;

        const f = allFilesContent[i];
        if (!f || !f.filePath) continue;
        const names = extractSymbolNames(f.content || '');
        fileToSymbols.set(f.filePath, names);
        for (const n of names) {
            if (!symbolToFile.has(n)) symbolToFile.set(n, []);
            symbolToFile.get(n).push(f.filePath);
        }
    }

    const duplicationCandidates = [];
    const pathSet = new Set(filesWithContent.map(f => f.filePath));

    for (let i = 0; i < Math.min(filesWithContent.length, maxFiles); i++) {
        if (Date.now() - start > maxMs) break;
        const f = filesWithContent[i];
        const names = fileToSymbols.get(f.filePath) || extractSymbolNames(f.content || '');
        for (const newName of names) {
            for (const [existingName, paths] of symbolToFile) {
                if (existingName === newName) continue;
                const otherPaths = paths.filter(p => p !== f.filePath);
                if (otherPaths.length === 0) continue;
                const sim = similarity(newName, existingName);
                if (sim >= SIM_THRESHOLD) {
                    duplicationCandidates.push({
                        newSymbol: newName,
                        existingSymbol: existingName
                    });
                }
            }
        }
    }

    const seen = new Set();
    const unique = duplicationCandidates.filter(c => {
        const key = `${c.newSymbol}:${c.existingSymbol}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const consolidationQueue = [...new Set(unique.map(c => c.newSymbol))];
    const risk0To100 = Math.min(100, unique.length * 25);

    return {
        risk0To100,
        duplicationCandidates: unique.slice(0, 15),
        consolidationQueue
    };
}

module.exports = {
    compute,
    extractSymbolNames,
    similarity
};
