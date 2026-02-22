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
const AgentsGitWorkspaceAdapter = require('./infrastructure/adapters/agentsGitWorkspaceAdapter');
const { createAgentsWorkspaceStatePersistenceAdapter } = require('./infrastructure/adapters/agentsWorkspaceStatePersistenceAdapter');
const { createJobRequest } = require('./domain/value_objects/jobRequest');
const { createFinding } = require('./domain/value_objects/finding');
const { createJobResponse } = require('./domain/value_objects/agentResponse');

module.exports = {
    AgentGateway,
    FindingsStore,
    AgentOrchestrator,
    FindingsDiagnostics,
    AgentsExtensionIntegration,
    AgentsGitWorkspaceAdapter,
    createAgentsWorkspaceStatePersistenceAdapter,
    createJobRequest,
    createFinding,
    createJobResponse
};
