'use strict';

const { createImportGraph, createStructuralFingerprint } = require('./types');
const { createAstCache } = require('./astCache');
const { extractImports, extractFunctions, computeFingerprint } = require('./jsParser');

const cancelled = (t) => t && (t.cancelled === true || (t.isCancelled && t.isCancelled()));

function createAstCodeAnalysisService(deps) {
    const { readFile, cacheMaxEntries } = deps;
    if (!readFile || typeof readFile !== 'function') {
        throw new Error('AstCodeAnalysisService requires readFile(path) => Promise<{ content, mtime, size }>');
    }
    const cache = createAstCache(cacheMaxEntries);

    async function parseFile(filePath, cancelToken) {
        if (cancelled(cancelToken)) return null;
        const stat = await readFile(filePath).catch(() => null);
        return stat && stat.content ? stat : null;
    }

    async function getExtractImports(filePath, cancelToken) {
        if (cancelled(cancelToken)) return null;
        const stat = await readFile(filePath).catch(() => null);
        if (!stat) return null;
        const c = cache.get(filePath, stat.mtime, stat.size);
        if (c && c.importGraph) return c.importGraph;
        const graph = createImportGraph(filePath, extractImports(stat.content));
        cache.set(filePath, stat.mtime, stat.size, { ...c, importGraph: graph });
        return graph;
    }

    async function getExtractFunctions(filePath, cancelToken) {
        if (cancelled(cancelToken)) return [];
        const stat = await readFile(filePath).catch(() => null);
        if (!stat) return [];
        const c = cache.get(filePath, stat.mtime, stat.size);
        if (c && c.functions) return c.functions;
        const functions = extractFunctions(stat.content);
        cache.set(filePath, stat.mtime, stat.size, { ...c, functions });
        return functions;
    }

    async function getFingerprint(filePathOrContent, cancelToken) {
        if (cancelled(cancelToken)) return null;
        let content;
        const looksLikePath = typeof filePathOrContent === 'string' && !filePathOrContent.includes('\n') && filePathOrContent.length < 4096;
        if (looksLikePath) {
            const stat = await readFile(filePathOrContent).catch(() => null);
            content = stat ? stat.content : null;
        } else {
            content = filePathOrContent;
        }
        if (!content) return null;
        return createStructuralFingerprint(computeFingerprint(content));
    }

    function compareFunctions(a, b) {
        if (!a?.features || !b?.features) return 0;
        const keys = new Set([...Object.keys(a.features), ...Object.keys(b.features)]);
        let dot = 0, normA = 0, normB = 0;
        for (const k of keys) {
            const va = a.features[k] || 0, vb = b.features[k] || 0;
            dot += va * vb;
            normA += va * va;
            normB += vb * vb;
        }
        return normA === 0 || normB === 0 ? 0 : Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB)));
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

module.exports = { createAstCodeAnalysisService };
