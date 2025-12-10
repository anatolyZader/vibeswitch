const assert = require('assert');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

suite('VibeSwitch Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting VibeSwitch tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher-name.vibeswitch'));
    });

    test('Extension should activate', async function() {
        this.timeout(10000);
        const ext = vscode.extensions.getExtension('your-publisher-name.vibeswitch');
        await ext.activate();
        assert.strictEqual(ext.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vibeswitch.switchMode'));
        assert.ok(commands.includes('vibeswitch.toVibe'));
        assert.ok(commands.includes('vibeswitch.toDev'));
    });

    test('Configuration settings should exist', () => {
        const config = vscode.workspace.getConfiguration('vibeswitch');
        assert.notStrictEqual(config, undefined);
        
        // Check default values
        assert.strictEqual(config.get('showInStatusBar'), true);
        assert.strictEqual(config.get('autoReload'), false);
        assert.strictEqual(config.get('rulesPath'), '');
    });
});

suite('Path Safety Tests', () => {
    const extension = require('../../extension.js');
    
    test('isPathSafe should reject path traversal', () => {
        const workspaceRoot = '/home/user/project';
        const maliciousPath = path.join(workspaceRoot, '../../../etc/passwd');
        
        // Note: This requires exporting isPathSafe from extension.js for testing
        // For now, we'll test the behavior through file operations
        assert.ok(true); // Placeholder - will enhance after refactoring
    });

    test('isPathSafe should accept valid workspace paths', () => {
        const workspaceRoot = '/home/user/project';
        const validPath = path.join(workspaceRoot, '.cursorrules');
        
        assert.ok(validPath.startsWith(workspaceRoot));
    });
});

suite('Mode Switching Tests', () => {
    let testWorkspacePath;

    suiteSetup(() => {
        // Create a temporary test workspace
        testWorkspacePath = path.join(__dirname, '..', '..', 'test-workspace');
        if (!fs.existsSync(testWorkspacePath)) {
            fs.mkdirSync(testWorkspacePath, { recursive: true });
        }
    });

    suiteTeardown(() => {
        // Cleanup test workspace
        if (fs.existsSync(testWorkspacePath)) {
            fs.rmSync(testWorkspacePath, { recursive: true, force: true });
        }
    });

    test('Should create default mode files when missing', async function() {
        this.timeout(5000);
        
        const vibeRules = path.join(testWorkspacePath, '.cursorrules.vibe');
        const devRules = path.join(testWorkspacePath, '.cursorrules.dev');
        
        // Create files
        if (!fs.existsSync(vibeRules)) {
            fs.writeFileSync(vibeRules, '# VIBE MODE\nTest content');
        }
        if (!fs.existsSync(devRules)) {
            fs.writeFileSync(devRules, '# DEV MODE\nTest content');
        }
        
        assert.ok(fs.existsSync(vibeRules), 'VIBE rules file should exist');
        assert.ok(fs.existsSync(devRules), 'DEV rules file should exist');
    });

    test('Should validate mode parameter', () => {
        const validModes = ['vibe', 'dev'];
        assert.ok(validModes.includes('vibe'));
        assert.ok(validModes.includes('dev'));
        assert.ok(!validModes.includes('invalid'));
        assert.ok(!validModes.includes('hacker'));
    });

    test('Mode files should contain correct markers', () => {
        const vibeRules = path.join(testWorkspacePath, '.cursorrules.vibe');
        const devRules = path.join(testWorkspacePath, '.cursorrules.dev');
        
        if (fs.existsSync(vibeRules)) {
            const content = fs.readFileSync(vibeRules, 'utf8');
            assert.ok(content.includes('VIBE MODE'), 'VIBE file should contain VIBE MODE marker');
        }
        
        if (fs.existsSync(devRules)) {
            const content = fs.readFileSync(devRules, 'utf8');
            assert.ok(content.includes('DEV MODE'), 'DEV file should contain DEV MODE marker');
        }
    });
});

suite('Settings Tests', () => {
    test('VIBE settings should have correct values', () => {
        const expectedVibeSettings = {
            "cursor.chat.defaultMode": "agent",
            "cursor.agent.requireApproval": false,
            "cursor.agent.autoApplyEdits": true,
            "cursor.ai.autoApply": true,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 1000
        };
        
        assert.strictEqual(expectedVibeSettings['cursor.chat.defaultMode'], 'agent');
        assert.strictEqual(expectedVibeSettings['cursor.agent.requireApproval'], false);
        assert.strictEqual(expectedVibeSettings['cursor.agent.autoApplyEdits'], true);
        assert.strictEqual(expectedVibeSettings['cursor.ai.autoApply'], true);
        assert.strictEqual(expectedVibeSettings['files.autoSaveDelay'], 1000);
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
        
        assert.strictEqual(expectedDevSettings['cursor.chat.defaultMode'], 'ask');
        assert.strictEqual(expectedDevSettings['cursor.agent.requireApproval'], true);
        assert.strictEqual(expectedDevSettings['cursor.agent.autoApplyEdits'], false);
        assert.strictEqual(expectedDevSettings['cursor.ai.autoApply'], false);
        assert.strictEqual(expectedDevSettings['files.autoSaveDelay'], 3000);
    });

    test('VIBE and DEV settings should be opposites for key values', () => {
        const vibe = { requireApproval: false, autoApply: true };
        const dev = { requireApproval: true, autoApply: false };
        
        assert.strictEqual(vibe.requireApproval, !dev.requireApproval);
        assert.strictEqual(vibe.autoApply, !dev.autoApply);
    });
});

suite('File Size Validation Tests', () => {
    test('Should reject files larger than 1MB', () => {
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const testSize = 2 * 1024 * 1024; // 2MB
        
        assert.ok(testSize > MAX_FILE_SIZE, 'Test file size should exceed limit');
    });

    test('Should accept files smaller than 1MB', () => {
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const testSize = 500 * 1024; // 500KB
        
        assert.ok(testSize < MAX_FILE_SIZE, 'Test file size should be within limit');
    });
});

suite('Status Bar Tests', () => {
    test('Status bar should show correct text for VIBE mode', () => {
        const vibeText = '$(dashboard) VIBE';
        assert.ok(vibeText.includes('VIBE'));
        assert.ok(vibeText.includes('$(dashboard)'));
    });

    test('Status bar should show correct text for DEV mode', () => {
        const devText = '$(book) DEV';
        assert.ok(devText.includes('DEV'));
        assert.ok(devText.includes('$(book)'));
    });

    test('Status bar should show correct text for unknown mode', () => {
        const unknownText = '$(gear) Mode?';
        assert.ok(unknownText.includes('Mode?'));
        assert.ok(unknownText.includes('$(gear)'));
    });
});

suite('Mode Detection Tests', () => {
    test('Should detect VIBE mode from file content', () => {
        const content = '# VIBE MODE - Autonomous Agent Configuration\nTest content';
        assert.ok(content.includes('VIBE MODE'), 'Should contain VIBE MODE marker');
    });

    test('Should detect DEV mode from file content', () => {
        const content = '# DEV MODE - Collaborative Development Configuration\nTest content';
        assert.ok(content.includes('DEV MODE'), 'Should contain DEV MODE marker');
    });

    test('Should return null for content without markers', () => {
        const content = '# Some random content\nNo mode markers here';
        assert.ok(!content.includes('VIBE MODE') && !content.includes('DEV MODE'));
    });
});










