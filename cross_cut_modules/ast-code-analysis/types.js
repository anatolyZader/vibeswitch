'use strict';

function createImportGraph(filePath, imports) {
    return { filePath: filePath || '', imports: Array.isArray(imports) ? imports : [] };
}

function createStructuralFingerprint(features) {
    return { features: features && typeof features === 'object' ? { ...features } : {} };
}

function createFunctionSignature(name, arity, filePath) {
    return { name: name || '', arity: typeof arity === 'number' ? arity : 0, filePath };
}

function createSymbol(name, kind, start, end, filePath) {
    return { name: name || '', kind: kind || 'function', start, end, filePath };
}

module.exports = {
    createImportGraph,
    createStructuralFingerprint,
    createFunctionSignature,
    createSymbol
};
