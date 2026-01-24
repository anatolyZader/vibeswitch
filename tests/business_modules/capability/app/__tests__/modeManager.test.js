/**
 * Tests for ModeManager
 * 
 * ModeManager manages mode state with:
 * - Source of truth in context.globalState
 * - Mirror to filesystem for hook scripts
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock fs before requiring the module
jest.mock('fs');

const ModeManager = require('../../../../../business_modules/capability/app/modeManager');

describe('ModeManager', () => {
    let mockContext;
    const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
    const MODE_FILE = path.join(VIBESWITCH_DIR, 'state', 'mode.json');

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock context with globalState
        mockContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn().mockResolvedValue(undefined)
            }
        };

        // Default fs mocks
        fs.existsSync.mockReturnValue(true);
        fs.writeFileSync.mockImplementation(() => {});
        fs.renameSync.mockImplementation(() => {});
        fs.mkdirSync.mockImplementation(() => {});
    });

    describe('constructor', () => {
        it('should throw if context is not provided', () => {
            expect(() => new ModeManager(null)).toThrow('ModeManager: context is required');
            expect(() => new ModeManager(undefined)).toThrow('ModeManager: context is required');
        });

        it('should create instance with valid context', () => {
            const manager = new ModeManager(mockContext);
            expect(manager).toBeInstanceOf(ModeManager);
        });

        it('should create state directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            
            new ModeManager(mockContext);
            
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('state'),
                { recursive: true }
            );
        });
    });

    describe('getMode', () => {
        it('should return "vibe" when globalState returns "vibe"', () => {
            mockContext.globalState.get.mockReturnValue('vibe');
            const manager = new ModeManager(mockContext);
            
            expect(manager.getMode()).toBe('vibe');
        });

        it('should return "dev" when globalState returns "dev"', () => {
            mockContext.globalState.get.mockReturnValue('dev');
            const manager = new ModeManager(mockContext);
            
            expect(manager.getMode()).toBe('dev');
        });

        it('should default to "vibe" when globalState returns null', () => {
            mockContext.globalState.get.mockReturnValue(null);
            const manager = new ModeManager(mockContext);
            
            expect(manager.getMode()).toBe('vibe');
        });

        it('should default to "vibe" when globalState returns undefined', () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            const manager = new ModeManager(mockContext);
            
            expect(manager.getMode()).toBe('vibe');
        });

        it('should default to "vibe" for invalid mode values', () => {
            mockContext.globalState.get.mockReturnValue('invalid');
            const manager = new ModeManager(mockContext);
            
            expect(manager.getMode()).toBe('vibe');
        });
    });

    describe('setMode', () => {
        it('should update globalState with "dev"', async () => {
            const manager = new ModeManager(mockContext);
            
            await manager.setMode('dev');
            
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                'vibeswitch.mode',
                'dev'
            );
        });

        it('should update globalState with "vibe"', async () => {
            const manager = new ModeManager(mockContext);
            
            await manager.setMode('vibe');
            
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                'vibeswitch.mode',
                'vibe'
            );
        });

        it('should throw for invalid mode', async () => {
            const manager = new ModeManager(mockContext);
            
            await expect(manager.setMode('invalid')).rejects.toThrow(
                "ModeManager: Invalid mode 'invalid'"
            );
        });

        it('should mirror mode to filesystem', async () => {
            const manager = new ModeManager(mockContext);
            
            await manager.setMode('dev');
            
            // Should write to temp file first
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('"mode": "dev"'),
                'utf8'
            );
            // Then rename atomically
            expect(fs.renameSync).toHaveBeenCalled();
        });

        it('should return true on success', async () => {
            const manager = new ModeManager(mockContext);
            
            const result = await manager.setMode('dev');
            
            expect(result).toBe(true);
        });

        it('should not throw if filesystem mirror fails', async () => {
            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });
            const manager = new ModeManager(mockContext);
            
            // Should not throw - mirror is best-effort
            await expect(manager.setMode('dev')).resolves.toBe(true);
        });
    });

    describe('syncToFileSystem', () => {
        it('should write current mode to filesystem', () => {
            mockContext.globalState.get.mockReturnValue('dev');
            const manager = new ModeManager(mockContext);
            
            manager.syncToFileSystem();
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('"mode": "dev"'),
                'utf8'
            );
        });

        it('should use atomic write (temp + rename)', () => {
            mockContext.globalState.get.mockReturnValue('vibe');
            const manager = new ModeManager(mockContext);
            
            manager.syncToFileSystem();
            
            expect(fs.renameSync).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('mode.json')
            );
        });
    });
});
