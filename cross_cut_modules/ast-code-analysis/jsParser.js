'use strict';

const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const IMPORT_FROM_RE = /import\s+(?:(?:\*\s+as\s+\w+|\{[^}]*\}|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const KEYWORDS = ['if', 'for', 'while', 'return', 'try', 'await', 'throw', 'switch', 'case'];

function extractImports(content) {
    if (!content || typeof content !== 'string') return [];
    const out = [];
    let m;
    REQUIRE_RE.lastIndex = 0;
    while ((m = REQUIRE_RE.exec(content)) !== null) out.push({ specifier: '*', source: m[1].trim() });
    IMPORT_FROM_RE.lastIndex = 0;
    while ((m = IMPORT_FROM_RE.exec(content)) !== null) out.push({ specifier: '*', source: m[2].trim() });
    DYNAMIC_RE.lastIndex = 0;
    while ((m = DYNAMIC_RE.exec(content)) !== null) out.push({ specifier: '*', source: m[1].trim() });
    return out;
}

function extractFunctions(content) {
    if (!content || typeof content !== 'string') return [];
    const out = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const fn = lines[i].match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
        if (fn) { out.push({ name: fn[1], kind: 'function', line: i + 1 }); continue; }
        const cl = lines[i].match(/(?:export\s+)?class\s+(\w+)/);
        if (cl) out.push({ name: cl[1], kind: 'class', line: i + 1 });
    }
    return out;
}

function computeFingerprint(content) {
    if (!content || typeof content !== 'string') return {};
    const features = {};
    for (const kw of KEYWORDS) {
        const re = new RegExp('\\b' + kw + '\\b', 'g');
        const m = content.match(re);
        features[kw] = m ? m.length : 0;
    }
    return features;
}

module.exports = { extractImports, extractFunctions, computeFingerprint };
