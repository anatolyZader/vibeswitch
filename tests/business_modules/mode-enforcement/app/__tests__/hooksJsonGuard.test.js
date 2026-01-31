/**
 * Tests for HooksJsonGuard
 * 
 * Watches and protects .cursor/hooks.json from tampering
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vscode = require('vscode');

jest.mock('fs');
jest.mock('vscode');

const HooksJsonGuard = require('../../../../../business_modules/mode-enforcement/app/hooksJsonGuard');

describe('HooksJsonGuard', () => {
    let mockContext;
    let mockModeManager;
    let mockWatcher;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        mockContext = {
            subscriptions: { push: jest.fn() }
        };

        mockModeManager = {
            setMode: jest.fn().mockResolvedValue(true),
            getMode: jest.fn().mockReturnValue('vibe')
        };

        mockWatcher = {
            onDidChange: jest.fn(),
            onDidCreate: jest.fn(),
            onDidDelete: jest.fn(),
            dispose: jest.fn()
        };

        vscode.workspace.createFileSystemWatcher = jest.fn().mockReturnValue(mockWatcher);
        vscode.RelativePattern = jest.fn();
        vscode.window.showWarningMessage = jest.fn().mockResolvedValue(null);
        vscode.Uri = { file: jest.fn(p => ({ fsPath: p })) };
        vscode.workspace.openTextDocument = jest.fn().mockResolvedValue({});
        vscode.window.showTextDocument = jest.fn().mockResolvedValue({});

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('{}');
        fs.writeFileSync.mockImplementation(() => {});
        fs.renameSync.mockImplementation(() => {});
        fs.mkdirSync.mockImplementation(() => {});
        fs.appendFileSync.mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('constructor', () => {
        it('should throw if context is not provided', () => {
            expect(() => new HooksJsonGuard(null, mockModeManager)).toThrow();
        });

        it('should create instance with valid context', () => {
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            expect(guard).toBeInstanceOf(HooksJsonGuard);
        });
    });

    describe('start', () => {
        it('should create file system watcher', () => {
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
        });

        it('should register watcher for cleanup', () => {
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            expect(mockContext.subscriptions.push).toHaveBeenCalledWith(mockWatcher);
        });

        it('should restore hooks.json if missing', () => {
            fs.existsSync.mockImplementation((p) => !p.includes('hooks.json'));
            
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should restore hooks.json if content differs', () => {
            fs.readFileSync.mockReturnValue('{"tampered": true}');
            
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should set up change handler', () => {
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            expect(mockWatcher.onDidChange).toHaveBeenCalled();
        });

        it('should set up delete handler', () => {
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            expect(mockWatcher.onDidDelete).toHaveBeenCalled();
        });
    });

    describe('tamper detection', () => {
        it('should flip to DEV mode on tamper', async () => {
            fs.readFileSync.mockReturnValue('{"tampered": true}');
            
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            // Simulate change event
            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            changeHandler();

            // Wait for debounce
            jest.advanceTimersByTime(500);
            await Promise.resolve();

            expect(mockModeManager.setMode).toHaveBeenCalledWith('dev');
        });

        it('should show warning message on tamper', async () => {
            fs.readFileSync.mockReturnValue('{"tampered": true}');
            
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            changeHandler();

            jest.advanceTimersByTime(500);
            await Promise.resolve();

            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        });

        it('should audit tamper event', async () => {
            fs.readFileSync.mockReturnValue('{"tampered": true}');
            
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            changeHandler();

            jest.advanceTimersByTime(500);
            await Promise.resolve();

            expect(fs.appendFileSync).toHaveBeenCalledWith(
                expect.stringContaining('audit.log'),
                expect.stringContaining('HOOKS_JSON_TAMPER'),
                'utf8'
            );
        });

        it('should debounce rapid changes', async () => {
            fs.readFileSync.mockReturnValue('{"tampered": true}');
            
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');

            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            
            // Rapid changes
            changeHandler();
            changeHandler();
            changeHandler();

            jest.advanceTimersByTime(500);
            await Promise.resolve();

            // Should only process once
            expect(mockModeManager.setMode).toHaveBeenCalledTimes(1);
        });
    });

    describe('dispose', () => {
        it('should dispose watcher', () => {
            const guard = new HooksJsonGuard(mockContext, mockModeManager);
            guard.start('/workspace');
            guard.dispose();

            expect(mockWatcher.dispose).toHaveBeenCalled();
        });
    });
});
