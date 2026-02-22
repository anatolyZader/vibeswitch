/**
 * Adapter: Generate correlation IDs using crypto.
 * Implements IAgentsIdPort.
 */

const crypto = require('crypto');

function createAgentsCryptoIdAdapter() {
    return {
        generateCorrelationId() {
            try {
                return crypto.randomUUID();
            } catch {
                return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            }
        }
    };
}

module.exports = { createAgentsCryptoIdAdapter };
