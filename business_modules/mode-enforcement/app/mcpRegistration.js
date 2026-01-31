/**
 * MCP Registration - Writes VibeSwitch MCP server into Cursor's MCP config
 * so users don't have to edit JSON by hand.
 * Cursor reads ~/.cursor/mcp.json with structure: { mcpServers: { "name": { command, args } } }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CURSOR_DIR = path.join(os.homedir(), '.cursor');
const MCP_CONFIG_PATH = path.join(CURSOR_DIR, 'mcp.json');
const SERVER_NAME = 'vibeswitch';

/**
 * Register (or update) the VibeSwitch MCP server in Cursor's global MCP config.
 * @param {string} extensionPath - Extension install path (context.extensionPath)
 * @returns {{ success: boolean, error?: string }}
 */
function registerMcpServer(extensionPath) {
    if (!extensionPath || !fs.existsSync(extensionPath)) {
        return { success: false, error: 'Extension path missing or invalid' };
    }

    // VSIX-safe: extensionPath is the installed extension root (repo-relative paths not used)
    const serverPath = path.join(extensionPath, 'business_modules', 'mcp-server', 'index.js');
    if (!fs.existsSync(serverPath)) {
        return { success: false, error: `MCP server not found at ${serverPath}` };
    }

    try {
        if (!fs.existsSync(CURSOR_DIR)) {
            fs.mkdirSync(CURSOR_DIR, { recursive: true });
        }

        let config = { mcpServers: {} };
        if (fs.existsSync(MCP_CONFIG_PATH)) {
            try {
                const raw = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
                config = JSON.parse(raw);
                if (!config.mcpServers || typeof config.mcpServers !== 'object') {
                    config.mcpServers = {};
                }
            } catch (e) {
                return { success: false, error: 'Existing MCP config is not valid JSON. Fix or rename ~/.cursor/mcp.json and try again.' };
            }
        }

        // Idempotent: only mcpServers.vibeswitch is written/updated; all other keys and servers preserved
        config.mcpServers[SERVER_NAME] = {
            command: 'node',
            args: [serverPath]
        };

        fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

        // Self-check: read back and confirm entry exists
        const rawBack = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
        const configBack = JSON.parse(rawBack);
        const entry = configBack.mcpServers && configBack.mcpServers[SERVER_NAME];
        if (!entry || typeof entry.command !== 'string' || !Array.isArray(entry.args) || entry.args.length === 0) {
            return { success: false, error: 'MCP config write succeeded but read-back validation failed. Check ~/.cursor/mcp.json.' };
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    registerMcpServer,
    MCP_CONFIG_PATH,
    SERVER_NAME
};
