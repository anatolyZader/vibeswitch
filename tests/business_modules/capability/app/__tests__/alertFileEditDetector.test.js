/**
 * Tests for AlertFileEditDetector
 * 
 * Monitors for unapproved file edits in DEV mode
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

jest.mock('fs');
jest.mock('vscode');

const AlertFileEditDetector = require('../../../../../business_modules/capability/app/alertFileEditDetector');

describe('AlertFileEditDetector', () => {
    let mockModeManager;
    let mockStatusBarItem;

    beforeEach(() => {
        jest.clearAllMocks();

        mockModeManager = {
            getMode: jest.fn().mockReturnValue('dev')
        };

        mockStatusBarItem = {
            text: '',
            tooltip: '',
            command: null,
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            backgroundColor: null
        };

        vscode.window.createStatusBarItem = jest.fn().mockReturnValue(mockStatusBarItem);
        vscode.window.showWarningMessage = jest.fn().mockResolvedValue(null);
        vscode.workspace.openTextDocument = jest.fn().mockResolvedValue({});
        vscode.window.showTextDocument = jest.fn().mockResolvedValue({});
        vscode.StatusBarAlignment = { Right: 2 };
        vscode.ThemeColor = jest.fn((color) => color);
        vscode.commands = { executeCommand: jest.fn() };

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('{}');
        fs.mkdirSync.mockImplementation(() => {});
        fs.watch.mockReturnValue({ close: jest.fn(), unref: jest.fn() });
    });

    describe('constructor', () => {
        it('should create instance with modeManager', () => {
            const detector = new AlertFileEditDetector(mockModeManager);
            expect(detector).toBeInstanceOf(AlertFileEditDetector);
        });
    });

    describe('createBadge', () => {
        it('should create status bar item', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            
            detector.createBadge(mockContext);

            expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
        });

        it('should register status bar item for cleanup', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            
            detector.createBadge(mockContext);

            expect(mockContext.subscriptions.push).toHaveBeenCalled();
        });

        it('should hide badge initially', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            
            detector.createBadge(mockContext);

            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });
    });

    describe('start', () => {
        it('should start watching alert file', () => {
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.start();

            // Uses chokidar when available, so just verify it starts without error
            expect(detector._watcher).not.toBeNull();
        });

        it('should create state directory if missing', () => {
            fs.existsSync.mockReturnValue(false);
            const detector = new AlertFileEditDetector(mockModeManager);
            
            detector.start();

            expect(fs.mkdirSync).toHaveBeenCalled();
        });
    });

    describe('alert handling', () => {
        it('should show badge when alert count > 0 in DEV mode', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.createBadge(mockContext);
            
            // Simulate alert
            detector._alertCount = 1;
            detector._updateBadge();

            expect(mockStatusBarItem.show).toHaveBeenCalled();
            expect(mockStatusBarItem.text).toContain('1');
        });

        it('should hide badge in VIBE mode', () => {
            mockModeManager.getMode.mockReturnValue('vibe');
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.createBadge(mockContext);
            
            detector._alertCount = 1;
            detector._updateBadge();

            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });

        it('should hide badge when alert count is 0', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.createBadge(mockContext);
            
            detector._alertCount = 0;
            detector._updateBadge();

            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });
    });

    describe('clearAlerts', () => {
        it('should reset alert count', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.createBadge(mockContext);
            detector._alertCount = 5;
            
            detector.clearAlerts();

            expect(detector._alertCount).toBe(0);
        });

        it('should hide badge after clearing', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.createBadge(mockContext);
            detector._alertCount = 5;
            
            detector.clearAlerts();

            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('should dispose watcher', () => {
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.start();
            
            // Verify watcher exists before dispose
            expect(detector._watcher).not.toBeNull();
            
            detector.dispose();

            // Watcher should be null after dispose
            expect(detector._watcher).toBeNull();
        });

        it('should dispose status bar item', () => {
            const mockContext = { subscriptions: { push: jest.fn() } };
            const detector = new AlertFileEditDetector(mockModeManager);
            detector.createBadge(mockContext);
            
            detector.dispose();

            expect(mockStatusBarItem.dispose).toHaveBeenCalled();
        });
    });
});
