/**
 * StructuralFingerprint - Value type for structural similarity (counts of nodes/patterns).
 * MVP: simple feature vector for comparison.
 * @typedef {Object} StructuralFingerprint
 * @property {Record<string, number>} features - e.g. { if: 2, for: 1, return: 3 }
 */

function createStructuralFingerprint(features) {
    return {
        features: features && typeof features === 'object' ? { ...features } : {}
    };
}

module.exports = { createStructuralFingerprint };
