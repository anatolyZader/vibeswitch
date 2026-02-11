/**
 * Enhanced workspace context for Claude: 150K chars, project structure, git status,
 * package metadata, open files, and key source files.
 */

const path = require('path');

const MAX_CONTEXT_CHARS = 150000;
const MAX_OPEN_FILES = 20;
const MAX_KEY_FILES = 50;
const MAX_FILE_CHARS = 4000;
const MAX_TREE_FILES = 500;
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml'];

/**
 * Build a directory tree from workspace files.
 * @param {typeof import('vscode')} vscode
 * @returns {Promise<string>}
 */
async function getProjectStructure(vscode) {
    if (!vscode || !vscode.workspace) return '';
    const exclude = '{node_modules,.git,out,build,dist,**/node_modules/**}';
    try {
        const uris = await vscode.workspace.findFiles('**/*', exclude, MAX_TREE_FILES);
        const byDir = new Map();
        for (const uri of uris) {
            const rel = vscode.workspace.asRelativePath(uri);
            const parts = rel.split(/[/\\]/);
            const file = parts[parts.length - 1];
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
            if (!byDir.has(dir)) byDir.set(dir, []);
            byDir.get(dir).push(file);
        }
        const sortedDirs = [...byDir.keys()].sort();
        const lines = [];
        for (const dir of sortedDirs) {
            const files = [...new Set(byDir.get(dir))].sort();
            const prefix = dir ? dir + '/' : '';
            lines.push(prefix || '(root)');
            for (const f of files.slice(0, 15)) {
                lines.push('  ' + f);
            }
            if (files.length > 15) lines.push('  ... (' + files.length + ' files)');
        }
        return lines.join('\n') || 'Project structure unavailable.';
    } catch {
        return 'Project structure unavailable.';
    }
}

/**
 * Get git status (branch, modified, staged).
 * @param {typeof import('vscode')} vscode
 * @returns {Promise<string>}
 */
async function getGitStatus(vscode) {
    if (!vscode || !vscode.workspace) return '';
    try {
        const ext = vscode.extensions.getExtension('vscode.git');
        if (!ext || !ext.isActive) return '';
        const git = ext.exports.getAPI(1);
        if (!git) return '';
        const repo = git.repositories[0];
        if (!repo) return '';
        const state = repo.state;
        const branch = state.HEAD && state.HEAD.name ? state.HEAD.name : 'unknown';
        const changes = (state.workingTreeChanges || []).slice(0, 20).map(function (c) { return 'M ' + (c.uri.fsPath || c.uri.path); });
        const staged = (state.indexChanges || []).slice(0, 20).map(function (c) { return 'A ' + (c.uri.fsPath || c.uri.path); });
        const lines = [`Branch: ${branch}`];
        if (changes.length) lines.push('Modified: ' + changes.map((c) => c.replace(/^M /, '')).join(', '));
        if (staged.length) lines.push('Staged: ' + staged.map((c) => c.replace(/^A /, '')).join(', '));
        return lines.join('\n');
    } catch {
        return 'Git status unavailable.';
    }
}

/**
 * Get package.json metadata.
 * @param {typeof import('vscode')} vscode
 * @returns {Promise<string>}
 */
async function getProjectMetadata(vscode) {
    if (!vscode || !vscode.workspace) return '';
    try {
        const uris = await vscode.workspace.findFiles('package.json', '{node_modules/**}', 1);
        if (uris.length === 0) return '';
        const doc = await vscode.workspace.openTextDocument(uris[0]);
        const text = doc.getText();
        let pkg;
        try {
            pkg = JSON.parse(text);
        } catch {
            return '';
        }
        const lines = [
            `Name: ${pkg.name || 'unknown'}`,
            `Version: ${pkg.version || 'unknown'}`,
            `Description: ${pkg.description || 'none'}`
        ];
        if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
            lines.push('Dependencies: ' + Object.keys(pkg.dependencies).join(', '));
        }
        if (pkg.devDependencies && Object.keys(pkg.devDependencies).length) {
            lines.push('DevDependencies: ' + Object.keys(pkg.devDependencies).join(', '));
        }
        if (pkg.scripts && Object.keys(pkg.scripts).length) {
            lines.push('Scripts: ' + Object.keys(pkg.scripts).join(', '));
        }
        return lines.join('\n');
    } catch {
        return '';
    }
}

