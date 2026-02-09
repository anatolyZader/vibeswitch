/**
 * RefactorAtrophyDetector - Low (deleted+moved+renamed)/added ratio over a window => atrophy.
 * Uses git; no-git returns 0 risk.
 */

const { spawn } = require('child_process');
const path = require('path');

const DEFAULT_WINDOW_DAYS = 14;

function runGit(workspaceRoot, args, timeoutMs = 5000) {
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
 * Parse git log --numstat for last N days to get added/deleted per file.
 * @param {string} workspaceRoot
 * @param {number} days
 * @returns {Promise<{ added: number, deleted: number, byFile: Object }>}
 */
async function getAddDeleteStats(workspaceRoot, days) {
    const since = `${days} days ago`;
    const out = await runGit(workspaceRoot, ['log', '--since=' + since, '--numstat', '--no-renames'], 8000);
    let added = 0;
    let deleted = 0;
    const byFile = {};
    for (const line of out.split('\n')) {
        const m = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (!m) continue;
        const a = parseInt(m[1], 10) || 0;
        const d = parseInt(m[2], 10) || 0;
        const file = (m[3] || '').trim();
        added += a;
        deleted += d;
        if (file) {
            byFile[file] = (byFile[file] || { added: 0, deleted: 0 });
            byFile[file].added += a;
            byFile[file].deleted += d;
        }
    }
    return { added, deleted, byFile };
}

/**
 * Compute refactor atrophy: refactor_activity = (deleted + moved) / added; low => atrophy.
 * @param {Object} ctx - { workspaceRoot: string, windowDays?: number }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, refactorActivityRatio: number, trendByModule?: object }>}
 */
async function compute(ctx, cancelToken, budget) {
    const workspaceRoot = ctx.workspaceRoot;
    const windowDays = ctx.windowDays ?? DEFAULT_WINDOW_DAYS;
    const maxMs = (budget && budget.maxWorkMsPerTick) != null ? budget.maxWorkMsPerTick : 3000;

    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
        return { risk0To100: 0, refactorActivityRatio: 0 };
    }

    const start = Date.now();
    let added = 0;
    let deleted = 0;
    let byFile = {};

    try {
        const stats = await getAddDeleteStats(workspaceRoot, windowDays);
        added = stats.added;
        deleted = stats.deleted;
        byFile = stats.byFile || {};
    } catch (_) {
        return { risk0To100: 0, refactorActivityRatio: 0 };
    }

    if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
        return { risk0To100: 0, refactorActivityRatio: 0 };
    }
    if (Date.now() - start > maxMs) {
        return { risk0To100: 0, refactorActivityRatio: 0 };
    }

    const refactorActivityRatio = added > 0 ? deleted / added : 0;
    const trendByModule = {};
    for (const [file, v] of Object.entries(byFile)) {
        const seg = file.split(/[/\\]/)[0] || 'root';
        if (!trendByModule[seg]) trendByModule[seg] = { added: 0, deleted: 0 };
        trendByModule[seg].added += v.added;
        trendByModule[seg].deleted += v.deleted;
    }

    const lowRatioThreshold = 0.2;
    const risk0To100 = added > 50 && refactorActivityRatio < lowRatioThreshold
        ? Math.min(100, Math.round((1 - refactorActivityRatio / lowRatioThreshold) * 60))
        : 0;

    return {
        risk0To100,
        refactorActivityRatio,
        trendByModule: Object.keys(trendByModule).length ? trendByModule : undefined
    };
}

module.exports = {
    compute,
    getAddDeleteStats
};
