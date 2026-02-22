# Spec: Agents business module

Agents business module: multi-agent orchestration (trigger on save/commit), config-driven activation, job submission to a gateway, polling for results, findings store with workspace-state persistence, and VS Code diagnostics integration.

**Principle:** A great spec defines not only functional requirements but **how those requirements will be tested**. Include edge cases, input-output pairs, and success criteria. That gives the agent everything it needs to produce meaningful tests—and you get exactly what you want covered.

---

## Contract

- **Name:** Agents module — extension integration, orchestrator, findings store, diagnostics, and gateway port for Cloud Run agent jobs.
- **Signature / API:**
  - **Extension integration:** `AgentsExtensionIntegration(context, state, log)` — constructor. `start()`: subscribe to save events, log "Agent integration started". `_onFileSave(document)`: debounced; when triggerOnSave or mode 'dev', call `orchestrator.triggerAgents({ trigger: 'save', mode })`. `triggerBeforeCommit()`: call `orchestrator.triggerAgents({ trigger: 'before-commit', mode })`; show info/error message. `updateDiagnostics()`: derive workspaceId, branch, commit; call `diagnostics.updateDiagnostics(workspaceId, branch, commit)`. `dispose()`: clear debounce timer, dispose diagnostics and orchestrator.
  - **Orchestrator:** `AgentOrchestrator(config)` with `{ gateway, findingsStore, context, log }`. `triggerAgents(options)`: options `{ trigger = 'save', workspaceRoot, mode = 'dev' }`; returns `Promise<string|null>` (correlationId or null). Resolves workspace info (git); gets changed files; builds job via createJobRequest; calls `gateway.submitJob(jobRequest)`; on success stores active job, starts polling, returns correlationId; on not-git or no changed files returns null; on gateway throw rethrows after log. Poll interval 2000 ms, max poll 5 min. `dispose()`: clear all intervals and active jobs.
  - **Findings store:** `FindingsStore(context, log)`. `storeFindings(workspaceId, branch, commit, correlationId, findings)`: replace findings with same correlationId for key, append new, persist. `getFindings(workspaceId, branch, commit, filters?)`: optional `filters.category`, `filters.severity`; return array. `getAllFindings(workspaceId)`: all findings for keys starting with workspaceId. `clearFindings(workspaceId, branch, commit)`, `clearAllFindings(workspaceId)`. `getSummary(workspaceId, branch, commit)`: `{ total, byCategory: { qa, security, architecture }, bySeverity: { info, warn, error } }`. Persistence key: `vibeswitch.agents.findings`.
  - **Diagnostics:** `FindingsDiagnostics(findingsStore, log)`. `updateDiagnostics(workspaceId, branch, commit)`: get findings, group by `finding.evidence.file`, convert to VS Code Diagnostic (severity, range, message, source, code, relatedInformation if recommendation); clear collection then set per file URI. `clear()`, `dispose()`.
  - **Gateway port (infrastructure contract):** `submitJob(jobRequest): Promise<{ jobId: string }>`. `getJobsByCorrelationId(correlationId): Promise<Array<{ status: string, findings?: Array<Finding> }>>`. Job request shape per JobRequest contract; finding shape per Finding contract.
  - **Domain value objects:** `createJobRequest(params)` → object with schemaVersion '1.0.0', correlationId, repoId, branch, commit, changedFiles, context, capabilities, metadata (default {}). `createFinding(...)`, `createJobResponse(...)` — exported; signatures satisfy store and orchestrator usage.
- **Location:**
  - **No input layer** — extension wires module in-process when `vibeswitch.agents.enabled` is true.
  - Integration: `business_modules/agents/integration/extensionIntegration.js`.
  - App: `business_modules/agents/app/agentOrchestrator.js`.
  - Domain value objects: `business_modules/agents/domain/value_objects/jobRequest.js`, `finding.js`, `agentResponse.js`.
  - Infrastructure: `business_modules/agents/infrastructure/store/findingsStore.js`, `business_modules/agents/infrastructure/gateway/agentGateway.js`.
  - UI: `business_modules/agents/ui/findingsDiagnostics.js`.
  - Module barrel: `business_modules/agents/index.js` — exports AgentGateway, FindingsStore, AgentOrchestrator, FindingsDiagnostics, AgentsExtensionIntegration, createJobRequest, createFinding, createJobResponse.

