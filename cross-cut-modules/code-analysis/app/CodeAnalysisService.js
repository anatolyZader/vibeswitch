/**
 * CodeAnalysisService - Port for AST/symbol/import analysis. Async + cancellable; uses cache.
 * Detectors call this only; they do not touch parsers directly.
 */

const { createImportGraph } = require('../domain/ImportGraph');
const { createStructuralFingerprint } = require('../domain/StructuralFingerprint');
const { createAstCache } = require('../infra/astCache');
const { extractImports, extractFunctions, computeFingerprint } = require('../infra/jsParser');

/**
 * @param {Object} deps - { readFile: (path) => Promise<{ content: string, mtime: number, size: number }>, cacheMaxEntries?: number }
 */
function createCodeAnalysisService(deps) {
    const readFile = deps.readFile;
    if (!readFile || typeof readFile !== 'function') {
        throw new Error('CodeAnalysisService requires readFile(path) => Promise<{ content, mtime, size }>');
    }
    const cache = createAstCache(deps.cacheMaxEntries);

    /**
     * Parse file and return cached result if key (path+mtime+size) matches.
     * @param {string} filePath - Absolute or relative path
     * @param {{ cancelled?: boolean }} [cancelToken] - Optional; if cancelled, throw or return null
     * @returns {Promise<{ content: string, mtime: number, size: number }|null>}
     */
    async function parseFile(filePath, cancelToken) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
            return null;
        }
        const stat = await readFile(filePath).catch(() => null);
        if (!stat || !stat.content) return null;
        return stat;
    }

    /**
     * Extract imports; result is cached by filePath + mtime + size.
     * @param {string} filePath
     * @param {{ cancelled?: boolean }} [cancelToken]
     * @returns {Promise<ImportGraph|null>}
     */
    async function getExtractImports(filePath, cancelToken) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
            return null;
        }
        const stat = await readFile(filePath).catch(() => null);
        if (!stat) return null;
        const cacheKey = filePath + '\n' + (stat.mtime ?? 0) + '\n' + (stat.size ?? 0);
        const cached = cache.get(filePath, stat.mtime, stat.size);
        if (cached && cached.importGraph) return cached.importGraph;
        const imports = extractImports(stat.content);
        const graph = createImportGraph(filePath, imports);
        cache.set(filePath, stat.mtime, stat.size, { importGraph: graph });
        return graph;
    }

    /**
     * Extract functions/symbols; cached.
     * @param {string} filePath
     * @param {{ cancelled?: boolean }} [cancelToken]
     * @returns {Promise<Array<{ name: string, kind: string, line: number }>>}
     */
    async function getExtractFunctions(filePath, cancelToken) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
            return [];
        }
        const stat = await readFile(filePath).catch(() => null);
        if (!stat) return [];
        const cached = cache.get(filePath, stat.mtime, stat.size);
        if (cached && cached.functions) return cached.functions;
        const functions = extractFunctions(stat.content);
        cache.set(filePath, stat.mtime, stat.size, { ...(cached || {}), functions });
        return functions;
    }

    /**
     * Compute structural fingerprint for content; optionally from file.
     * @param {string} filePathOrContent - If path, read file; else treat as content
     * @param {{ cancelled?: boolean }} [cancelToken]
     * @returns {Promise<StructuralFingerprint|null>}
     */
    async function getFingerprint(filePathOrContent, cancelToken) {
        if (cancelToken && (cancelToken.cancelled === true || (cancelToken.isCancelled && cancelToken.isCancelled()))) {
            return null;
        }
        let content;
        if (typeof filePathOrContent === 'string' && !filePathOrContent.includes('\n') && filePathOrContent.length < 4096) {
            const stat = await readFile(filePathOrContent).catch(() => null);
            content = stat ? stat.content : null;
        } else {
            content = filePathOrContent;
        }
        if (!content) return null;
        return createStructuralFingerprint(computeFingerprint(content));
    }

    /**
     * Compare two fingerprints (cosine-like similarity 0..1). MVP: simple overlap ratio.
     * @param {StructuralFingerprint} a
     * @param {StructuralFingerprint} b
     * @returns {number} 0..1
     */
    function compareFunctions(a, b) {
        if (!a || !b || !a.features || !b.features) return 0;
        const keys = new Set([...Object.keys(a.features), ...Object.keys(b.features)]);
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (const k of keys) {
            const va = a.features[k] || 0;
            const vb = b.features[k] || 0;
            dot += va * vb;
            normA += va * va;
            normB += vb * vb;
        }
        if (normA === 0 || normB === 0) return 0;
        return Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB)));
    }

    return {
        parseFile,
        getExtractImports,
        getExtractFunctions,
        getFingerprint,
        compareFunctions,
        clearCache: () => cache.clear()
    };
}

module.exports = { createCodeAnalysisService };
