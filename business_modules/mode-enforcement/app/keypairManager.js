/**
 * KeypairManager - Ed25519 keypair management for token signing
 * 
 * Private key: stored in context.secrets (VS Code secure storage)
 * Public key: written to $HOME/.vibeswitch/mcp/publicKey.pem for MCP server
 * 
 * Uses Node.js crypto module for Ed25519 operations.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const MCP_DIR = path.join(VIBESWITCH_DIR, 'mcp');
const PUBLIC_KEY_FILE = path.join(MCP_DIR, 'publicKey.pem');
const SECRETS_KEY = 'vibeswitch.ed25519PrivateKey';

class KeypairManager {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     */
    constructor(context) {
        if (!context) {
            throw new Error('KeypairManager: context is required');
        }
        this._context = context;
        this._privateKey = null;
        this._ensureDirectories();
    }

    _ensureDirectories() {
        try {
            if (!fs.existsSync(MCP_DIR)) {
                fs.mkdirSync(MCP_DIR, { recursive: true });
            }
        } catch (error) {
            console.error('KeypairManager: Failed to create mcp directory:', error.message);
        }
    }

    /**
     * Initialize keypair - generates new if not exists, loads existing if available
     * @returns {Promise<boolean>} True if keypair is ready
     */
    async initialize() {
        try {
            // Try to load existing private key from secrets
            const storedKey = await this._context.secrets.get(SECRETS_KEY);
            
            if (storedKey) {
                // Verify it's a valid Ed25519 private key
                try {
                    this._privateKey = crypto.createPrivateKey({
                        key: Buffer.from(storedKey, 'base64'),
                        format: 'der',
                        type: 'pkcs8'
                    });
                    console.log('KeypairManager: Loaded existing keypair');
                    
                    // Ensure public key is exported
                    this._exportPublicKey();
                    return true;
                } catch (e) {
                    console.log('KeypairManager: Stored key invalid, regenerating');
                }
            }

            // Generate new keypair
            await this._generateKeypair();
            return true;
        } catch (error) {
            console.error('KeypairManager: Initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Generate new Ed25519 keypair and store
     */
    async _generateKeypair() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'der'
            }
        });

        // Store private key in secrets (as base64)
        await this._context.secrets.store(SECRETS_KEY, privateKey.toString('base64'));
        
        // Create private key object
        this._privateKey = crypto.createPrivateKey({
            key: privateKey,
            format: 'der',
            type: 'pkcs8'
        });

        // Export public key for MCP server
        this._exportPublicKeyPEM(publicKey);
        
        console.log('KeypairManager: Generated new keypair');
    }

    /**
     * Export public key from stored private key
     */
    _exportPublicKey() {
        if (!this._privateKey) return;
        
        const publicKey = crypto.createPublicKey(this._privateKey);
        const pem = publicKey.export({ type: 'spki', format: 'pem' });
        this._exportPublicKeyPEM(pem);
    }

    /**
     * Write public key PEM to filesystem
     */
    _exportPublicKeyPEM(pem) {
        try {
            // Atomic write
            const tempFile = PUBLIC_KEY_FILE + '.tmp';
            fs.writeFileSync(tempFile, pem, 'utf8');
            fs.renameSync(tempFile, PUBLIC_KEY_FILE);
        } catch (error) {
            console.error('KeypairManager: Failed to export public key:', error.message);
        }
    }

    /**
     * Sign data with Ed25519 private key
     * @param {string|Buffer} data - Data to sign
     * @returns {Buffer} Signature
     */
    sign(data) {
        if (!this._privateKey) {
            throw new Error('KeypairManager: Not initialized');
        }
        return crypto.sign(null, Buffer.from(data), this._privateKey);
    }

    /**
     * Check if keypair is ready
     * @returns {boolean}
     */
    isReady() {
        return this._privateKey !== null;
    }

    /**
     * Get public key file path (for MCP server to use)
     * @returns {string}
     */
    getPublicKeyPath() {
        return PUBLIC_KEY_FILE;
    }
}

module.exports = KeypairManager;
