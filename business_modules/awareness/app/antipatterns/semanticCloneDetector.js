/**
 * SemanticCloneDetector - Name/signature similarity across modules => type-4 clone candidates.
 */

const path = require('path');

function extractSignatures(content) {
    if (typeof content !== 'string') return [];
    const out = [];
    const funcRe = /\b(?:function|async\s+function)\s+(\w+)\s*\([^)]*\)/g;
    const arrowRe = /\b(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)/g;
    const classRe = /\bclass\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g;
    let m;
    while ((m = funcRe.exec(content)) !== null) out.push({ name: m[1], sig: m[0].slice(0, 60) });
    while ((m = arrowRe.exec(content)) !== null) out.push({ name: m[1], sig: m[0].slice(0, 60) });
    while ((m = classRe.exec(content)) !== null) out.push({ name: m[1], sig: m[0].slice(0, 60) });
    return out;
}

function moduleFromPath(filePath) {
    const p = (filePath || '').replace(/\\/g, '/');
    const parts = p.split('/');
    return parts[0] || 'root';
}

function nameSimilarity(a, b) {
    const na = (a || '').toLowerCase();
    const nb = (b || '').toLowerCase();
    if (na === nb) return 1;
    const wordsA = na.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
    const wordsB = nb.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
    let match = 0;
    for (const wa of wordsA) {
        for (const wb of wordsB) {
            if (wa.length >= 2 && wb.length >= 2 && (wa === wb || wa.includes(wb) || wb.includes(wa))) {
                match += 1;
                break;
            }
        }
    }
    const maxWords = Math.max(wordsA.length, wordsB.length, 1);
    return match / maxWords;
}

/**
 * Compute semantic clone candidates (different module, similar name/sig).
 * @param {Object} ctx - { filesWithContent: Array<{ filePath: string, content: string }>, allFilesContent?: Array<{ filePath: string, content: string }> }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number, maxFilesPerCycle?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, candidates: Array<{ new: string, existing: string, score: number }>, cloneClusters: string[][] }>}
 */
async function compute(ctx, cancelToken, budget) {
    const filesWithContent = ctx.filesWithContent || [];
    const allFilesContent = ctx.allFilesContent || filesWithContent;
    const maxFiles = (budget && budget.maxFilesPerCycle) != null ? budget.maxFilesPerCycle : 25;
    const maxMs = (budget && budget.maxWorkMsPerTick) != null ? budget.maxWorkMsPerTick : 35;
    const SCORE_THRESHOLD = 0.6;

    const start = Date.now();
    const fileSigs = new Map();
    for (let i = 0; i < Math.min(allFilesContent.length, maxFiles * 2); i++) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) break;
        if (Date.now() - start > maxMs) break;
        const f = allFilesContent[i];
        if (!f || !f.filePath) continue;
        fileSigs.set(f.filePath, extractSignatures(f.content || ''));
    }

    const candidates = [];
    const currentPaths = new Set(filesWithContent.map(f => f.filePath));

    for (const [filePath, sigs] of fileSigs) {
        if (!currentPaths.has(filePath)) continue;
        const mod = moduleFromPath(filePath);
        for (const { name: newName } of sigs) {
            for (const [otherPath, otherSigs] of fileSigs) {
                if (otherPath === filePath) continue;
                if (moduleFromPath(otherPath) === mod) continue;
                for (const { name: existingName } of otherSigs) {
                    const score = nameSimilarity(newName, existingName);
                    if (score >= SCORE_THRESHOLD) {
                        candidates.push({
                            new: `${filePath}:${newName}`,
                            existing: `${otherPath}:${existingName}`,
                            score
                        });
                    }
                }
            }
        }
    }

    const dedup = new Map();
    for (const c of candidates) {
        const key = [c.new, c.existing].sort().join('|');
        if (!dedup.has(key) || dedup.get(key).score < c.score) dedup.set(key, c);
    }
    const list = Array.from(dedup.values()).sort((a, b) => b.score - a.score).slice(0, 15);

    const cloneClusters = [];
    const risk0To100 = Math.min(100, list.length * 20);

    return {
        risk0To100,
        candidates: list,
        cloneClusters
    };
}

module.exports = {
    compute,
    extractSignatures,
    nameSimilarity
};
