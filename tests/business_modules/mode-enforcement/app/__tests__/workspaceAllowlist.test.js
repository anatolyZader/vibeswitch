/**
 * Tests for WorkspaceAllowlist
 * 
 * Manages list of trusted workspace roots for MCP server validation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('fs');

const WorkspaceAllowlist = require('../../../../../business_modules/mode-enforcement/app/workspaceAllowlist');

describe('WorkspaceAllowlist', () => {
    const STATE_DIR = path.join(os.homedir(), '.vibeswitch', 'state');
    const WORKSPACES_FILE = path.join(STATE_DIR, 'workspaces.json');

    beforeEach(() => {
        jest.clearAllMocks();
        
        fs.existsSync.mockReturnValue(true);
        fs.writeFileSync.mockImplementation(() => {});
        fs.renameSync.mockImplementation(() => {});
        fs.mkdirSync.mockImplementation(() => {});
        fs.readFileSync.mockReturnValue(JSON.stringify({ workspaces: [] }));
        fs.realpathSync.mockImplementation(p => p);
    });

    describe('constructor', () => {
        it('should create state directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            
            new WorkspaceAllowlist();
            
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('state'),
                { recursive: true }
            );
        });
    });

    describe('load', () => {
        it('should return empty array if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.load()).toEqual([]);
        });

        it('should return workspaces from file', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/path/to/workspace1', '/path/to/workspace2']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.load()).toEqual(['/path/to/workspace1', '/path/to/workspace2']);
        });

        it('should return empty array on JSON parse error', () => {
            fs.readFileSync.mockReturnValue('invalid json');
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.load()).toEqual([]);
        });

        it('should return empty array if workspaces is not an array', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({ workspaces: 'not-array' }));
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.load()).toEqual([]);
        });
    });

    describe('save', () => {
        it('should write workspaces to file', () => {
            const allowlist = new WorkspaceAllowlist();
            
            allowlist.save(['/path/to/workspace']);
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('"/path/to/workspace"'),
                'utf8'
            );
        });

        it('should use atomic write (temp + rename)', () => {
            const allowlist = new WorkspaceAllowlist();
            
            allowlist.save(['/workspace']);
            
            expect(fs.renameSync).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('workspaces.json')
            );
        });

        it('should include updatedAt timestamp', () => {
            const allowlist = new WorkspaceAllowlist();
            
            allowlist.save(['/workspace']);
            
            const writeCall = fs.writeFileSync.mock.calls[0];
            const content = JSON.parse(writeCall[1]);
            expect(content.updatedAt).toBeDefined();
        });
    });

    describe('add', () => {
        it('should add new workspace to allowlist', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({ workspaces: [] }));
            const allowlist = new WorkspaceAllowlist();
            
            const result = allowlist.add('/new/workspace');
            
            expect(result).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('/new/workspace'),
                'utf8'
            );
        });

        it('should not add duplicate workspace', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/existing/workspace']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            const result = allowlist.add('/existing/workspace');
            
            expect(result).toBe(false);
        });

        it('should resolve path with realpath before adding', () => {
            fs.realpathSync.mockReturnValue('/resolved/path');
            fs.readFileSync.mockReturnValue(JSON.stringify({ workspaces: [] }));
            const allowlist = new WorkspaceAllowlist();
            
            allowlist.add('/symlink/path');
            
            expect(fs.realpathSync).toHaveBeenCalledWith('/symlink/path');
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('/resolved/path'),
                'utf8'
            );
        });
    });

    describe('remove', () => {
        it('should remove workspace from allowlist', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/workspace1', '/workspace2']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            const result = allowlist.remove('/workspace1');
            
            expect(result).toBe(true);
        });

        it('should return false if workspace not in list', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/workspace1']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            const result = allowlist.remove('/nonexistent');
            
            expect(result).toBe(false);
        });
    });

    describe('contains', () => {
        it('should return true if workspace is in allowlist', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/workspace1', '/workspace2']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.contains('/workspace1')).toBe(true);
        });

        it('should return false if workspace is not in allowlist', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/workspace1']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.contains('/other')).toBe(false);
        });

        it('should resolve path before checking', () => {
            fs.realpathSync.mockReturnValue('/resolved');
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/resolved']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            expect(allowlist.contains('/symlink')).toBe(true);
        });
    });

    describe('syncFromWorkspace', () => {
        it('should add all workspace folders to allowlist', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({ workspaces: [] }));
            const allowlist = new WorkspaceAllowlist();
            
            const workspaceFolders = [
                { uri: { fsPath: '/workspace1' } },
                { uri: { fsPath: '/workspace2' } }
            ];
            
            allowlist.syncFromWorkspace(workspaceFolders);
            
            const writeCall = fs.writeFileSync.mock.calls[0];
            const content = JSON.parse(writeCall[1]);
            expect(content.workspaces).toContain('/workspace1');
            expect(content.workspaces).toContain('/workspace2');
        });

        it('should not duplicate existing workspaces', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({
                workspaces: ['/workspace1']
            }));
            const allowlist = new WorkspaceAllowlist();
            
            const workspaceFolders = [
                { uri: { fsPath: '/workspace1' } }
            ];
            
            allowlist.syncFromWorkspace(workspaceFolders);
            
            // Should not write if no changes
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('should handle empty workspace folders', () => {
            const allowlist = new WorkspaceAllowlist();
            
            // Should not throw
            allowlist.syncFromWorkspace([]);
            allowlist.syncFromWorkspace(null);
            allowlist.syncFromWorkspace(undefined);
        });
    });
});
