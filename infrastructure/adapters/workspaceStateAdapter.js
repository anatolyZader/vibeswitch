/**
 * WorkspaceStateAdapter - Adapter implementing IPersistencePort
 * 
 * Wraps VS Code workspaceState API to implement the IPersistencePort interface.
 * This enables testability and the ability to swap storage implementations.
 */

const IPersistencePort = require('../ports/IPersistencePort');

class WorkspaceStateAdapter extends IPersistencePort {
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

    saveSync(key, value) {
        // workspaceState.update is async, but we provide sync wrapper for compatibility
        // Note: This will still be async under the hood, but matches the interface
        this.workspaceState.update(key, value);
    }

    loadSync(key) {
        return this.workspaceState.get(key);
    }
}

module.exports = WorkspaceStateAdapter;


