/**
 * Agents Module - Multi-Agent Architecture
 * 
 * Exports all agent-related components for use in extension.
 */

const AgentGateway = require('./infrastructure/gateway/agentGateway');
const FindingsStore = require('./infrastructure/store/findingsStore');
const AgentOrchestrator = require('./app/agentOrchestrator');
const FindingsDiagnostics = require('./ui/findingsDiagnostics');
const AgentsExtensionIntegration = require('./integration/extensionIntegration');
const { createJobRequest } = require('./domain/contracts/jobRequest');
const { createFinding } = require('./domain/contracts/finding');
const { createJobResponse } = require('./domain/contracts/agentResponse');

module.exports = {
    AgentGateway,
    FindingsStore,
    AgentOrchestrator,
    FindingsDiagnostics,
    AgentsExtensionIntegration,
    createJobRequest,
    createFinding,
    createJobResponse
};
