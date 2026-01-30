/**
 * Run extension integration tests in Extension Development Host.
 * Uses @vscode/test-electron to launch VS Code with the extension and execute tests.
 * Set VIBESWITCH_INTEGRATION_TEST=1 to enable test-only commands (e.g. _testGetScore).
 */
const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
        const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');
        const workspacePath = path.resolve(__dirname, 'workspace');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                workspacePath,
                '--disable-extensions'
            ]
        });
    } catch (err) {
        console.error('Failed to run extension tests', err);
        process.exit(1);
    }
}

main();
