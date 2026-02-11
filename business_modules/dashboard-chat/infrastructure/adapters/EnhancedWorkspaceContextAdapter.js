/**
 * Enhanced read-only workspace context with deep codebase awareness.
 * Optimized for Claude's large context window (200K tokens).
 * Provides: project structure, git status, open files, key files, dependencies, and more.
 */

const path = require('path');

// Context limits - much higher for Claude's large context window
const MAX_CONTEXT_CHARS_CLAUDE = 150000;  // ~37K tokens for Claude
const MAX_CONTEXT_CHARS_DEFAULT = 16000;   // Conservative for smaller models
const MAX_OPEN_FILES = 20;
const MAX_FILE_CHARS = 4000;
const MAX_KEY_FILES = 50;
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.md', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'];

/**
 * Get project structure tree (directories and files)
 * @param {typeof import('vscode')} vscode
 * @returns {Promise<string>}
 */
async function getProjectStructure(vscode) {
    if (!vscode || !vscode.workspace || !vscode.workspace.findFiles) return '';
    
    try {
        const exclude = '{node_modules/**,.git/**,out/**,build/**,dist/**,coverage/**,.next/**,.vscode/**}';
        const files = await vscode.workspace.findFiles('**/*', exclude, 500);
        
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';
        const tree = {};
        
        files.forEach(uri => {
            const filePath = uri.fsPath || uri.path || '';
            const relativePath = workspaceRoot ? filePath.replace(workspaceRoot, '').replace(/^[/\\]/, '') : filePath;
            const parts = relativePath.split(/[/\\]/);
            
            let current = tree;
            parts.forEach((part, idx) => {
                if (!current[part]) {
                    current[part] = idx === parts.length - 1 ? null : {};
                }
                if (current[part] !== null) {
                    current = current[part];
                }
            });
        });
        
        function formatTree(obj, indent = '') {
            const lines = [];
            const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
            
            for (const [key, value] of entries) {
                if (value === null) {
                    lines.push(indent + '├─ ' + key);
                } else {
                    lines.push(indent + '├─ ' + key + '/');
                    if (Object.keys(value).length > 0 && indent.length < 20) {
                        lines.push(...formatTree(value, indent + '│  '));
                    }
                }
            }
            return lines;
        }
        
        const treeLines = formatTree(tree);
        return '[Project Structure]\n' + treeLines.slice(0, 100).join('\n');
    } catch (err) {
        return '';
    }
}

/**
 * Get git status and recent changes
 * @param {typeof import('vscode')} vscode
 * @returns {Promise<string>}
 */
async function getGitContext(vscode) {
    if (!vscode || !vscode.workspace) return '';
    
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) return '';
        
        // Try to get git extension API
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) return '';
        
        const git = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
        const api = git?.getAPI?.(1);
        if (!api || api.repositories.length === 0) return '';
        
        const repo = api.repositories[0];
        const state = repo.state;
        
        const lines = ['[Git Status]'];
        lines.push(`Branch: ${state.HEAD?.name || 'unknown'}`);
        
        if (state.workingTreeChanges?.length > 0) {
            lines.push(`Modified files (${state.workingTreeChanges.length}):`);
            state.workingTreeChanges.slice(0, 20).forEach(change => {
                const status = change.status === 0 ? 'M' : change.status === 1 ? 'D' : change.status === 6 ? 'A' : '?';
                const filePath = change.uri.fsPath.replace(workspaceRoot, '').replace(/^[/\\]/, '');
                lines.push(`  ${status} ${filePath}`);
            });
        }
        
        if (state.indexChanges?.length > 0) {
            lines.push(`Staged files (${state.indexChanges.length}):`);
            state.indexChanges.slice(0, 10).forEach(change => {
                const filePath = change.uri.fsPath.replace(workspaceRoot, '').replace(/^[/\\]/, '');
                lines.push(`  ${filePath}`);
            });
        }
        
        return lines.join('\n');
    } catch (err) {
        return '';
    }
}

/**
 * Get package.json dependencies and project metadata
 * @param {typeof import('vscode')} vscode
 * @returns {Promise<string>}
 */
async function getProjectMetadata(vscode) {
    if (!vscode || !vscode.workspace || !vscode.workspace.findFiles) return '';
    
    try {
        const exclude = '{node_modules/**,.git/**}';
        const packageJsonUris = await vscode.workspace.findFiles('package.json', exclude, 1);
        
        if (packageJsonUris.length === 0) return '';
        
        const doc = await vscode.workspace.openTextDocument(packageJsonUris[0]);
        const text = doc.getText();
        const pkg = JSON.parse(text);
        
        const lines = ['[Project Metadata]'];
        lines.push(`Name: ${pkg.name || 'unknown'}`);
        lines.push(`Version: ${pkg.version || 'unknown'}`);
        lines.push(`Description: ${pkg.description || 'none'}`);
        
        if (pkg.dependencies) {
            lines.push(`Dependencies (${Object.keys(pkg.dependencies).length}): ${Object.keys(pkg.dependencies).slice(0, 15).join(', ')}`);
        }
        
        if (pkg.devDependencies) {
            lines.push(`DevDependencies (${Object.keys(pkg.devDependencies).length}): ${Object.keys(pkg.devDependencies).slice(0, 10).join(', ')}`);
        }
        
        if (pkg.scripts) {
            lines.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
        }
        
        return lines.join('\n');
    } catch (err) {
        return '';
    }
}

