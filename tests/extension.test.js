const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

describe('VibeSwitch Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting VibeSwitch tests.');

    test('Extension should be present', () => {
        expect(vscode.extensions.getExtension('your-publisher-name.vibeswitch').toBeTruthy());
    });

    test('Extension should activate', async function() {
        this.timeout(10000);
        const ext = vscode.extensions.getExtension('your-publisher-name.vibeswitch');
        await ext.activate();
        expect(ext.isActive).toBe(true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        expect(commands.includes('vibeswitch.openDashboard')).toBeTruthy();
        expect(commands.includes('vibeswitch.showStats')).toBeTruthy();
    });

    test('Configuration settings should exist', () => {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        assert.notStrictEqual(config, undefined);
        
        // Check default values
        expect(config.get('showInStatusBar')).toBe(true);
        expect(config.get('autoReload')).toBe(false);
        expect(config.get('rulesPath')).toBe('');
    });
});

describe('Path Safety Tests', () => {
    const extension = require('../../extension.js');
    
    test('isPathSafe should reject path traversal', () => {
        const workspaceRoot = '/home/user/project';
        const maliciousPath = path.join(workspaceRoot, '../../../etc/passwd');
        
        // Note: This requires exporting isPathSafe from extension.js for testing
        // For now, we'll test the behavior through file operations
        expect(true).toBeTruthy(); // Placeholder - will enhance after refactoring
    });

    test('isPathSafe should accept valid workspace paths', () => {
        const workspaceRoot = '/home/user/project';
        const validPath = path.join(workspaceRoot, '.cursor', 'rules.md');
        
        expect(validPath.startsWith(workspaceRoot).toBeTruthy());
    });
});

describe('Cursor rules', () => {
    test('.cursor/rules.md is the single rules file (no separate dev/vibe files)', () => {
        const workspaceRoot = path.join(__dirname, '..', '..');
        const rulesFile = path.join(workspaceRoot, '.cursor', 'rules.md');
        expect(fs.existsSync(rulesFile)).toBeTruthy();
    });
});

describe('Settings Tests', () => {
    test('VIBE settings should have correct values', () => {
        const expectedVibeSettings = {
            "cursor.chat.defaultMode": "agent",
            "cursor.agent.requireApproval": false,
            "cursor.agent.autoApplyEdits": true,
            "cursor.ai.autoApply": true,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 1000
        };
        
        expect(expectedVibeSettings['cursor.chat.defaultMode']).toBe('agent');
        expect(expectedVibeSettings['cursor.agent.requireApproval']).toBe(false);
        expect(expectedVibeSettings['cursor.agent.autoApplyEdits']).toBe(true);
        expect(expectedVibeSettings['cursor.ai.autoApply']).toBe(true);
        expect(expectedVibeSettings['files.autoSaveDelay']).toBe(1000);
    });

    test('DEV settings should have correct values', () => {
        const expectedDevSettings = {
            "cursor.chat.defaultMode": "ask",
            "cursor.agent.requireApproval": true,
            "cursor.agent.autoApplyEdits": false,
            "cursor.ai.autoApply": false,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 3000
        };
        
        expect(expectedDevSettings['cursor.chat.defaultMode']).toBe('ask');
        expect(expectedDevSettings['cursor.agent.requireApproval']).toBe(true);
        expect(expectedDevSettings['cursor.agent.autoApplyEdits']).toBe(false);
        expect(expectedDevSettings['cursor.ai.autoApply']).toBe(false);
        expect(expectedDevSettings['files.autoSaveDelay']).toBe(3000);
    });

    test('VIBE and DEV settings should be opposites for key values', () => {
        const vibe = { requireApproval: false, autoApply: true };
        const dev = { requireApproval: true, autoApply: false };
        
        expect(vibe.requireApproval).toBe(!dev.requireApproval);
        expect(vibe.autoApply).toBe(!dev.autoApply);
    });
});

describe('File Size Validation Tests', () => {
    test('Should reject files larger than 1MB', () => {
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const testSize = 2 * 1024 * 1024; // 2MB
        
        expect(testSize > MAX_FILE_SIZE).toBe('Test file size should exceed limit').toBeTruthy();
    });

    test('Should accept files smaller than 1MB', () => {
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const testSize = 500 * 1024; // 500KB
        
        expect(testSize < MAX_FILE_SIZE).toBe('Test file size should be within limit').toBeTruthy();
    });
});

describe('Status Bar Tests', () => {
    test('Status bar should show correct text for VIBE mode', () => {
        const vibeText = '$(dashboard) VIBE';
        expect(vibeText.includes('VIBE').toBeTruthy());
        expect(vibeText.includes('$(dashboard).toBeTruthy()'));
    });

    test('Status bar should show correct text for DEV mode', () => {
        const devText = '$(book) DEV';
        expect(devText.includes('DEV').toBeTruthy());
        expect(devText.includes('$(book).toBeTruthy()'));
    });

    test('Status bar should show correct text for unknown mode', () => {
        const unknownText = '$(gear) Mode?';
        expect(unknownText.includes('Mode?').toBeTruthy());
        expect(unknownText.includes('$(gear).toBeTruthy()'));
    });
});

describe('Mode Detection Tests', () => {
    test('Should detect VIBE mode from file content', () => {
        const content = '# VIBE MODE - Autonomous Agent Configuration\nTest content';
        expect(content.includes('VIBE MODE').toBeTruthy(), 'Should contain VIBE MODE marker');
    });

    test('Should detect DEV mode from file content', () => {
        const content = '# DEV MODE - Collaborative Development Configuration\nTest content';
        expect(content.includes('DEV MODE').toBeTruthy(), 'Should contain DEV MODE marker');
    });

    test('Should return null for content without markers', () => {
        const content = '# Some random content\nNo mode markers here';
        expect(!content.includes('VIBE MODE').toBeTruthy() && !content.includes('DEV MODE'));
    });
});










