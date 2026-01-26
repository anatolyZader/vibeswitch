# Multi-Agent Architecture Module

This module implements a production-grade multi-agent architecture for VibeSwitch that runs parallel Cloud Run agents (QA, Security, Architecture) without blocking the main extension flow.

## Architecture

```
Extension (Local)                    Cloud Run (Remote)
├── AgentOrchestrator    ────────>  ├── agent-gateway
│   ├── Git change detection        │   ├── POST /jobs
│   ├── Job submission              │   ├── GET /jobs/{id}
│   └── Polling for results         │   └── Cloud Tasks enqueue
├── AgentGateway                    ├── qa-agent
│   ├── HTTP client                 ├── security-agent
│   ├── Auth handling               └── architecture-agent
│   └── Retry logic
├── FindingsStore
│   ├── Local cache
│   └── VS Code state persistence
└── FindingsDiagnostics
    └── Problems panel integration
```

## Components

### Domain Contracts
- **jobRequest.js**: Schema for job requests
- **finding.js**: Schema for findings
- **agentResponse.js**: Schema for job responses

### Infrastructure
- **AgentGateway**: HTTP client for Cloud Run gateway
- **FindingsStore**: Local cache for findings

### Application
- **AgentOrchestrator**: Orchestrates agent execution

### UI
- **FindingsDiagnostics**: VS Code Diagnostics integration

### Integration
- **AgentsExtensionIntegration**: Extension lifecycle integration

## Usage

### Configuration

Add to VS Code settings:
```json
{
  "vibeswitch.agents.enabled": true,
  "vibeswitch.agents.gatewayUrl": "https://agent-gateway-xxx.run.app",
  "vibeswitch.agents.authToken": "your-token",
  "vibeswitch.agents.triggerOnSave": false,
  "vibeswitch.agents.triggerOnCommit": true,
  "vibeswitch.agents.triggerOnPush": true
}
```

### Trigger Points

1. **On Save** (debounced, DEV mode only or high risk)
2. **Before Commit** (best signal/noise ratio)
3. **Before Push/PR** (strongest gate)

### Findings

Findings are displayed in:
- **Problems Panel**: Grouped by agent category
- **Diagnostics**: File/range-level markers
- **Status Bar**: Agent status ("Agents: 2 running • 1 warning")

## Implementation Status

✅ Core components implemented
✅ Extension integration
✅ Configuration settings
⏳ Cloud Run service definitions (pending)
⏳ Status bar integration (pending)
⏳ CodeLens integration (pending)

## Next Steps

1. Implement empty contract files (finding.js, agentResponse.js, agentGateway.js)
2. Create Cloud Run service definitions
3. Add status bar and CodeLens UI
4. Test end-to-end flow
