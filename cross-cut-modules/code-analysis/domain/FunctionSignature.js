/**
 * FunctionSignature - Value type for function signature (name, params, return).
 * MVP: name and arity only.
 * @typedef {Object} FunctionSignature
 * @property {string} name
 * @property {number} arity
 * @property {string} [filePath]
 */

function createFunctionSignature(name, arity, filePath) {
    return {
        name: name || '',
        arity: typeof arity === 'number' ? arity : 0,
        filePath
    };
}

module.exports = { createFunctionSignature };
