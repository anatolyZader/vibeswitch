/**
 * BoundaryViolationDetector - Cross-module/layer import rules (Contract: compute budget, emit events).
 * Uses code-analysis extractImports; compares to config allowlist/denylist. Emits violations to event store.
 */

const path = require('path');

/** Default rules: path-segment based. domain cannot import ui/infra; adapters cannot import domain. */
const DEFAULT_RULES = [
    { id: 'domain_no_ui_infra', fromSegment: 'domain', cannotImportSegments: ['ui', 'infra', 'adapters'] },
    { id: 'adapters_no_domain', fromSegment: 'adapter', cannotImportSegments: ['domain'] }
];

/**
 * Check if filePath belongs to a layer (by path segment).
 * @param {string} filePath
 * @param {string} segment - e.g. 'domain', 'ui'
 */
function pathHasSegment(filePath, segment) {
    const n = (filePath || '').replace(/\\/g, '/');
    const parts = n.split('/');
    return parts.some((p) => p.toLowerCase() === segment.toLowerCase());
}

/**
 * Resolve import source to a path segment for comparison (MVP: use last part of module path).
 * @param {string} importSource - e.g. '../domain/foo' or 'utils/bar'
 */
function importSourceToSegments(importSource) {
    const s = (importSource || '').replace(/\\/g, '/');
    const parts = s.split('/').filter(Boolean);
    return parts.map((p) => p.toLowerCase());
}

/**
 * Check if an import from filePath to importSource violates any rule.
 * @param {string} filePath - Path of the file that contains the import
 * @param {string} importSource - The imported module path (as in require/import)
 * @param {Array<{ id: string, fromSegment: string, cannotImportSegments: string[] }>} rules
 */
function violatesRule(filePath, importSource, rules) {
    const sourceSegments = importSourceToSegments(importSource);
    for (const rule of rules || DEFAULT_RULES) {
        if (!pathHasSegment(filePath, rule.fromSegment)) continue;
        const cannot = rule.cannotImportSegments || [];
        for (const seg of cannot) {
            if (sourceSegments.some((s) => s === seg.toLowerCase())) {
                return { ruleId: rule.id, severity: 'warn' };
            }
        }
    }
    return null;
}

/**
 * Compute boundary violations for a set of files. Respects budget (maxWorkMsPerTick, maxFilesPerCycle).
 * @param {Object} ctx - { filePaths: string[], codeAnalysisService: { getExtractImports }, rules?: array }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number, maxFilesPerCycle?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, violations: Array<{ filePath: string, importPath: string, ruleId: string }> }>}
 */
async function compute(ctx, cancelToken, budget) {
    const filePaths = ctx.filePaths || [];
    const codeAnalysisService = ctx.codeAnalysisService;
    const rules = ctx.rules || DEFAULT_RULES;
    const maxFiles = (budget && budget.maxFilesPerCycle) || 10;
    const start = Date.now();
    const maxMs = (budget && budget.maxWorkMsPerTick) || 15;

    const violations = [];
    const checked = Math.min(filePaths.length, maxFiles);

    for (let i = 0; i < checked; i++) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
            break;
        }
        if (Date.now() - start > maxMs) break;

        const filePath = filePaths[i];
        if (!codeAnalysisService || typeof codeAnalysisService.getExtractImports !== 'function') {
            continue;
        }
        const graph = await codeAnalysisService.getExtractImports(filePath, cancelToken).catch(() => null);
        if (!graph || !Array.isArray(graph.imports)) continue;

        for (const imp of graph.imports) {
            const source = imp.source || imp;
            const src = typeof source === 'string' ? source : (source.source || '');
            const v = violatesRule(filePath, src, rules);
            if (v) {
                violations.push({
                    filePath,
                    importPath: src,
                    ruleId: v.ruleId
                });
            }
        }
    }

    const severityWeight = 1;
    const risk0To100 = Math.min(100, violations.length * 25 * severityWeight);

    return {
        risk0To100,
        violations
    };
}

module.exports = {
    compute,
    violatesRule,
    DEFAULT_RULES
};
