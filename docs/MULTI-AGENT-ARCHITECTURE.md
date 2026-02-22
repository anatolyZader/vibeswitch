# Multi-Agent Architecture for VibeSwitch

## Overview

This document describes the production-grade multi-agent architecture that adds parallel Cloud Run agents (QA, Security, Architecture) to VibeSwitch without blocking the main extension flow.

## Architecture Components

### 1. Message value objects (`business_modules/agents/domain/value_objects/`)

- **jobRequest.js**: Schema for job requests sent to Cloud Run gateway
- **finding.js**: Schema for findings returned by agents
- **agentResponse.js**: Schema for job status responses

### 2. Infrastructure Layer

- **AgentGateway** (`infrastructure/gateway/agentGateway.js`): HTTP client with auth, retries, correlation IDs
- **FindingsStore** (`infrastructure/store/findingsStore.js`): Local cache for findings, persisted to VS Code workspace state

### 3. Application Layer

- **AgentOrchestrator** (`app/agentOrchestrator.js`): Decides when to invoke agents, manages async execution

### 4. UI Components

- **Problems Panel Integration**: Shows findings as diagnostics
- **Status Bar**: Shows agent status ("Agents: 2 running • 1 warning")
- **CodeLens**: "Apply suggested fix" for findings with autofix patches
- **Diagnostics**: File/range-level findings

## Integration Points

### Extension Lifecycle Hooks

1. **On Save** (debounced, DEV mode only or high risk)
2. **Before Commit** (best signal/noise ratio)
3. **Before Push/PR** (strongest gate)

### Configuration

Add to `package.json` configuration:
- `vibeswitch.agents.enabled`: Enable/disable agents
- `vibeswitch.agents.gatewayUrl`: Cloud Run gateway URL
- `vibeswitch.agents.authToken`: Auth token (or use token provider)
- `vibeswitch.agents.triggerOnSave`: Trigger on file save
- `vibeswitch.agents.triggerOnCommit`: Trigger before commit

## Cloud Run Services

### Agent Gateway Service

- Endpoint: `POST /jobs` - Submit job request
- Endpoint: `GET /jobs/{id}` - Get job status
- Endpoint: `GET /jobs?correlationId={id}` - Get all jobs for correlation ID

### Agent Services

1. **qa-agent**: Unit tests, typecheck, lint, coverage
2. **security-agent**: SCA, SAST, secrets detection
3. **architecture-agent**: Boundary violations, layering breaks, cyclic dependencies

## Implementation Status

✅ Message value objects
✅ FindingsStore
✅ AgentGateway (structure)
⏳ AgentOrchestrator (in progress)
⏳ UI components
⏳ Extension integration
⏳ Cloud Run service definitions
