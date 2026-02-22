/**
 * Port: Persistence for findings cache (key-value).
 * Implemented by infrastructure/adapters/agentsWorkspaceStatePersistenceAdapter.js.
 *
 * @interface
 * @typedef {Object} IAgentsFindingsPersistencePort
 * @property {function(string, Object): *} get - get(key, defaultValue) returns stored value or default
 * @property {function(string, *): void} set - set(key, value) persists value
 */

module.exports = {};
