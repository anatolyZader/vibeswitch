/**
 * jsParser - Minimal JS/TS parse for extractImports and extractFunctions (MVP).
 * Regex-based; no Babel/Acorn dependency. Sufficient for boundary checks and simple symbol extraction.
 */

/**
 * Extract import/require specifiers from source.
 * @param {string} content - File content
 * @returns {Array<{ specifier: string, source: string }>} specifier = local name or '*', source = module path
 */
function extractImports(content) {
    if (!content || typeof content !== 'string') return [];
    const results = [];
    // require('...') or require("...")
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = requireRe.exec(content)) !== null) {
        results.push({ specifier: '*', source: m[1].trim() });
    }
    // import X from '...' or import '...'
    const importFromRe = /import\s+(?:(?:\*\s+as\s+\w+|\{[^}]*\}|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    while ((m = importFromRe.exec(content)) !== null) {
        results.push({ specifier: '*', source: m[2].trim() });
    }
    // import('...') dynamic
    const dynamicRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = dynamicRe.exec(content)) !== null) {
        results.push({ specifier: '*', source: m[1].trim() });
    }
    return results;
}

/**
 * Extract function/class names and approximate positions (line-based). MVP: name and kind only.
 * @param {string} content - File content
 * @returns {Array<{ name: string, kind: string, line: number }>}
 */
function extractFunctions(content) {
    if (!content || typeof content !== 'string') return [];
    const results = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // export function name / function name( / async function name(
        const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
        if (fnMatch) {
            results.push({ name: fnMatch[1], kind: 'function', line: i + 1 });
            continue;
        }
        // export class Name / class Name
        const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
        if (classMatch) {
            results.push({ name: classMatch[1], kind: 'class', line: i + 1 });
        }
    }
    return results;
}

/**
 * Simple structural fingerprint: count keywords in content (MVP).
 * @param {string} content - File content
 * @returns {Record<string, number>}
 */
function computeFingerprint(content) {
    if (!content || typeof content !== 'string') return {};
    const features = {};
    const keywords = ['if', 'for', 'while', 'return', 'try', 'await', 'throw', 'switch', 'case'];
    for (const kw of keywords) {
        const re = new RegExp('\\b' + kw + '\\b', 'g');
        const m = content.match(re);
        features[kw] = m ? m.length : 0;
    }
    return features;
}

module.exports = {
    extractImports,
    extractFunctions,
    computeFingerprint
};
