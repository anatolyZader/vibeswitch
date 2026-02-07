/**
 * ImportGraph - Value type for import/require edges from a file.
 * @typedef {Object} ImportGraph
 * @property {string} filePath - Source file
 * @property {Array<{ specifier: string, source: string }>} imports - Resolved import targets
 */

function createImportGraph(filePath, imports) {
    return {
        filePath: filePath || '',
        imports: Array.isArray(imports) ? imports : []
    };
}

module.exports = { createImportGraph };
