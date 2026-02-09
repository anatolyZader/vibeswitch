/**
 * ObservabilityNeglectDetector - Flag handlers/commands/API paths that have no log/metric/trace.
 * Enforce at adapters/application layer only; pure domain may not need logging.
 */

const path = require('path');

const OBSERVABILITY_REQUIRED_SEGMENTS = ['api', 'handler', 'command', 'job', 'adapters', 'infrastructure'];
const OBSERVABILITY_REQUIRED_SUFFIXES = ['Handler.js', 'Command.js', 'Service.js', 'Controller.js', 'Job.js'];

const TELEMETRY_PATTERNS = [
    /\bconsole\.(log|info|warn|error|debug)\s*\(/,
    /\blogger\.(info|warn|error|debug|log)\s*\(/,
    /\bmetrics\./,
    /\btrace\s*\(/,
    /\bspan\./,
    /\btelemetry\./,
    /\brecordMetric\s*\(/,
    /\bstartSpan\s*\(/
];

function isObservabilityRequiredZone(filePath) {
    const p = (filePath || '').replace(/\\/g, '/').toLowerCase();
    const parts = p.split('/');
    const filename = parts.length ? parts[parts.length - 1] : '';
    for (const seg of OBSERVABILITY_REQUIRED_SEGMENTS) {
        if (parts.some(part => part.includes(seg))) return true;
    }
    for (const suffix of OBSERVABILITY_REQUIRED_SUFFIXES) {
        if (filename.endsWith(suffix)) return true;
    }
    return false;
}

function hasTelemetryInContent(content) {
    if (typeof content !== 'string') return false;
    for (const re of TELEMETRY_PATTERNS) {
        if (re.test(content)) return true;
    }
    return false;
}

/**
 * Compute observability neglect for files in required zones that lack telemetry.
 * @param {Object} ctx - { filePaths: string[], filesWithContent?: Array<{ filePath: string, content: string }> }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number, maxFilesPerCycle?: number }} [budget]
 * @returns {Promise<{ risk0To100: number, operabilityCoveragePerModule?: object, newPathsWithoutTelemetry: string[] }>}
 */
async function compute(ctx, cancelToken, budget) {
    const filesWithContent = ctx.filesWithContent || [];
    const filePaths = ctx.filePaths || filesWithContent.map(f => f.filePath).filter(Boolean);
    const contentByPath = new Map();
    for (const f of filesWithContent) {
        if (f.filePath) contentByPath.set(f.filePath.replace(/\\/g, '/'), f.content || '');
    }

    const newPathsWithoutTelemetry = [];
    const maxFiles = (budget && budget.maxFilesPerCycle) != null ? budget.maxFilesPerCycle : 100;
    const maxMs = (budget && budget.maxWorkMsPerTick) != null ? budget.maxWorkMsPerTick : 50;
    const start = Date.now();

    for (let i = 0; i < Math.min(filePaths.length, maxFiles); i++) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) break;
        if (Date.now() - start > maxMs) break;

        const filePath = filePaths[i];
        if (!isObservabilityRequiredZone(filePath)) continue;

        const content = contentByPath.get(filePath.replace(/\\/g, '/')) ?? '';
        if (!hasTelemetryInContent(content)) {
            newPathsWithoutTelemetry.push(filePath);
        }
    }

    const risk0To100 = Math.min(100, newPathsWithoutTelemetry.length * 20);
    const operabilityCoveragePerModule = {};
    for (const p of newPathsWithoutTelemetry) {
        const seg = p.split(/[/\\]/).find(s => s && s !== '.' && s !== '..') || 'root';
        operabilityCoveragePerModule[seg] = (operabilityCoveragePerModule[seg] || 0) + 1;
    }

    return {
        risk0To100,
        operabilityCoveragePerModule: Object.keys(operabilityCoveragePerModule).length ? operabilityCoveragePerModule : undefined,
        newPathsWithoutTelemetry
    };
}

module.exports = {
    compute,
    isObservabilityRequiredZone,
    hasTelemetryInContent
};
