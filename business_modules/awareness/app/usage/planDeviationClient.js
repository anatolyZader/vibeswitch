/**
 * Plan deviation client - Reads a markdown plan file (e.g. PLAN.md) with checkboxes.
 * Measures deviation from the conceptual plan (what and in which order). 0 = on track, 100 = none done.
 * Always measured against current file content.
 */

const fs = require('fs').promises;
const path = require('path');

const DEFAULT_PLAN_PATH = 'PLAN.md';

function parseCheckboxes(content) {
    let total = 0;
    let done = 0;
    const lines = (content || '').split(/\r?\n/);
    const unchecked = /\[\s?\]/;
    const checked = /\[[xX]\]/;
    for (const line of lines) {
        if (unchecked.test(line)) {
            total += 1;
        } else if (checked.test(line)) {
            total += 1;
            done += 1;
        }
    }
    return { total, done };
}

function createPlanDeviationClient(opts) {
    const getWorkspaceRoot = opts && opts.getWorkspaceRoot ? opts.getWorkspaceRoot : () => '';
    const getPlanPath = opts && opts.getPlanPath ? opts.getPlanPath : () => DEFAULT_PLAN_PATH;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    async function fetchMeasures() {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) {
            return null;
        }
        const planPath = getPlanPath();
        const fullPath = path.isAbsolute(planPath) ? planPath : path.join(workspaceRoot, planPath);
        try {
            const content = await fs.readFile(fullPath, 'utf8');
            const { total, done } = parseCheckboxes(content);
            if (total === 0) {
                return null;
            }
            const deviation0To100 = Math.round(100 * (1 - done / total));
            return {
                deviation0To100: Math.max(0, Math.min(100, deviation0To100)),
                total,
                done,
                path: planPath
            };
        } catch (err) {
            if (logger && logger.error) logger.error('Plan deviation client: read failed', err);
            return null;
        }
    }

    return { fetchMeasures };
}

module.exports = {
    createPlanDeviationClient,
    parseCheckboxes,
    DEFAULT_PLAN_PATH
};
