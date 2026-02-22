/**
 * Adapter: implements IResearchPersistencePort using SQLite (ResearchStore).
 */
const { createResearchStore } = require('../ResearchStore');

/**
 * Create a persistence adapter that implements IResearchPersistencePort.
 * @param {string} dbPath - Path to SQLite file
 * @param {{ loggerPort?: { error } }} [opts]
 * @returns {Promise<{ persist: Function, getPayloadForAgent: Function, close: Function }>}
 */
async function createResearchSqlitePersistenceAdapter(dbPath, opts) {
    return createResearchStore(dbPath, opts);
}

module.exports = {
    createResearchSqlitePersistenceAdapter
};
