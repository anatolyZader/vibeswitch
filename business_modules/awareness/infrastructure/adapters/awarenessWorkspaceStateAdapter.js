/**
 * AwarenessWorkspaceStateAdapter - Adapter implementing IAwarenessPersistencePort
 * 
 * Wraps VS Code workspaceState API to implement the IAwarenessPersistencePort interface.
 * This enables testability and the ability to swap storage implementations.
 */

const IAwarenessPersistencePort = require('../../domain/ports/IAwarenessPersistencePort');

class AwarenessWorkspaceStateAdapter extends IAwarenessPersistencePort {
    /**
     * @param {Object} context - VS Code ExtensionContext with workspaceState
     */
    constructor(context) {
        super();
        if (!context || !context.workspaceState) {
            throw new Error('WorkspaceStateAdapter requires context with workspaceState');
        }
        this.context = context;
        this.workspaceState = context.workspaceState;
    }

    async save(key, value) {
        await this.workspaceState.update(key, value);
    }

    async load(key) {
        return this.workspaceState.get(key);
    }

    async delete(key) {
        await this.workspaceState.update(key, undefined);
    }

    /**
     * Save without awaiting (fire-and-forget)
     * @deprecated This is not actually synchronous - use save() instead
     * @param {string} key - Storage key
     * @param {*} value - Value to save
     */
    saveSync(key, value) {
        // Fix: This is not actually sync - workspaceState.update is async
        // Fire-and-forget pattern (not recommended, but kept for backward compatibility)
        this.workspaceState.update(key, value).catch(() => {
            // Silently ignore errors in fire-and-forget mode
        });
    }

    loadSync(key) {
        return this.workspaceState.get(key);
    }
}

module.exports = AwarenessWorkspaceStateAdapter;



