/**
 * Symbol - Value type for a named symbol (function, class, export).
 * @typedef {Object} Symbol
 * @property {string} name - Symbol name
 * @property {string} kind - 'function' | 'class' | 'variable' | 'export'
 * @property {number} [start] - Start offset in source
 * @property {number} [end] - End offset in source
 * @property {string} [filePath] - File path
 */

function createSymbol(name, kind, start, end, filePath) {
    return {
        name: name || '',
        kind: kind || 'function',
        start,
        end,
        filePath
    };
}

module.exports = { createSymbol };
