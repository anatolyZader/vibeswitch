/**
 * Read-only workspace context: open documents + optional key files via findFiles.
 * Uses only getText, findFiles, openTextDocument. No writes or executeCommand.
 */

const MAX_CONTEXT_CHARS = 16000;
const MAX_OPEN_FILES = 8;
const MAX_FILE_CHARS = 2000;
const MAX_KEY_FILES = 25;
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.md'];

/**
 * @param {typeof import('vscode')} vscode - VS Code API
 * @param {{ includeKeyFiles?: boolean }} [opts] - includeKeyFiles: use findFiles for package.json, README, etc. Default true.
 * @returns {Promise<string>} Context string (snippets from open + key files), capped
 */
async function getReadOnlyContext(vscode, opts) {
    const includeKeyFiles = opts && opts.includeKeyFiles !== false;
    if (!vscode || !vscode.workspace) return '';

    let totalChars = 0;
    const parts = [];

    function addSnippet(label, name, text) {
        if (!text || typeof text !== 'string') return;
        const snippet = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n...' : text;
        if (totalChars + snippet.length > MAX_CONTEXT_CHARS) return;
        parts.push('--- ' + label + ': ' + name + ' ---\n' + snippet);
        totalChars += snippet.length;
    }

    const docs = vscode.workspace.textDocuments || [];
    let openCount = 0;
    for (let i = 0; i < docs.length; i++) {
        if (totalChars >= MAX_CONTEXT_CHARS || openCount >= MAX_OPEN_FILES) break;
        const doc = docs[i];
        const uri = doc.uri;
        if (!uri || uri.scheme !== 'file') continue;
        const path = uri.fsPath || '';
        if (!CODE_EXTENSIONS.some(function (e) { return path.toLowerCase().endsWith(e); })) continue;
        const text = doc.getText && doc.getText();
        if (!text) continue;
        const name = path.split(/[/\\]/).pop() || 'file';
        addSnippet('open', name, text);
        openCount += 1;
    }

    if (includeKeyFiles && vscode.workspace.findFiles) {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length > 0) {
            const exclude = '{node_modules,.git,out,build,dist,**/node_modules/**}';
            try {
                const uris = await vscode.workspace.findFiles('package.json', exclude, 1);
                const uris2 = await vscode.workspace.findFiles('README*', exclude, 3);
                const uris3 = await vscode.workspace.findFiles('**/*.js', exclude, Math.min(MAX_KEY_FILES - 4, 15));
                const allUris = uris.concat(uris2).concat(uris3);
                const seen = new Set();
                let keyCount = 0;
                for (let j = 0; j < allUris.length; j++) {
                    if (keyCount >= MAX_KEY_FILES || totalChars >= MAX_CONTEXT_CHARS) break;
                    const uri = allUris[j];
                    const path = uri.fsPath || uri.path || '';
                    if (seen.has(path)) continue;
                    seen.add(path);
                    try {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const text = doc.getText && doc.getText();
                        if (!text) continue;
                        const name = path.split(/[/\\]/).pop() || path;
                        addSnippet('file', name, text);
                        keyCount += 1;
                    } catch (err) {
                        // skip if cannot open
                    }
                }
            } catch (err) {
                // findFiles or openTextDocument failed
            }
        }
    }

    if (parts.length === 0) return '';
    return parts.join('\n\n');
}

module.exports = {
    getReadOnlyContext
};