---

## Naming (optional)

- **Function / module / API:** camelCase for functions and file names; PascalCase for classes (AgentOrchestrator, FindingsStore, FindingsDiagnostics, AgentsExtensionIntegration).
- **Parameters and options:** camelCase: triggerAgents, workspaceRoot, correlationId, getFindings, storeFindings, createJobRequest.
- **Business module:** File names camelCase. Domain value objects: JobRequest, ChangedFile, JobContext, AgentCapabilities, Finding. Port: gateway contract (implemented by agentGateway in infrastructure). Adapters: agentsGatewayAdapter in infrastructure/gateway. See `.cursor/skills/create-business-module/SKILL.md` for the full naming table.

---

## Business module (optional)

- **Module name:** `agents`
- **Layers (mandatory for modules):**
  - **Input:** Omitted — module is only called in-process from extension; AgentsExtensionIntegration is the entry.
  - **App:** AgentOrchestrator (orchestrates workspace info, changed files, job request, gateway submit, polling, store findings). AgentsExtensionIntegration (extension lifecycle, save/commit triggers, diagnostics refresh).
- **Domain model (DDD):**
  - **Entities:** None required.
  - **Value objects:** JobRequest (schemaVersion, correlationId, repoId, branch, commit, changedFiles, context, capabilities, metadata). ChangedFile: { path, patch, language, size }. JobContext: { mode: 'dev'|'vibe', riskLevel, userSettings }. AgentCapabilities: { canSuggestFixes, maxTokens, timeBudgetMs }. Finding: { category, severity, message, ruleId, evidence: { file, range? }, recommendation?, correlationId? }; category e.g. qa | security | architecture; severity error | warn | info; range { start: { line, character }, end: { line, character } }.
  - **Ports:** Gateway port used by orchestrator: submitJob(jobRequest) → Promise<{ jobId }>; getJobsByCorrelationId(correlationId) → Promise<Array<{ status, findings? }>>. Implemented by adapter in infrastructure/gateway (e.g. agentGateway.js or agentsGatewayAdapter.js).
- **Infrastructure adapters:** Gateway adapter (HTTP client to Cloud Run); findings store (workspace state persistence); diagnostics (VS Code DiagnosticCollection). Naming: under infrastructure/store/findingsStore.js, infrastructure/gateway/agentGateway.js; UI in ui/findingsDiagnostics.js.

---

## Input / Output (and behavior)

### Configuration and activation

| Input | Expected output / behavior |
|-------|-----------------------------|
| `vibeswitch.agents.enabled` true, `vibeswitch.agents.gatewayUrl` set | Extension creates AgentsExtensionIntegration, start(), adds to subscriptions, sets state.agentsIntegration; gateway and orchestrator created. |
| `vibeswitch.agents.enabled` true, `vibeswitch.agents.gatewayUrl` empty | Orchestrator null; log "Agent gateway URL not configured, agents disabled". |
| `vibeswitch.agents.enabled` false | Extension does not create agents integration. |
| `vibeswitch.agents.triggerOnSave` false, mode not 'dev' | _onFileSave does not call triggerAgents. |
| `vibeswitch.agents.triggerOnSave` true or mode 'dev' | _onFileSave debounces (2000 ms) then calls triggerAgents({ trigger: 'save', mode }). |

### AgentOrchestrator.triggerAgents

| Input | Expected output / behavior |
|-------|-----------------------------|
| Workspace not a git repo | Log "Cannot trigger agents: not a git repository"; return null. |
| Git repo, no changed files | Log "No changed files to analyze"; return null. |
| Git repo, has changed files, gateway.submitJob resolves with { jobId } | Store active job, start polling, return correlationId (UUID or fallback). |
| gateway.submitJob throws | Log failure, rethrow. |

### FindingsStore

