/**
 * Rule Assembler - Builds effective Cursor rules from common + mode layers
 *
 * At mode-switch the extension builds one effective rules text by concatenating:
 * common -> mode. Conventions: common = invariants/defaults; mode = behavior deltas.
 * No formal override semantics; Cursor rules are plain text.
 *
 * Cache: per-file, bounded (one entry per file path). Re-read when mtime changes.
 *
 * @see docs / ChatGPT conversation: split rules into common + mode deltas, assemble at runtime
 */

const fs = require('fs').promises;
const path = require('path');

/** Per-file cache: filePath -> { mtimeMs, text }. Constant-size (one entry per rule file). */
const cache = new Map();

/**
 * Read a rule file with per-file mtime cache (bounded; re-read when mtime changes).
 * @param {string} cursorDir - Absolute path to .cursor directory
 * @param {string} fileName - File name only (e.g. 'rules.common.md')
 * @returns {Promise<string>} File content
 */
async function readCached(cursorDir, fileName) {
    const filePath = path.join(cursorDir, fileName);
    let stat;
    try {
        stat = await fs.stat(filePath);
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error(`Rule file not found: .cursor/${fileName}`);
        }
        throw err;
    }
    const entry = cache.get(filePath);
    if (entry && entry.mtimeMs === stat.mtimeMs) {
        return entry.text;
    }
    let text = await fs.readFile(filePath, 'utf8');
    text = text.replace(/\r\n/g, '\n');
    cache.set(filePath, { mtimeMs: stat.mtimeMs, text });
    return text;
}

/**
 * Assemble effective rules from common + mode (deterministic order).
 * @param {Object} options
 * @param {string} options.cursorDir - Absolute path to workspace .cursor directory
 * @param {string} options.mode - 'dev' or 'vibe'
 * @returns {Promise<string>} Full effective rules text to write to .cursor/rules.md
 */
async function assembleRules(options) {
    const { cursorDir, mode } = options;

    if (mode !== 'dev' && mode !== 'vibe') {
        throw new Error(`ruleAssembler: invalid mode "${mode}"`);
    }

    const common = await readCached(cursorDir, 'rules.common.md');
    const modeFile = mode === 'dev' ? 'rules.dev.md' : 'rules.vibe.md';
    const modeRules = await readCached(cursorDir, modeFile);

    const modeLabel = mode.toUpperCase();
    const parts = [
        `EFFECTIVE RULES\nmode: ${modeLabel}\nlayers: common -> ${mode}\n`,
        `--- BEGIN COMMON ---\n${common}\n--- END COMMON ---\n`,
        `--- BEGIN ${modeLabel} MODE ---\n${modeRules}\n--- END ${modeLabel} MODE ---\n`
    ];

    const out = parts.join('\n');
    return out.endsWith('\n') ? out : out + '\n';
}

/**
 * Clear the in-memory rule file cache (e.g. after workspace config change).
 * Useful for tests or if rule files are edited and should be re-read.
 */
function clearCache() {
    cache.clear();
}

module.exports = {
    assembleRules,
    readCached,
    clearCache
};