/**
 * Get enhanced read-only context with deep codebase awareness
 * @param {typeof import('vscode')} vscode - VS Code API
 * @param {{ includeKeyFiles?: boolean, enhancedMode?: boolean, provider?: string }} [opts]
 * @returns {Promise<string>} Enhanced context string
 */
async function getEnhancedReadOnlyContext(vscode, opts) {
    const includeKeyFiles = opts && opts.includeKeyFiles !== false;
    const enhancedMode = opts && opts.enhancedMode !== false;
    const provider = opts && opts.provider || 'openai';
    
    // Use larger context window for Claude
    const MAX_CONTEXT_CHARS = provider === 'claude' ? MAX_CONTEXT_CHARS_CLAUDE : MAX_CONTEXT_CHARS_DEFAULT;
    
    if (!vscode || !vscode.workspace) return '';

    let totalChars = 0;
    const sections = [];

    function addSection(content) {
        if (!content || typeof content !== 'string') return;
        if (totalChars + content.length > MAX_CONTEXT_CHARS) {
            const remaining = MAX_CONTEXT_CHARS - totalChars;
            if (remaining > 100) {
                sections.push(content.slice(0, remaining) + '\n...[truncated]');
                totalChars = MAX_CONTEXT_CHARS;
            }
            return;
        }
        sections.push(content);
        totalChars += content.length;
    }

    // Add project structure (if enhanced mode)
    if (enhancedMode && provider === 'claude') {
        const structure = await getProjectStructure(vscode);
        if (structure) {
            addSection(structure);
        }
    }

    // Add project metadata
    if (enhancedMode) {
        const metadata = await getProjectMetadata(vscode);
        if (metadata) {
            addSection(metadata);
        }
    }

    // Add git context
    if (enhancedMode && provider === 'claude') {
        const gitContext = await getGitContext(vscode);
        if (gitContext) {
            addSection(gitContext);
        }
    }

    // Add open files
    const openFiles = [];
    const docs = vscode.workspace.textDocuments || [];
    let openCount = 0;
    
    for (let i = 0; i < docs.length; i++) {
        if (totalChars >= MAX_CONTEXT_CHARS || openCount >= MAX_OPEN_FILES) break;
        const doc = docs[i];
        const uri = doc.uri;
        if (!uri || uri.scheme !== 'file') continue;
        const filePath = uri.fsPath || '';
        if (!CODE_EXTENSIONS.some(e => filePath.toLowerCase().endsWith(e))) continue;
        const text = doc.getText && doc.getText();
        if (!text) continue;
        
        const fileName = filePath.split(/[/\\]/).pop() || 'file';
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';
        const relativePath = workspaceRoot ? filePath.replace(workspaceRoot, '').replace(/^[/\\]/, '') : fileName;
        
        const snippet = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n...[truncated]' : text;
        openFiles.push(`--- Open File: ${relativePath} ---\n${snippet}`);
        totalChars += snippet.length;
        openCount += 1;
    }

    if (openFiles.length > 0) {
        addSection('[Open Files]\n' + openFiles.join('\n\n'));
    }

    // Add key files from workspace
    if (includeKeyFiles && vscode.workspace.findFiles) {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length > 0) {
            const exclude = '{node_modules/**,.git/**,out/**,build/**,dist/**}';
            const keyFiles = [];
            
            try {
                // Prioritize important files
                const packageJson = await vscode.workspace.findFiles('package.json', exclude, 1);
                const readmes = await vscode.workspace.findFiles('README*', exclude, 3);
                const configs = await vscode.workspace.findFiles('*.config.{js,ts,json}', exclude, 5);
                const sourceFiles = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', exclude, Math.min(MAX_KEY_FILES - 10, 40));
                
                const allUris = [...packageJson, ...readmes, ...configs, ...sourceFiles];
                const seen = new Set();
                let keyCount = 0;
                
                for (const uri of allUris) {
                    if (keyCount >= MAX_KEY_FILES || totalChars >= MAX_CONTEXT_CHARS) break;
                    const filePath = uri.fsPath || uri.path || '';
                    if (seen.has(filePath)) continue;
                    seen.add(filePath);
                    
                    try {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const text = doc.getText && doc.getText();
                        if (!text) continue;
                        
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';
                        const relativePath = workspaceRoot ? filePath.replace(workspaceRoot, '').replace(/^[/\\]/, '') : filePath.split(/[/\\]/).pop();
                        
                        const snippet = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n...[truncated]' : text;
                        keyFiles.push(`--- File: ${relativePath} ---\n${snippet}`);
                        totalChars += snippet.length;
                        keyCount += 1;
                    } catch (err) {
                        // skip if cannot open
                    }
                }
                
                if (keyFiles.length > 0) {
                    addSection('[Key Files]\n' + keyFiles.join('\n\n'));
                }
            } catch (err) {
                // findFiles or openTextDocument failed
            }
        }
    }

    if (sections.length === 0) return '';
    return sections.join('\n\n');
}

module.exports = {
    getEnhancedReadOnlyContext,
    getProjectStructure,
    getGitContext,
    getProjectMetadata
};
