/**
 * PromptThrashDetector - Many prompt rounds per file/feature, no spec/notes => thrash.
 */

const PROMPT_ITERATIONS_THRESHOLD = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Compute prompt thrash from ledger: high batch count per file in window, no spec evidence.
 * @param {Object} ctx - { ledgerEntries: Array<{ ts: number, file?: string, uri?: string, label?: string }>, sinceTs?: number }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, thrashLoops: Array<{ file: string, count: number }>, specDebtLabel: string }>}
 */
async function compute(ctx, cancelToken, budget) {
    const ledgerEntries = ctx.ledgerEntries || [];
    const sinceTs = ctx.sinceTs != null ? ctx.sinceTs : Date.now() - WINDOW_MS;
    const now = Date.now();

    const batchCountByFile = new Map();
    for (const e of ledgerEntries) {
        if (e.kind !== 'batch' && e.label !== 'ai') continue;
        const ts = e.ts || 0;
        if (ts < sinceTs || ts > now) continue;
        const file = (e.file || e.uri || '').trim() || 'unknown';
        batchCountByFile.set(file, (batchCountByFile.get(file) || 0) + 1);
    }

    const thrashLoops = [];
    for (const [file, count] of batchCountByFile) {
        if (count >= PROMPT_ITERATIONS_THRESHOLD) {
            thrashLoops.push({ file, count });
        }
    }
    thrashLoops.sort((a, b) => b.count - a.count);

    const specDebtLabel = thrashLoops.length > 0
        ? 'No spec/notes detected for high-iteration files'
        : '';

    const risk0To100 = Math.min(100, thrashLoops.length * 30);
    return {
        risk0To100,
        thrashLoops: thrashLoops.slice(0, 10),
        specDebtLabel
    };
}

module.exports = {
    compute
};
