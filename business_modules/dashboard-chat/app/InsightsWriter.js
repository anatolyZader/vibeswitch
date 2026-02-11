/**
 * InsightsWriter: safe creation of markdown review/insight files in insights/ directory.
 * Only creates new files; never overwrites. Validates filenames and content.
 */

const fs = require('fs');
const path = require('path');

const INSIGHTS_DIR = 'insights';
const MAX_CONTENT_BYTES = 500 * 1024; // 500KB
// Generated names: base_timestamp.md (e.g. architecture-review_2026-02-11T14-30-45-123Z.md)
const FILENAME_REGEX = /^[a-zA-Z0-9_\-TZ]+\.md$/;
const MALICIOUS_PATTERNS = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /vbscript:/i
];

/**
 * @param {string} extensionPath - Absolute path to extension root
 * @returns {string} Absolute path to insights directory
 */
function getInsightsDir(extensionPath) {
    return path.join(extensionPath, 'business_modules', 'dashboard-chat', INSIGHTS_DIR);
}

/**
 * @param {string} baseName - Desired base filename (e.g. "architecture-review")
 * @returns {string} Filename with timestamp
 */
function generateFilename(baseName) {
    const safe = (baseName || 'insight').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80);
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${safe}_${ts}.md`;
}

/**
 * @param {string} content
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateContent(content) {
    if (typeof content !== 'string') return { safe: false, reason: 'Content must be a string' };
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
        return { safe: false, reason: 'Content exceeds 500KB limit' };
    }
    for (const pat of MALICIOUS_PATTERNS) {
        if (pat.test(content)) return { safe: false, reason: 'Content contains disallowed pattern' };
    }
    return { safe: true };
}

/**
 * @param {string} filename
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateFilename(filename) {
    if (typeof filename !== 'string') return { valid: false, reason: 'Filename must be a string' };
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return { valid: false, reason: 'Path traversal not allowed' };
    }
    if (!FILENAME_REGEX.test(filename)) {
        return { valid: false, reason: 'Filename must match [a-zA-Z0-9_-]+\\.md' };
    }
    return { valid: true };
}

/**
 * @param {string} extensionPath
 * @param {string} filename
 * @param {string} content
 * @param {{ title?: string, provider?: string }} [meta]
 * @returns {Promise<{ success: boolean, path?: string, error?: string }>}
 */
async function writeInsight(extensionPath, filename, content, meta) {
    const dir = getInsightsDir(extensionPath);
    const name = generateFilename(filename);

    const fnCheck = validateFilename(name);
    if (!fnCheck.valid) return { success: false, error: fnCheck.reason };

    const contentCheck = validateContent(content);
    if (!contentCheck.safe) return { success: false, error: contentCheck.reason };

    const fullPath = path.join(dir, name);
    if (fs.existsSync(fullPath)) return { success: false, error: 'File already exists' };

    const header = [
        '---',
        'title: ' + (meta && meta.title ? meta.title : filename),
        'created: ' + new Date().toISOString(),
        'provider: ' + (meta && meta.provider ? meta.provider : 'unknown'),
        'createdBy: dashboard-chat',
        '---',
        '',
        content
    ].join('\n');

    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tempPath = fullPath + '.tmp.' + Date.now();
        fs.writeFileSync(tempPath, header, 'utf8');
        fs.renameSync(tempPath, fullPath);
        const relPath = path.relative(extensionPath, fullPath);
        return { success: true, path: relPath };
    } catch (err) {
        return { success: false, error: err.message || 'Write failed' };
    }
}

/**
 * @param {string} extensionPath
 * @returns {string[]}
 */
function listInsights(extensionPath) {
    const dir = getInsightsDir(extensionPath);
    if (!fs.existsSync(dir)) return [];
    try {
        return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
        return [];
    }
}

module.exports = {
    getInsightsDir,
    generateFilename,
    validateContent,
    validateFilename,
    writeInsight,
    listInsights
};