| Input | Expected output / behavior |
|-------|-----------------------------|
| storeFindings(workspaceId, branch, commit, correlationId, findings) | Key workspaceId:branch:commit; remove existing findings with same correlationId, append new; persist to workspace state. |
| getFindings(workspaceId, branch, commit) | Return array of findings for that key. |
| getFindings(workspaceId, branch, commit, { category: 'qa' }) | Return only findings where category === 'qa'. |
| getFindings(..., { severity: 'error' }) | Return only findings where severity === 'error'. |
| getAllFindings(workspaceId) | Return all findings for keys starting with workspaceId:. |
| clearFindings(workspaceId, branch, commit) | Delete key, persist. |
| clearAllFindings(workspaceId) | Delete all keys with prefix workspaceId:, persist. |
| getSummary(workspaceId, branch, commit) | { total, byCategory: { qa, security, architecture }, bySeverity: { info, warn, error } } from getFindings. |

### Domain: createJobRequest

| Input | Expected output / behavior |
|-------|-----------------------------|
| createJobRequest({ correlationId, repoId, branch, commit, changedFiles, context, capabilities, metadata }) | Object with schemaVersion '1.0.0', all params; metadata default {}. |
| createJobRequest(..., metadata omitted) | metadata set to {}. |

### FindingsDiagnostics.updateDiagnostics

| Input | Expected output / behavior |
|-------|-----------------------------|
| updateDiagnostics(workspaceId, branch, commit) with findings in store | Get findings; group by evidence.file; convert to Diagnostic (severity, range, message, source "VibeSwitch {category}", code ruleId, relatedInformation if recommendation); clear collection, set per file URI (workspace root + relative path). |
| Finding without evidence.file | Skip that finding. |
| Finding without evidence.range | Use range (0,0)-(0,0). |

### Extension integration

| Input | Expected output / behavior |
|-------|-----------------------------|
| triggerBeforeCommit() with orchestrator null | Show warning "Agents not configured"; return. |
| triggerBeforeCommit() with orchestrator, success | Show info with correlationId. |
| triggerBeforeCommit() with orchestrator, throw | Show error message. |
| updateDiagnostics() with no workspace folders | Return without calling diagnostics. |
| _getWorkspaceId(workspaceRoot) with git remote | Return remote.origin.url. |
| _getWorkspaceId(workspaceRoot) without git remote | Return SHA-256 hash of path, first 16 chars. |

### Polling (orchestrator)

| Input | Expected output / behavior |
|-------|-----------------------------|
| getJobsByCorrelationId returns [] | Stop polling. |
| All jobs status 'completed' or 'failed', findings present | findingsStore.storeFindings(workspaceId, branch, commit, correlationId, allFindings); stop polling. |
| Poll count reaches max (5 min) | Stop polling; no persist from that poll. |

---

## Edge cases and corner cases

- **Not a git repo:** triggerAgents returns null (no throw).
- **No changed files:** triggerAgents returns null (no throw).
- **Polling:** Empty job list → stop polling. All completed/failed → persist findings then stop. Max time reached → stop without persisting (no findings from that poll).
- **Findings for same correlationId:** Replace previous findings for that key (replace-by-correlationId).
- **Diagnostics:** Findings without evidence.file skipped; missing evidence.range → range (0,0)-(0,0).
- **Workspace id:** No git remote → hash of workspace root path (16-char hex).
- **Correlation id:** Prefer crypto.randomUUID(); fallback `agent-${Date.now()}-${random 9 chars}`.
- **Save debounce:** Single timer; repeated saves within 2000 ms result in one triggerAgents call after last save.

---

## Error cases

- **Gateway throws on submit:** triggerAgents logs "Failed to submit agent job: ..." and rethrows.
- **No gateway URL:** Orchestrator not created; log "Agent gateway URL not configured, agents disabled". start() logs "Agents not available (gateway not configured)" and returns.
- **triggerBeforeCommit with no orchestrator:** Show warning "Agents not configured"; no throw.

---

## Invariants

