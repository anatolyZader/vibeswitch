/**
 * Unit tests for globalKeysStorage.
 */

const path = require('path');
const fs = require('fs');
const { getGlobalKey, setGlobalKey, setGlobalKeySync } = require('../../../cross_cut_modules/storage-uri/globalKeysStorage');

describe('globalKeysStorage', () => {
    const tmpDir = path.join(__dirname, '../../../.tmp-global-keys-test');
    let mockContext;

    beforeAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'global'), { recursive: true });
        mockContext = {
            globalStorageUri: { fsPath: path.join(tmpDir, 'global') },
            globalState: {
                get: jest.fn().mockReturnValue(false),
                update: jest.fn().mockResolvedValue(undefined)
            }
        };
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    beforeEach(() => {
        mockContext.globalState.get.mockImplementation((key, def) =>
            key === 'vibeswitch.globalKeys.migrated' ? false : def
        );
    });

    it('getGlobalKey returns defaultValue when key missing', () => {
        expect(getGlobalKey(mockContext, 'missing', 'default')).toBe('default');
    });

    it('setGlobalKeySync and getGlobalKey round-trip', () => {
        setGlobalKeySync(mockContext, 'vibeswitch.mode', 'dev');
        expect(getGlobalKey(mockContext, 'vibeswitch.mode', 'vibe')).toBe('dev');
    });

    it('setGlobalKey and getGlobalKey round-trip (async)', async () => {
        await setGlobalKey(mockContext, 'vibeswitch.research.lastRun', 12345);
        expect(getGlobalKey(mockContext, 'vibeswitch.research.lastRun', 0)).toBe(12345);
    });

    it('migrates from globalState on first use', () => {
        mockContext.globalState.get.mockImplementation((key, def) => {
            if (key === 'vibeswitch.globalKeys.migrated') return false;
            if (key === 'vibeswitch.setupPromptShown') return true;
            return def;
        });
        expect(getGlobalKey(mockContext, 'vibeswitch.setupPromptShown', false)).toBe(true);
    });
});
