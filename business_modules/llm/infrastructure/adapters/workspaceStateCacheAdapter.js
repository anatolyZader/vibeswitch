/**
 * WorkspaceStateCacheAdapter
 *
 * Stores cached insight bundles in VS Code workspaceState (persistent per-workspace).
 */

class WorkspaceStateCacheAdapter {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        this.context = context;
    }

    async get(key) {
        if (!this.context?.workspaceState) return null;
        const payload = this.context.workspaceState.get(key, null);
        if (!payload || typeof payload !== 'object') return null;
        if (!('value' in payload)) return null;

        const ts = typeof payload.ts === 'number' ? payload.ts : 0;
        const ttlMs = typeof payload.ttlMs === 'number' ? payload.ttlMs : null;
        if (ttlMs && ts && (Date.now() - ts) > ttlMs) {
            // Expired: best-effort cleanup.
            try {
                await this.context.workspaceState.update(key, undefined);
            } catch {
                // ignore
            }
            return null;
        }

        return payload.value;
    }

    async set(key, value, options = {}) {
        if (!this.context?.workspaceState) return;
        // TTL is best-effort; we store timestamp alongside value.
        const ttlMs = options.ttlMs;
        const payload = {
            value,
            ts: Date.now(),
            ttlMs: typeof ttlMs === 'number' ? ttlMs : null
        };
        await this.context.workspaceState.update(key, payload);
    }
}

module.exports = WorkspaceStateCacheAdapter;

