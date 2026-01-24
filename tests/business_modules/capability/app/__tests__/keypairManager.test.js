/**
 * Tests for KeypairManager
 * 
 * Ed25519 keypair management for token signing
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('fs');

const KeypairManager = require('../../../../../business_modules/capability/app/keypairManager');

describe('KeypairManager', () => {
    let mockContext;
    const MCP_DIR = path.join(os.homedir(), '.vibeswitch', 'mcp');
    const PUBLIC_KEY_FILE = path.join(MCP_DIR, 'publicKey.pem');

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            secrets: {
                get: jest.fn().mockResolvedValue(null),
                store: jest.fn().mockResolvedValue(undefined)
            }
        };

        fs.existsSync.mockReturnValue(true);
        fs.writeFileSync.mockImplementation(() => {});
        fs.renameSync.mockImplementation(() => {});
        fs.mkdirSync.mockImplementation(() => {});
    });

    describe('constructor', () => {
        it('should throw if context is not provided', () => {
            expect(() => new KeypairManager(null)).toThrow('KeypairManager: context is required');
        });

        it('should create instance with valid context', () => {
            const manager = new KeypairManager(mockContext);
            expect(manager).toBeInstanceOf(KeypairManager);
        });

        it('should create mcp directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            new KeypairManager(mockContext);
            expect(fs.mkdirSync).toHaveBeenCalled();
        });
    });

    describe('initialize', () => {
        it('should generate new keypair when none exists', async () => {
            const manager = new KeypairManager(mockContext);
            
            const result = await manager.initialize();
            
            expect(result).toBe(true);
            expect(mockContext.secrets.store).toHaveBeenCalled();
        });

        it('should load existing keypair from secrets', async () => {
            // Generate a real keypair to store
            const { privateKey } = crypto.generateKeyPairSync('ed25519', {
                privateKeyEncoding: { type: 'pkcs8', format: 'der' }
            });
            mockContext.secrets.get.mockResolvedValue(privateKey.toString('base64'));
            
            const manager = new KeypairManager(mockContext);
            const result = await manager.initialize();
            
            expect(result).toBe(true);
            expect(mockContext.secrets.store).not.toHaveBeenCalled();
        });

        it('should regenerate if stored key is invalid', async () => {
            mockContext.secrets.get.mockResolvedValue('invalid-key-data');
            
            const manager = new KeypairManager(mockContext);
            const result = await manager.initialize();
            
            expect(result).toBe(true);
            expect(mockContext.secrets.store).toHaveBeenCalled();
        });

        it('should export public key to filesystem', async () => {
            const manager = new KeypairManager(mockContext);
            await manager.initialize();
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('PUBLIC KEY'),
                'utf8'
            );
        });
    });

    describe('isReady', () => {
        it('should return false before initialization', () => {
            const manager = new KeypairManager(mockContext);
            expect(manager.isReady()).toBe(false);
        });

        it('should return true after initialization', async () => {
            const manager = new KeypairManager(mockContext);
            await manager.initialize();
            expect(manager.isReady()).toBe(true);
        });
    });

    describe('sign', () => {
        it('should throw if not initialized', () => {
            const manager = new KeypairManager(mockContext);
            expect(() => manager.sign('data')).toThrow('KeypairManager: Not initialized');
        });

        it('should sign data with Ed25519', async () => {
            const manager = new KeypairManager(mockContext);
            await manager.initialize();
            
            const signature = manager.sign('test data');
            
            expect(signature).toBeInstanceOf(Buffer);
            expect(signature.length).toBe(64); // Ed25519 signatures are 64 bytes
        });

        it('should produce different signatures for different data', async () => {
            const manager = new KeypairManager(mockContext);
            await manager.initialize();
            
            const sig1 = manager.sign('data1');
            const sig2 = manager.sign('data2');
            
            expect(sig1.equals(sig2)).toBe(false);
        });

        it('should produce same signature for same data', async () => {
            const manager = new KeypairManager(mockContext);
            await manager.initialize();
            
            const sig1 = manager.sign('same data');
            const sig2 = manager.sign('same data');
            
            expect(sig1.equals(sig2)).toBe(true);
        });
    });

    describe('getPublicKeyPath', () => {
        it('should return public key file path', () => {
            const manager = new KeypairManager(mockContext);
            expect(manager.getPublicKeyPath()).toBe(PUBLIC_KEY_FILE);
        });
    });
});
