const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let statusBarItem;
let currentMode = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('VibeSwitch extension is now active');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vibeswitch.switchMode';
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.switchMode', showModePicker)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.toVibe', () => switchToMode('vibe'))
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.toDev', () => switchToMode('dev'))
    );

    // Initialize and show status bar
    updateStatusBar();
    statusBarItem.show();

    // Watch for .cursorrules changes
    watchForModeChanges();
}

function showModePicker() {
    const modes = [
        {
            label: '$(zap) VIBE Mode',
            description: 'Autonomous - AI works independently with minimal interruptions',
            detail: 'Best for: Building features quickly, refactoring, prototyping',
            mode: 'vibe'
        },
        {
            label: '$(book) DEV Mode',
            description: 'Collaborative - AI explains and asks for approval',
            detail: 'Best for: Learning, understanding changes, careful review',
            mode: 'dev'
        },
        {
            label: '$(info) Current: ' + (currentMode || 'Unknown'),
            description: 'View current mode',
            mode: null
        }
    ];

    vscode.window.showQuickPick(modes, {
        placeHolder: 'Select AI Agent Mode',
        title: 'VibeSwitch - Change AI Agent Behavior'
    }).then(selection => {
        if (selection && selection.mode) {
            switchToMode(selection.mode);
        }
    });
}

async function switchToMode(mode) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const customPath = config.get('rulesPath');
    const basePath = customPath || workspaceRoot;

    try {
        // Define file paths
        const cursorrules = path.join(basePath, '.cursorrules');
        const sourceRules = path.join(basePath, `.cursorrules.${mode}`);
        
        const vscodeDir = path.join(basePath, '.vscode');
        const settingsFile = path.join(vscodeDir, 'settings.json');
        const sourceSettings = path.join(vscodeDir, `settings.${mode}.json`);

        // Check if source files exist
        if (!fs.existsSync(sourceRules)) {
            const create = await vscode.window.showErrorMessage(
                `Missing ${sourceRules}. Would you like to create default mode files?`,
                'Yes', 'No'
            );
            if (create === 'Yes') {
                await createDefaultModeFiles(basePath);
            } else {
                return;
            }
        }

        // Copy .cursorrules
        fs.copyFileSync(sourceRules, cursorrules);
        
        // Create .vscode directory if needed
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        // Copy settings if they exist
        if (fs.existsSync(sourceSettings)) {
            fs.copyFileSync(sourceSettings, settingsFile);
        }

        // Update current mode
        currentMode = mode;
        updateStatusBar();

        // Show success message
        const modeName = mode.toUpperCase();
        const emoji = mode === 'vibe' ? '⚡' : '📚';
        
        const action = await vscode.window.showInformationMessage(
            `${emoji} Switched to ${modeName} mode`,
            'Reload Window',
            'Dismiss'
        );

        // Auto-reload or prompt
        const autoReload = config.get('autoReload');
        if (autoReload || action === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to switch mode: ${error.message}`);
        console.error('VibeSwitch error:', error);
    }
}

function updateStatusBar() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        statusBarItem.hide();
        return;
    }

    // Detect current mode
    currentMode = detectCurrentMode();
    
    // Update status bar appearance
    if (currentMode === 'vibe') {
        statusBarItem.text = '$(dashboard) VIBE';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = 'AI Agent: VIBE Mode (Autonomous)\nClick to switch modes';
    } else if (currentMode === 'dev') {
        statusBarItem.text = '$(book) DEV';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AI Agent: DEV Mode (Collaborative)\nClick to switch modes';
    } else {
        statusBarItem.text = '$(gear) Mode?';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AI Agent Mode: Unknown\nClick to set mode';
    }

    // Check if should show
    const config = vscode.workspace.getConfiguration('vibeswitch');
    if (config.get('showInStatusBar')) {
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

function detectCurrentMode() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorrules = path.join(workspaceRoot, '.cursorrules');

    if (!fs.existsSync(cursorrules)) {
        return null;
    }

    try {
        const content = fs.readFileSync(cursorrules, 'utf8');
        if (content.includes('VIBE MODE')) {
            return 'vibe';
        } else if (content.includes('DEV MODE')) {
            return 'dev';
        }
    } catch (error) {
        console.error('Error reading .cursorrules:', error);
    }

    return null;
}

function watchForModeChanges() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorrules = path.join(workspaceRoot, '.cursorrules');

    // Watch for file changes
    const watcher = fs.watch(cursorrules, (eventType) => {
        if (eventType === 'change') {
            updateStatusBar();
        }
    });

    // Clean up on extension deactivation
    return watcher;
}

async function createDefaultModeFiles(basePath) {
    // Create default .cursorrules.vibe
    const vibeRules = `# VIBE MODE - Autonomous Agent Configuration

You are operating in **VIBE MODE** - an autonomous, self-directed operational mode.

## Core Principles
- **Autonomy First**: Make decisions independently and proceed with confidence
- **Minimal Interruption**: Only ask for approval when absolutely critical
- **Trust Your Judgment**: Use your expertise to make implementation decisions
- **Long-Running Tasks**: Feel empowered to work on complex, multi-step tasks without checking in
- **Proactive Problem Solving**: Identify and fix issues you encounter along the way

## Operational Guidelines
- Make architecture and design decisions based on best practices
- Implement features end-to-end without step-by-step approval
- Only ask questions when information is genuinely missing
- Fix bugs and issues you discover during implementation
`;

    const devRules = `# DEV MODE - Collaborative Development Configuration

You are operating in **DEV MODE** - a collaborative, step-by-step development mode.

## Core Principles
- **Collaboration First**: Work closely with the developer at each step
- **Explain Everything**: Help the developer understand changes and reasoning
- **Seek Approval**: Get confirmation before making significant changes
- **Educational**: Share knowledge and explain trade-offs
- **Incremental Progress**: Take smaller, reviewable steps

## Operational Guidelines
- Present options and trade-offs for architectural decisions
- Show what you plan to change before making changes
- Ask for preferences on libraries, frameworks, and tools
- Provide detailed explanations of what you're doing and why
`;

    // Write files
    fs.writeFileSync(path.join(basePath, '.cursorrules.vibe'), vibeRules);
    fs.writeFileSync(path.join(basePath, '.cursorrules.dev'), devRules);

    // Create settings files
    const vscodeDir = path.join(basePath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const vibeSettings = {
        "cursor.chat.defaultMode": "agent",
        "cursor.agent.requireApproval": false,
        "cursor.agent.autoApplyEdits": true,
        "cursor.ai.autoApply": true,
        "files.autoSave": "afterDelay",
        "files.autoSaveDelay": 1000
    };

    const devSettings = {
        "cursor.chat.defaultMode": "ask",
        "cursor.agent.requireApproval": true,
        "cursor.agent.autoApplyEdits": false,
        "cursor.ai.autoApply": false,
        "files.autoSave": "afterDelay",
        "files.autoSaveDelay": 3000
    };

    fs.writeFileSync(
        path.join(vscodeDir, 'settings.vibe.json'),
        JSON.stringify(vibeSettings, null, 2)
    );
    
    fs.writeFileSync(
        path.join(vscodeDir, 'settings.dev.json'),
        JSON.stringify(devSettings, null, 2)
    );

    vscode.window.showInformationMessage('Created default mode files');
}

function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};


