#!/usr/bin/env node
/**
 * VibeSwitch MCP Server
 * Tools: mcp__vibeswitch__submit_patch, mcp__vibeswitch__apply_patch
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const MCP_DIR = path.join(VIBESWITCH_DIR, 'mcp');
const LIB_DIR = path.join(VIBESWITCH_DIR, 'lib');
const REQUESTS_DIR = path.join(STATE_DIR, 'requests');
const APPROVED_DIR = path.join(STATE_DIR, 'approved');
const PUBLIC_KEY_FILE = path.join(MCP_DIR, 'publicKey.pem');
const WORKSPACES_FILE = path.join(STATE_DIR, 'workspaces.json');
const CONSUMED_DB = path.join(MCP_DIR, 'consumed.db');
const MODE_FILE = path.join(STATE_DIR, 'mode.json');
const AUDIT_LOG = path.join(STATE_DIR, 'audit.log');

const BLOCKLIST_DIRS = ['.git', '.cursor', 'node_modules', '.vibeswitch'];
const BLOCKLIST_FILES = ['.env', 'credentials.json', 'secrets.json'];

let canonical;
try { canonical = require(path.join(LIB_DIR, 'canonical.js')); } catch (e) { process.exit(1); }

let db;
try {
    const Database = require('better-sqlite3');
    db = new Database(CONSUMED_DB);
    db.exec('CREATE TABLE IF NOT EXISTS consumed (request_id TEXT PRIMARY KEY, consumed_at INTEGER)');
} catch (e) { db = null; }
const consumedInMemory = new Set();

function getMode() {
    try { return JSON.parse(fs.readFileSync(MODE_FILE, 'utf8')).mode || 'dev'; } catch { return 'dev'; }
}

function getWorkspaces() {
    try { return JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf8')).workspaces || []; } catch { return []; }
}

function realpath(p) { try { return fs.realpathSync(p); } catch { return p; } }

function isPathSafe(workspaceRoot, filePath) {
    const resolved = path.resolve(workspaceRoot, filePath);
    const realResolved = realpath(path.dirname(resolved));
    const realWorkspace = realpath(workspaceRoot);
    if (!realResolved.startsWith(realWorkspace + path.sep) && realResolved !== realWorkspace) {
        return { safe: false, reason: 'Path escapes workspace' };
    }
    const relative = path.relative(realWorkspace, resolved);
    for (const blocked of BLOCKLIST_DIRS) {
        if (relative.startsWith(blocked + path.sep) || relative === blocked) {
            return { safe: false, reason: `Cannot modify ${blocked}/` };
        }
    }
    if (BLOCKLIST_FILES.includes(path.basename(resolved))) {
        return { safe: false, reason: `Cannot modify ${path.basename(resolved)}` };
    }
    return { safe: true, resolved };
}

function verifyToken(token, request) {
    try {
        const [payloadB64, sigB64] = token.split('.');
        if (!payloadB64 || !sigB64) return { valid: false, reason: 'Invalid token format' };
        const payloadJson = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const signature = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        const payload = JSON.parse(payloadJson);
        const publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_FILE, 'utf8'));
        const canonicalPayload = canonical.toCanonicalJSON(payload);
        if (!crypto.verify(null, Buffer.from(canonicalPayload), publicKey, signature)) return { valid: false, reason: 'Invalid signature' };
        if (Date.now() > parseInt(payload.exp, 10)) return { valid: false, reason: 'Token expired' };
        if (payload.requestId !== request.requestId) return { valid: false, reason: 'Request ID mismatch' };
        if (payload.scope.filePath !== request.filePath) return { valid: false, reason: 'File path mismatch' };
        if (payload.scope.patchHash !== request.patchHash) return { valid: false, reason: 'Patch hash mismatch' };
        if (consumedInMemory.has(payload.requestId)) return { valid: false, reason: 'Token already used' };
        if (db) { const row = db.prepare('SELECT 1 FROM consumed WHERE request_id = ?').get(payload.requestId); if (row) return { valid: false, reason: 'Token already used' }; }
        return { valid: true, payload };
    } catch (e) { return { valid: false, reason: e.message }; }
}

function consumeToken(requestId) {
    consumedInMemory.add(requestId);
    if (db) { try { db.prepare('INSERT OR IGNORE INTO consumed (request_id, consumed_at) VALUES (?, ?)').run(requestId, Date.now()); } catch (e) {} }
}

function audit(action, details) {
    try { fs.appendFileSync(AUDIT_LOG, JSON.stringify({ ts: new Date().toISOString(), action, ...details }) + '\n', 'utf8'); } catch (e) {}
}

async function handleSubmitPatch(args) {
    const { workspaceRoot, filePath, patch } = args;
    if (!workspaceRoot || !filePath || !patch) return { error: 'Missing required arguments' };
    const allowedWorkspaces = getWorkspaces();
    const realWs = realpath(workspaceRoot);
    if (!allowedWorkspaces.includes(realWs)) return { error: 'Workspace not in allowlist' };
    const pathCheck = isPathSafe(workspaceRoot, filePath);
    if (!pathCheck.safe) return { error: pathCheck.reason };
    const requestId = crypto.randomUUID();
    const patchHash = crypto.createHash('sha256').update(patch).digest('hex').slice(0, 16);
    const request = { requestId, workspaceRoot: realWs, filePath, patch, patchHash, createdAt: new Date().toISOString() };
    if (!fs.existsSync(REQUESTS_DIR)) fs.mkdirSync(REQUESTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REQUESTS_DIR, `${requestId}.json`), JSON.stringify(request, null, 2));
    audit('SUBMIT_PATCH', { requestId, filePath, patchHash });
    return { success: true, requestId, patchHash, message: 'Patch submitted. Wait for approval then call apply_patch.' };
}

async function handleApplyPatch(args) {
    const { workspaceRoot, requestId, filePath, patch, token } = args;
    if (!workspaceRoot || !requestId || !filePath || !patch || !token) return { error: 'Missing required arguments' };
    const mode = getMode();
    const allowedWorkspaces = getWorkspaces();
    const realWs = realpath(workspaceRoot);
    if (!allowedWorkspaces.includes(realWs)) return { error: 'Workspace not in allowlist' };
    const pathCheck = isPathSafe(workspaceRoot, filePath);
    if (!pathCheck.safe) return { error: pathCheck.reason };
    const patchHash = crypto.createHash('sha256').update(patch).digest('hex').slice(0, 16);
    if (mode === 'dev') {
        const verification = verifyToken(token, { requestId, filePath, patchHash });
        if (!verification.valid) { audit('APPLY_PATCH_DENIED', { requestId, reason: verification.reason }); return { error: `Token verification failed: ${verification.reason}` }; }
        consumeToken(requestId);
    }
    if (mode === 'dev' && patch.split('\n').length > 500) return { error: 'DEV: Patch too large (max 500 lines)' };
    if (patch.includes('\0')) return { error: 'Binary patches not allowed' };
    try {
        const patchFile = path.join(os.tmpdir(), `vibeswitch-${requestId}.patch`);
        fs.writeFileSync(patchFile, patch);
        if (mode === 'dev') execSync(`git apply --check --no-fuzz "${patchFile}"`, { cwd: realWs, stdio: 'pipe' });
        execSync(`git apply "${patchFile}"`, { cwd: realWs, stdio: 'pipe' });
        fs.unlinkSync(patchFile);
        audit('APPLY_PATCH_SUCCESS', { requestId, filePath, patchHash, mode });
        return { success: true, message: `Patch applied to ${filePath}` };
    } catch (e) { audit('APPLY_PATCH_FAILED', { requestId, filePath, error: e.message }); return { error: `Patch failed: ${e.message}` }; }
}

const server = new Server({ name: 'vibeswitch', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        { name: 'mcp__vibeswitch__submit_patch', description: 'Submit patch for approval', inputSchema: { type: 'object', properties: { workspaceRoot: { type: 'string' }, filePath: { type: 'string' }, patch: { type: 'string' } }, required: ['workspaceRoot', 'filePath', 'patch'] } },
        { name: 'mcp__vibeswitch__apply_patch', description: 'Apply approved patch', inputSchema: { type: 'object', properties: { workspaceRoot: { type: 'string' }, requestId: { type: 'string' }, filePath: { type: 'string' }, patch: { type: 'string' }, token: { type: 'string' } }, required: ['workspaceRoot', 'requestId', 'filePath', 'patch', 'token'] } }
    ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (name === 'mcp__vibeswitch__submit_patch') return { content: [{ type: 'text', text: JSON.stringify(await handleSubmitPatch(args)) }] };
        if (name === 'mcp__vibeswitch__apply_patch') return { content: [{ type: 'text', text: JSON.stringify(await handleApplyPatch(args)) }] };
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown tool' }) }] };
    } catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }] }; }
});

async function main() { const transport = new StdioServerTransport(); await server.connect(transport); }
main().catch(console.error);
