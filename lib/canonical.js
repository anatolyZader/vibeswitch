/**
 * RFC 8785-style canonical JSON for consistent signing (Ed25519 tokens).
 * toCanonicalJSON / fromCanonicalJSON; object keys sorted, no whitespace.
 */

function canonicalize(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return JSON.stringify(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) {
        return '[' + value.map(v => canonicalize(v)).join(',') + ']';
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value).sort();
        const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k]));
        return '{' + pairs.join(',') + '}';
    }
    return undefined;
}

function toCanonicalJSON(obj) {
    return canonicalize(obj);
}

function fromCanonicalJSON(json) {
    return JSON.parse(json);
}

module.exports = {
    canonicalize,
    toCanonicalJSON,
    fromCanonicalJSON
};
