/**
 * Port: persist research payloads and read current + history for the agent.
 * Implemented by research SQLite store adapter.
 * @abstract
 */
class IResearchPersistencePort {
    /**
     * @param {Object} payload - Research payload (timestamp, source, scoreData, etc.)
     * @returns {Promise<void>}
     */
    async persist(payload) {
        if (new.target === IResearchPersistencePort) {
            throw new Error('IResearchPersistencePort is abstract');
        }
        throw new Error('persist() must be implemented');
    }

    /**
     * @param {{ lastDays?: number, lastN?: number }} [opts]
     * @returns {Promise<{ current: Object|null, history: Object[] }>}
     */
    async getPayloadForAgent(opts) {
        if (new.target === IResearchPersistencePort) {
            throw new Error('IResearchPersistencePort is abstract');
        }
        throw new Error('getPayloadForAgent() must be implemented');
    }
}

module.exports = { IResearchPersistencePort };
