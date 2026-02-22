/**
 * Adapter: Persist findings cache using VS Code workspace state.
 * Implements IAgentsFindingsPersistencePort.
 */

/**
 * @param {import('vscode').ExtensionContext} context
 * @returns {import('../../domain/ports/IAgentsFindingsPersistencePort')}
 */
function createAgentsWorkspaceStatePersistenceAdapter(context) {
    return {
        get(key, defaultValue = {}) {
            return context.workspaceState.get(key, defaultValue);
        },
        set(key, value) {
            context.workspaceState.update(key, value);
        }
    };
}

module.exports = { createAgentsWorkspaceStatePersistenceAdapter };
