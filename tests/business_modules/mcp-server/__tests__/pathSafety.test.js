/**
 * Tests for MCP Server path safety validation
 */

const path = require('path');
const fs = require('fs');

// Extract path safety logic for testing
const BLOCKLIST_DIRS = ['.git', '.cursor', 'node_modules', '.vibeswitch'];
const BLOCKLIST_FILES = ['.env', 'credentials.json', 'secrets.json'];

function realpath(p) {
    try { return fs.realpathSync(p); } catch { return p; }
}

function isPathSafe(workspaceRoot, filePath) {
    const resolved = path.resolve(workspaceRoot, filePath);
    const realResolved = realpath(path.dirname(resolved));
    const realWorkspace = realpath(workspaceRoot);
    
    if (!realResolved.startsWith(realWorkspace + path.sep) && realResolved !== realWorkspace) {
        return { safe: false, reason: 'Path escapes workspace' };
    }
    
    const relative = path.relative(realWorkspace, resolved);
    for (const blocked of BLOCKLIST_DIRS) {
        if (relative.startsWith(blocked + path.sep) || relative === blocked) {
            return { safe: false, reason: `Cannot modify ${blocked}/` };
        }
    }
    
    if (BLOCKLIST_FILES.includes(path.basename(resolved))) {
        return { safe: false, reason: `Cannot modify ${path.basename(resolved)}` };
    }
    
    return { safe: true, resolved };
}

describe('Path Safety Validation', () => {
    const workspaceRoot = '/home/user/project';

    describe('isPathSafe', () => {
        it('should allow normal file paths', () => {
            const result = isPathSafe(workspaceRoot, 'src/index.js');
            expect(result.safe).toBe(true);
            expect(result.resolved).toBe(path.join(workspaceRoot, 'src/index.js'));
        });

        it('should allow deeply nested paths', () => {
            const result = isPathSafe(workspaceRoot, 'src/components/ui/Button.js');
            expect(result.safe).toBe(true);
        });

        it('should block path traversal with ../', () => {
            const result = isPathSafe(workspaceRoot, '../../../etc/passwd');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Path escapes workspace');
        });

        it('should block .git directory', () => {
            const result = isPathSafe(workspaceRoot, '.git/config');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify .git/');
        });

        it('should block .cursor directory', () => {
            const result = isPathSafe(workspaceRoot, '.cursor/settings.json');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify .cursor/');
        });

        it('should block node_modules directory', () => {
            const result = isPathSafe(workspaceRoot, 'node_modules/lodash/index.js');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify node_modules/');
        });

        it('should block .vibeswitch directory', () => {
            const result = isPathSafe(workspaceRoot, '.vibeswitch/token.json');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify .vibeswitch/');
        });

        it('should block .env file', () => {
            const result = isPathSafe(workspaceRoot, '.env');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify .env');
        });

        it('should block credentials.json', () => {
            const result = isPathSafe(workspaceRoot, 'credentials.json');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify credentials.json');
        });

        it('should block secrets.json', () => {
            const result = isPathSafe(workspaceRoot, 'config/secrets.json');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Cannot modify secrets.json');
        });

        it('should allow files with similar names to blocked files', () => {
            const result = isPathSafe(workspaceRoot, 'my.env.example');
            expect(result.safe).toBe(true);
        });

        it('should allow directories with similar names to blocked dirs', () => {
            const result = isPathSafe(workspaceRoot, 'git-tools/helper.js');
            expect(result.safe).toBe(true);
        });
    });
});
