/**
 * ESLint measures client - Runs ESLint on workspace (Node API) and returns aggregate
 * error/warning counts for research and dashboard. No analysis in the extension.
 */

const DEFAULT_PATTERNS = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'];
const DEFAULT_TIMEOUT_MS = 30000;

function unreachable() {
    return {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        eslintApiAvailable: false
    };
}

/**
 * Create an ESLint measures client.
 * @param {Object} opts - { getWorkspaceRoot: () => string, timeoutMs?: number, patterns?: string[], loggerPort?: { error } }
 */
function createEslintMeasuresClient(opts) {
    const getWorkspaceRoot = opts && opts.getWorkspaceRoot ? opts.getWorkspaceRoot : () => '';
    const timeoutMs = (opts && opts.timeoutMs) != null ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    const patterns = (opts && opts.patterns) && Array.isArray(opts.patterns) && opts.patterns.length > 0
        ? opts.patterns
        : DEFAULT_PATTERNS;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    async function fetchMeasures() {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) {
            return unreachable();
        }
        let ESLint;
        try {
            ESLint = require('eslint').ESLint;
        } catch (_) {
            return unreachable();
        }
        if (!ESLint) {
            return unreachable();
        }
        const run = async () => {
            const eslint = new ESLint({ cwd: workspaceRoot });
            const results = await eslint.lintFiles(patterns);
            let errorCount = 0;
            let warningCount = 0;
            let fixableErrorCount = 0;
            let fixableWarningCount = 0;
            for (const r of results) {
                errorCount += r.errorCount || 0;
                warningCount += r.warningCount || 0;
                fixableErrorCount += r.fixableErrorCount || 0;
                fixableWarningCount += r.fixableWarningCount || 0;
            }
            return {
                errorCount,
                warningCount,
                fixableErrorCount,
                fixableWarningCount,
                eslintApiAvailable: true
            };
        };
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('ESLint timeout')), timeoutMs);
        });
        try {
            return await Promise.race([run(), timeoutPromise]);
        } catch (err) {
            if (logger && logger.error) logger.error('ESLint measures failed', err);
            return unreachable();
        }
    }

    return { fetchMeasures };
}

module.exports = {
    createEslintMeasuresClient,
    DEFAULT_PATTERNS,
    DEFAULT_TIMEOUT_MS
};
