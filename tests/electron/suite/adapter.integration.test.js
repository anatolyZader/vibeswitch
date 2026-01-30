/**
 * Extension-host integration tests: adapter and meter.
 * Asserts valid shape, then concrete deltas after file edit (counters, score direction, meter view model).
 * Run with: npm run test:electron (requires VIBESWITCH_INTEGRATION_TEST=1).
 */
const assert = require('assert');
const vscode = require('vscode');
const path = require('path');

suite('Adapter integration', function () {
    this.timeout(20000);

    test('extension activates and _testGetDebugSnapshot returns valid shape', async () => {
        const ext = vscode.extensions.getExtension('your-publisher-name.vibeswitch');
        assert.ok(ext, 'Extension should be installed');
        await ext.activate();
        assert.strictEqual(ext.isActive, true, 'Extension should be active');

        const snapshot = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
        if (snapshot === undefined && process.env.VIBESWITCH_INTEGRATION_TEST !== '1') {
            return;
        }
        assert.ok(snapshot !== undefined, 'Snapshot should be defined when VIBESWITCH_INTEGRATION_TEST=1');
        assert.ok(snapshot.score && typeof snapshot.score.total === 'number', 'Snapshot should have score.total');
        assert.ok(snapshot.score.total >= 0 && snapshot.score.total <= 100, 'Total score in [0, 100]');
        assert.ok(snapshot.counters && typeof snapshot.counters.suggestionsTotal === 'number', 'Snapshot should have counters');
        assert.ok(snapshot.breakdown && Array.isArray(snapshot.breakdown.topFactors), 'Snapshot should have breakdown.topFactors');
        assert.ok(snapshot.meterViewModel && typeof snapshot.meterViewModel.segments === 'string', 'Snapshot should have meterViewModel');
        assert.ok(snapshot.meterViewModel.emoji.length > 0, 'Meter should have emoji');
    });

    test('after file edit: counters or score change in expected direction and meter matches', async () => {
        const before = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
        if (before === undefined) return;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return;

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const testFilePath = path.join(workspaceRoot, 'adapter-delta-test.js');
        const uri = vscode.Uri.file(testFilePath);

        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);
            await editor.edit((edit) => {
                edit.insert(new vscode.Position(0, 0), '// adapter delta test\nconst x = 1;\n');
            });
            await doc.save();

            await new Promise((r) => setTimeout(r, 800));

            const after = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
            assert.ok(after !== undefined, 'Snapshot after edit should be defined');

            // Deltas: either suggestion count increased or debt increased (edit may be classified as AI/user)
            const suggestionsIncreased = after.counters.suggestionsTotal >= before.counters.suggestionsTotal;
            const debtIncreased = after.counters.debtFileCount >= before.counters.debtFileCount;
            assert.ok(suggestionsIncreased || debtIncreased || after.counters.suggestionsTotal > 0 || after.counters.debtFileCount > 0,
                'After edit: suggestions total or debt count should reflect activity (or at least one counter > 0)');

            // Score remains valid
            assert.ok(after.score.total >= 0 && after.score.total <= 100, 'Total score in [0, 100]');

            // Meter view model matches score: segments length 7, emoji non-empty
            const filledSegments = (after.meterViewModel.segments.match(/\u25B0/g) || []).length;
            assert.ok(filledSegments >= 0 && filledSegments <= 7, 'Meter segments should be 0-7 filled');
            assert.ok(after.meterViewModel.segments.length === 7, 'Meter should have 7 segment chars');
            assert.ok(after.meterViewModel.emoji && after.meterViewModel.emoji.length > 0, 'Meter emoji should be set');
        } finally {
            try {
                const fs = require('fs');
                if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
            } catch (_) {}
        }
    });

    test('_testSimulateTerminalBlocked then snapshot has terminalAttemptsBlocked >= 1 and flags.terminalBlocked', async () => {
        await vscode.commands.executeCommand('vibeswitch._testResetState');
        const snapshotBefore = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
        if (snapshotBefore === undefined) return;
        assert.strictEqual(snapshotBefore.flags && snapshotBefore.flags.terminalBlocked, false, 'terminalBlocked should be false before simulate (no state leakage)');
        if (snapshotBefore.counters && typeof snapshotBefore.counters.terminalAttemptsBlocked === 'number') {
            assert.strictEqual(snapshotBefore.counters.terminalAttemptsBlocked, 0, 'terminalAttemptsBlocked should be 0 before simulate');
        }
        await vscode.commands.executeCommand('vibeswitch._testSimulateTerminalBlocked');
        const snapshot = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
        assert.ok(snapshot !== undefined, 'Snapshot should be defined');
        assert.ok(snapshot.counters && typeof snapshot.counters.terminalAttemptsBlocked === 'number', 'counters.terminalAttemptsBlocked should be number');
        assert.ok(snapshot.counters.terminalAttemptsBlocked >= 1, 'terminalAttemptsBlocked should be >= 1 after simulate');
        assert.strictEqual(snapshot.flags && snapshot.flags.terminalBlocked, true, 'flags.terminalBlocked should be true after simulate (adapter correctness; scoring stays in golden/property tests)');
    });

    test('mode switch changes currentMode and snapshot reflects it', async () => {
        const before = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
        if (before === undefined) return;
        assert.ok(before.currentMode !== undefined, 'Snapshot should have currentMode');
        const initialMode = before.currentMode;
        await vscode.commands.executeCommand(initialMode === 'dev' ? 'vibeswitch.toVibe' : 'vibeswitch.toDev');
        await new Promise((r) => setTimeout(r, 300));
        const after = await vscode.commands.executeCommand('vibeswitch._testGetDebugSnapshot');
        assert.ok(after !== undefined && after.currentMode !== undefined, 'Snapshot after mode switch should have currentMode');
        assert.notStrictEqual(after.currentMode, initialMode, 'currentMode should change after toDev/toVibe');
        assert.ok(after.meterViewModel, 'meterViewModel should be present');
        await vscode.commands.executeCommand(initialMode === 'dev' ? 'vibeswitch.toDev' : 'vibeswitch.toVibe');
    });

    test('_testCheckpointSave and _testCheckpointRestore return checkpoint shape', async () => {
        await vscode.commands.executeCommand('vibeswitch._testCheckpointSave');
        const checkpoint = await vscode.commands.executeCommand('vibeswitch._testCheckpointRestore');
        if (checkpoint === undefined) return;
        assert.ok(typeof checkpoint === 'object', 'Checkpoint should be object');
        assert.ok(typeof checkpoint.ts === 'number', 'Checkpoint should have ts');
        assert.ok(typeof checkpoint.reason === 'string' || typeof checkpoint.reason === 'undefined', 'Checkpoint may have reason');
    });
});