- **Findings store:** Same correlationId for a key replaces previous findings with that correlationId; then new findings appended. Cache key format: `workspaceId:branch:commit`. Persistence key: `vibeswitch.agents.findings`.
- **Diagnostics:** updateDiagnostics clears the collection then sets diagnostics per file; findings without evidence.file are not shown.
- **Orchestrator:** dispose() clears all polling intervals and _activeJobs. Integration dispose() clears save debounce timer and disposes diagnostics and orchestrator.
- **Extension wiring:** Agents integration created only when vibeswitch.agents.enabled is true; then start() called and instance pushed to context.subscriptions and state.agentsIntegration.

---

## Success criteria (how this will be tested)

- **Pass:** All input/output pairs in the tables above pass. Config variants (enabled/disabled, gatewayUrl set/empty, triggerOnSave, mode) yield correct creation and trigger behavior. triggerAgents returns null for non-git and no-changes; returns correlationId on successful submit; throws when gateway throws. Store: store/get/clear/getSummary/getAllFindings and persistence key behavior. createJobRequest output shape. Diagnostics: updateDiagnostics maps findings to VS Code diagnostics; skip when no evidence.file; range fallback. triggerBeforeCommit and updateDiagnostics behavior. Polling: empty jobs → stop; all completed → persist and stop; max time → stop. Edge and error cases produce specified outcomes (null, log, show message, replace-by-correlationId, workspace id hash, correlation id fallback).
- **Coverage:** Every row in Input/Output; every edge case and error case listed; gateway contract (submitJob return shape, getJobsByCorrelationId return shape) satisfied; module exports (AgentGateway, FindingsStore, AgentOrchestrator, FindingsDiagnostics, AgentsExtensionIntegration, createJobRequest, createFinding, createJobResponse) preserved.
- **Test fails when:** triggerAgents throws when not a git repo or no changed files; store does not replace by correlationId; diagnostics show finding without evidence.file; gateway return shape does not include jobId or status/findings; or extension creates integration when enabled is false.

---

## Test levels (optional)

- **Unit (default):** All value objects and components with mocked gateway, store, and VS Code: AgentOrchestrator (triggerAgents for git/no-git, no-changes, submit success/throw, polling behavior); FindingsStore (store, get, get with filters, getAll, clear, clearAll, getSummary, persistence load/save); createJobRequest output shape; FindingsDiagnostics (updateDiagnostics mapping, skip no file, range fallback); AgentsExtensionIntegration (constructor wiring, start when no orchestrator, _onFileSave with triggerOnSave/mode, triggerBeforeCommit, updateDiagnostics, _getWorkspaceId, dispose). Mock gateway: submitJob returns { jobId }; getJobsByCorrelationId returns [] or array of { status, findings }.
- **Integration (optional):** AgentOrchestrator + in-memory store + mock gateway (implementing submitJob and getJobsByCorrelationId); triggerAgents with mock workspace info and changed files → submit called with correct job shape; polling with mock returning completed jobs with findings → storeFindings called with correct args.
- **E2E:** Not required for this spec.

---

## Test file hint (optional)

- **Unit:** `tests/business_modules/agents/app/agentOrchestrator.test.js`, `tests/business_modules/agents/infrastructure/store/findingsStore.test.js`, `tests/business_modules/agents/domain/value_objects/jobRequest.test.js`, `tests/business_modules/agents/domain/value_objects/finding.test.js`, `tests/business_modules/agents/domain/value_objects/agentResponse.test.js`, `tests/business_modules/agents/ui/findingsDiagnostics.test.js`, `tests/business_modules/agents/integration/extensionIntegration.test.js`.
- **Integration:** `tests/business_modules/agents/app/agentOrchestrator.integration.test.js` — AgentOrchestrator + mock gateway + in-memory findings store; triggerAgents → submit and polling → storeFindings called.

---

## Note on missing implementation files

If `domain/value_objects/finding.js`, `domain/value_objects/agentResponse.js`, or `infrastructure/gateway/agentGateway.js` are missing or stubs, the spec requires implementing them so that (1) module index exports createFinding, createJobResponse, and AgentGateway are satisfied, and (2) the gateway contract (submitJob, getJobsByCorrelationId) is implemented for the orchestrator to function. Tests may stub these for unit tests; integration tests use a mock gateway that fulfills the contract.
