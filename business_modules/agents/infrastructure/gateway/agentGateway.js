/**
 * Agent Gateway - HTTP client for Cloud Run agent gateway.
 */

class AgentGateway {
    constructor(opts) {
        this.gatewayUrl = opts.gatewayUrl;
        this.getAuthToken = opts.getAuthToken;
        this.log = opts.log || (() => {});
    }

    async submitJob(jobRequest) {
        throw new Error('AgentGateway.submitJob not implemented');
    }

    async getJobsByCorrelationId(correlationId) {
        return [];
    }
}

module.exports = AgentGateway;