/**
 * Get enhanced read-only context for Claude.
 * @param {typeof import('vscode')} vscode
 * @param {{ includeKeyFiles?: boolean }} [opts]
 * @returns {Promise<string>}
 */
async function getEnhancedReadOnlyContext(vscode, opts) {
    const includeKeyFiles = opts && opts.includeKeyFiles !== false;
    if (!vscode || !vscode.workspace) return '';

    let totalChars = 0;
    const parts = [];

    function add(label, text) {
        if (!text || typeof text !== 'string') return;
        const block = `[${label}]\n${text}`;
        if (totalChars + block.length > MAX_CONTEXT_CHARS) return;
        parts.push(block);
        totalChars += block.length;
    }

    const structure = await getProjectStructure(vscode);
    add('Project structure', structure);

    const gitStatus = await getGitStatus(vscode);
    if (gitStatus) add('Git status', gitStatus);

    const metadata = await getProjectMetadata(vscode);
    if (metadata) add('Project metadata', metadata);

    // Open files
    const docs = vscode.workspace.textDocuments || [];
    let openCount = 0;
    for (let i = 0; i < docs.length && openCount < MAX_OPEN_FILES && totalChars < MAX_CONTEXT_CHARS; i++) {
        const doc = docs[i];
        const uri = doc.uri;
        if (!uri || uri.scheme !== 'file') continue;
        const p = uri.fsPath || '';
        if (!CODE_EXTENSIONS.some((e) => p.toLowerCase().endsWith(e))) continue;
        const name = path.basename(p) + ' (' + vscode.workspace.asRelativePath(uri) + ')';
        const text = (doc.getText && doc.getText()) || '';
        const snippet = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n...' : text;
        if (totalChars + snippet.length + name.length + 20 > MAX_CONTEXT_CHARS) break;
        parts.push(`--- Open file: ${name} ---\n${snippet}`);
        totalChars += snippet.length + name.length;
        openCount += 1;
    }

    // Key files
    if (includeKeyFiles) {
        const exclude = '{node_modules,.git,out,build,dist,**/node_modules/**}';
        const patterns = ['package.json', 'README*', '**/*.config.js', '**/business_modules/**/*.js', '**/src/**/*.js', '**/extension.js'];
        const seen = new Set();
        let keyCount = 0;
        for (const pattern of patterns) {
            if (keyCount >= MAX_KEY_FILES || totalChars >= MAX_CONTEXT_CHARS) break;
            try {
                const uris = await vscode.workspace.findFiles(pattern, exclude, MAX_KEY_FILES);
                for (const uri of uris) {
                    if (keyCount >= MAX_KEY_FILES || totalChars >= MAX_CONTEXT_CHARS) break;
                    const p = uri.fsPath || uri.path || '';
                    if (seen.has(p)) continue;
                    seen.add(p);
                    try {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const text = (doc.getText && doc.getText()) || '';
                        const snippet = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n...' : text;
                        const rel = vscode.workspace.asRelativePath(uri);
                        const block = `--- Key file: ${rel} ---\n${snippet}`;
                        if (totalChars + block.length > MAX_CONTEXT_CHARS) continue;
                        parts.push(block);
                        totalChars += block.length;
                        keyCount += 1;
                    } catch {
                        // skip
                    }
                }
            } catch {
                // skip pattern
            }
        }
    }

    return parts.join('\n\n');
}

module.exports = {
    getEnhancedReadOnlyContext,
    getProjectStructure,
    getGitStatus,
    getProjectMetadata
};
