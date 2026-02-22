/**
 * Port: send research payload to external agent.
 * Implemented by research HTTP agent client adapter.
 * @abstract
 */
class IResearchAgentPort {
    /**
     * @param {Object} payload - { current, history } or similar
     * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
     */
    async send(payload) {
        if (new.target === IResearchAgentPort) {
            throw new Error('IResearchAgentPort is abstract');
        }
        throw new Error('send() must be implemented');
    }
}

module.exports = { IResearchAgentPort };
