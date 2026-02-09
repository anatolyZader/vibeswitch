/**
 * ChurnDetector - Same-file repeated changes in a short window; cross-check with AI-heavy ledger.
 */

const { spawn } = require('child_process');

const DEFAULT_WINDOW_DAYS = 14;

function runGit(workspaceRoot, args, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, {
            cwd: workspaceRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            env: { ...process.env, GIT_PAGER: 'cat' }
        });
        let stdout = '';
        let stderr = '';
        const t = setTimeout(() => {
            try { child.kill('SIGTERM'); } catch (_) {}
            reject(new Error('git timeout'));
        }, timeoutMs);
        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });
        child.on('close', code => {
            clearTimeout(t);
            if (code === 0) resolve(stdout.trim());
            else reject(new Error(stderr || 'git failed'));
        });
        child.on('error', err => {
            clearTimeout(t);
            reject(err);
        });
    });
}

/**
 * Get commit count per file in last N days (churn proxy).
 * @param {string} workspaceRoot
 * @param {number} days
 * @returns {Promise<Map<string, number>>} file path -> commit count
 */
async function getCommitCountByFile(workspaceRoot, days) {
    const since = `${days} days ago`;
    const out = await runGit(workspaceRoot, ['log', '--since=' + since, '--name-only', '--pretty=format:'], 10000);
    const countByFile = new Map();
    for (const line of out.split('\n')) {
        const f = line.trim();
        if (!f || f.startsWith('commit') || f.startsWith('Author') || f.startsWith('Date')) continue;
        countByFile.set(f, (countByFile.get(f) || 0) + 1);
    }
    return countByFile;
}

/**
 * Compute churn: hot files (many commits in window); optional correlation with AI batches.
 * @param {Object} ctx - { workspaceRoot: string, windowDays?: number, ledgerEntries?: Array<{ file?: string, uri?: string, label?: string, ts?: number }> }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, hotFiles: Array<{ path: string, churnScore: number }>, aiAssistedChurnCorrelation?: number }>}
 */
async function compute(ctx, cancelToken, budget) {
    const workspaceRoot = ctx.workspaceRoot;
    const windowDays = ctx.windowDays ?? DEFAULT_WINDOW_DAYS;
    const ledgerEntries = ctx.ledgerEntries || [];
    const maxMs = (budget && budget.maxWorkMsPerTick) != null ? budget.maxWorkMsPerTick : 4000;

    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
        return { risk0To100: 0, hotFiles: [] };
    }

    const start = Date.now();
    let countByFile;
    try {
        countByFile = await getCommitCountByFile(workspaceRoot, windowDays);
    } catch (_) {
        return { risk0To100: 0, hotFiles: [] };
    }

    if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
        return { risk0To100: 0, hotFiles: [] };
    }
    if (Date.now() - start > maxMs) {
        return { risk0To100: 0, hotFiles: [] };
    }

    const hotThreshold = 5;
    const hotFiles = [];
    for (const [file, count] of countByFile) {
        if (count >= hotThreshold) {
            hotFiles.push({ path: file, churnScore: count });
        }
    }
    hotFiles.sort((a, b) => b.churnScore - a.churnScore);

    const aiTouchedFiles = new Set();
    for (const e of ledgerEntries) {
        if (e.label === 'ai' && (e.kind === 'batch' || !e.kind)) {
            const f = (e.file || e.uri || '').trim();
            if (f) aiTouchedFiles.add(f);
        }
    }

    let aiAssistedChurnCorrelation;
    if (hotFiles.length > 0 && aiTouchedFiles.size > 0) {
        const hotPaths = new Set(hotFiles.map(h => h.path));
        let overlap = 0;
        for (const p of hotPaths) {
            if (aiTouchedFiles.has(p)) overlap++;
        }
        aiAssistedChurnCorrelation = hotFiles.length > 0 ? overlap / hotFiles.length : 0;
    }

    const risk0To100 = Math.min(100, hotFiles.length * 15);
    return {
        risk0To100,
        hotFiles: hotFiles.slice(0, 20),
        aiAssistedChurnCorrelation
    };
}

module.exports = {
    compute,
    getCommitCountByFile
};
